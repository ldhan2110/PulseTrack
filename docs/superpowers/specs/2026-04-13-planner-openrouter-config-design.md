# Planner AI — Dedicated OpenRouter Configuration Card

**Date:** 2026-04-13
**Status:** Approved

## Overview

Add a dedicated "Planner AI (OpenRouter)" settings card to the Project Settings page. This gives the Project Planner its own AI provider configuration, separate from the general AI config used by task generation and test case generation. The planner checks this config first; if absent, it falls back to the existing `AiConfig`.

## Database Schema

New Prisma model:

```prisma
model PlannerAiConfig {
  id        String   @id @default(cuid())
  projectId String   @unique
  provider  String   @default("openrouter")
  model     String
  apiKey    String   // AES-256-GCM encrypted
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

- `provider` defaults to `openrouter` — only option for now, stored as string for future extensibility.
- `model` is free-text (OpenRouter supports hundreds of models).
- `apiKey` uses the same AES-256-GCM encryption as `AiConfig`.
- No `projectContext` — that remains on the general `AiConfig` and is injected into planner prompts regardless of provider.
- Requires adding `plannerAiConfig PlannerAiConfig?` relation on the `Project` model.

## Backend — NestJS Module

### Files

- `apps/api/src/planner-ai-config/planner-ai-config.module.ts`
- `apps/api/src/planner-ai-config/planner-ai-config.service.ts`
- `apps/api/src/planner-ai-config/planner-ai-config.controller.ts`
- `apps/api/src/planner-ai-config/dto/upsert-planner-ai-config.dto.ts`

### Service

Follows the same pattern as `AiConfigService`:

- `findByProjectId(projectId)` — returns config with masked API key, or `null`.
- `upsert(projectId, dto)` — encrypts API key with `ENCRYPTION_KEY`, upserts record.

### Controller

Nested under existing projects route, guarded by `ProjectRolesGuard` with `projectSettings` `update` permission:

- `GET /projects/:projectId/settings/planner-ai` — get planner AI config.
- `PUT /projects/:projectId/settings/planner-ai` — upsert planner AI config.

### DTO

```typescript
class UpsertPlannerAiConfigDto {
  provider: string;   // @IsIn(['openrouter'])
  model: string;      // @IsNotEmpty()
  apiKey: string;     // @IsNotEmpty()
}
```

## Frontend — PlannerAiConfigCard

### New files

- `apps/web/src/components/settings/PlannerAiConfigCard.tsx`
- `apps/web/src/hooks/usePlannerAiConfig.ts`

### Card design

- Icon: `Wand2` with blue accent to distinguish from the purple `Bot` icon on the general AI card.
- Title: "Planner AI (OpenRouter)"
- Subtitle: "Configure OpenRouter as the AI provider for the Project Planner. Falls back to the general AI configuration if not set."

### Fields

- **Model** — Combobox (input + dropdown suggestions). Pre-populated suggestions:
  - `anthropic/claude-sonnet-4` (default)
  - `anthropic/claude-opus-4`
  - `google/gemini-2.5-pro`
  - `openai/gpt-4.1`
  - `deepseek/deepseek-r1`
  - Free-text input allowed for any OpenRouter model slug.
- **API Key** — Password input with show/hide toggle (same pattern as `AiConfigCard`).
- **Save** button.

No provider dropdown (card is OpenRouter-specific). No project context (stays on general AI card).

### Placement

On the Settings > General tab, directly after the existing `AiConfigCard` (line 232 of `ProjectSettingsPage.tsx`).

### Types and hooks

New in `apps/web/src/lib/types.ts`:

```typescript
export interface PlannerAiConfig {
  id: string;
  provider: string;
  model: string;
  apiKey: string; // masked
}

export interface UpsertPlannerAiConfigPayload {
  provider: string;
  model: string;
  apiKey: string;
}
```

New API methods in `apps/web/src/lib/api.ts`:

- `getPlannerAiConfig(projectId)` — `GET /projects/:projectId/settings/planner-ai`
- `upsertPlannerAiConfig(projectId, payload)` — `PUT /projects/:projectId/settings/planner-ai`

New hooks in `apps/web/src/hooks/usePlannerAiConfig.ts`:

- `usePlannerAiConfig(projectId)` — React Query `useQuery`
- `useUpsertPlannerAiConfig(projectId)` — React Query `useMutation` with cache invalidation

## Integration — Planner Resolution Logic

### Change in `PlannerAiService.getProjectAiConfig()`

Current flow:

```
AiConfig → decrypt → resolve CLI → return
```

New flow:

```
PlannerAiConfig → if found → decrypt → return {provider: 'openrouter', model, apiKey, workspacePath, cli: ''}
                → if not found → AiConfig → decrypt → resolve CLI → return (unchanged)
```

### What changes

- `PlannerAiService.getProjectAiConfig()` gains a check at the top: query `prisma.plannerAiConfig.findUnique({ where: { projectId } })`. If found, decrypt and return immediately.
- The `cli` field returns empty string for OpenRouter (unused in the HTTP streaming path).

### What doesn't change

- `streamChatResponse` — already branches on `provider === 'openrouter'` and calls `streamOpenRouterResponse`.
- `streamOpenRouterResponse` — already handles OpenRouter HTTP streaming correctly.
- `buildContext`, `parseActions` — provider-agnostic.
- `PlannerChatService` — calls `getProjectAiConfig` + `streamChatResponse` transparently.
- `AiTaskGenerationProcessor`, `AiTestCaseGenerationProcessor` — only use `AiConfig`, completely unaffected.

## Files Changed (Summary)

| Layer | File | Change |
|-------|------|--------|
| Schema | `apps/api/prisma/schema.prisma` | Add `PlannerAiConfig` model + relation on `Project` |
| Backend | `apps/api/src/planner-ai-config/*` | New module (service, controller, DTO) |
| Backend | `apps/api/src/planner/planner-ai.service.ts` | Check `PlannerAiConfig` first in `getProjectAiConfig()` |
| Backend | `apps/api/src/planner/planner.module.ts` | Import `PlannerAiConfigModule` (if service is shared) |
| Backend | `apps/api/src/app.module.ts` | Register `PlannerAiConfigModule` |
| Frontend | `apps/web/src/components/settings/PlannerAiConfigCard.tsx` | New card component |
| Frontend | `apps/web/src/hooks/usePlannerAiConfig.ts` | New React Query hooks |
| Frontend | `apps/web/src/lib/types.ts` | Add `PlannerAiConfig` types |
| Frontend | `apps/web/src/lib/api.ts` | Add API methods |
| Frontend | `apps/web/src/pages/ProjectSettingsPage.tsx` | Render `PlannerAiConfigCard` after `AiConfigCard` |
