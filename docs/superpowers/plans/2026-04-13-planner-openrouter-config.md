# Planner OpenRouter Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Planner AI (OpenRouter)" settings card so the Project Planner can use OpenRouter independently from the shared AI configuration.

**Architecture:** New `PlannerAiConfig` Prisma model with its own NestJS module (service, controller, DTO) and a new frontend card component. The planner resolution logic checks this config first, falling back to the existing `AiConfig`.

**Tech Stack:** Prisma, NestJS, React, TanStack Query, shadcn/ui (Command + Popover for combobox)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/prisma/schema.prisma` | Add `PlannerAiConfig` model + Project relation |
| Create | `apps/api/src/planner-ai-config/dto/upsert-planner-ai-config.dto.ts` | Validation DTO |
| Create | `apps/api/src/planner-ai-config/planner-ai-config.service.ts` | CRUD with encryption |
| Create | `apps/api/src/planner-ai-config/planner-ai-config.controller.ts` | REST endpoints |
| Create | `apps/api/src/planner-ai-config/planner-ai-config.module.ts` | NestJS module |
| Modify | `apps/api/src/app.module.ts` | Register new module |
| Modify | `apps/api/src/planner/planner-ai.service.ts` | Check PlannerAiConfig first in resolution |
| Modify | `apps/web/src/lib/types.ts` | Add PlannerAiConfig types |
| Modify | `apps/web/src/lib/api.ts` | Add API methods |
| Create | `apps/web/src/hooks/usePlannerAiConfig.ts` | React Query hooks |
| Create | `apps/web/src/components/settings/PlannerAiConfigCard.tsx` | Settings card UI |
| Modify | `apps/web/src/pages/ProjectSettingsPage.tsx` | Render new card |

---

### Task 1: Prisma Schema — Add PlannerAiConfig Model

**Files:**
- Modify: `apps/api/prisma/schema.prisma:249` (Project model relation) and `:625` (after AiConfig model)

- [ ] **Step 1: Add PlannerAiConfig relation to Project model**

In `apps/api/prisma/schema.prisma`, after line 249 (`aiConfig AiConfig?`), add:

```prisma
  plannerAiConfig     PlannerAiConfig?
```

- [ ] **Step 2: Add PlannerAiConfig model**

In `apps/api/prisma/schema.prisma`, after the `AiConfig` model closing brace (line 625), add:

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

- [ ] **Step 3: Generate Prisma client and migration**

Run:
```bash
cd apps/api && npx prisma migrate dev --name add-planner-ai-config
```

Expected: Migration created successfully, Prisma client regenerated.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(schema): add PlannerAiConfig model for dedicated planner provider"
```

---

### Task 2: Backend — DTO

**Files:**
- Create: `apps/api/src/planner-ai-config/dto/upsert-planner-ai-config.dto.ts`

- [ ] **Step 1: Create the DTO file**

Create `apps/api/src/planner-ai-config/dto/upsert-planner-ai-config.dto.ts`:

```typescript
import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpsertPlannerAiConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['openrouter'])
  provider: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/planner-ai-config/
git commit -m "feat(planner-ai-config): add upsert DTO with validation"
```

---

### Task 3: Backend — Service

**Files:**
- Create: `apps/api/src/planner-ai-config/planner-ai-config.service.ts`

- [ ] **Step 1: Create the service**

Create `apps/api/src/planner-ai-config/planner-ai-config.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, maskToken } from '../common/encryption.util';
import { UpsertPlannerAiConfigDto } from './dto/upsert-planner-ai-config.dto';

@Injectable()
export class PlannerAiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async findByProjectId(projectId: string) {
    const config = await this.prisma.plannerAiConfig.findUnique({
      where: { projectId },
    });
    if (!config) return null;
    return { ...config, apiKey: maskToken(config.apiKey) };
  }

  async upsert(projectId: string, dto: UpsertPlannerAiConfigDto) {
    const encryptedKey = encrypt(dto.apiKey, this.encryptionKey);

    const config = await this.prisma.plannerAiConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        provider: dto.provider,
        model: dto.model,
        apiKey: encryptedKey,
      },
      update: {
        provider: dto.provider,
        model: dto.model,
        apiKey: encryptedKey,
      },
    });

    return { ...config, apiKey: maskToken(dto.apiKey) };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/planner-ai-config/
git commit -m "feat(planner-ai-config): add service with encrypted key storage"
```

---

### Task 4: Backend — Controller

**Files:**
- Create: `apps/api/src/planner-ai-config/planner-ai-config.controller.ts`

- [ ] **Step 1: Create the controller**

Create `apps/api/src/planner-ai-config/planner-ai-config.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PlannerAiConfigService } from './planner-ai-config.service';
import { UpsertPlannerAiConfigDto } from './dto/upsert-planner-ai-config.dto';

@Controller('projects/:projectId/settings/planner-ai')
@UseGuards(JwtAuthGuard)
export class PlannerAiConfigController {
  constructor(private readonly service: PlannerAiConfigService) {}

  @Get()
  @UseGuards(ProjectRolesGuard)
  findOne(@Param('projectId') projectId: string) {
    return this.service.findByProjectId(projectId);
  }

  @Put()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  upsert(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertPlannerAiConfigDto,
  ) {
    return this.service.upsert(projectId, dto);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/planner-ai-config/
git commit -m "feat(planner-ai-config): add controller with auth guards"
```

---

### Task 5: Backend — Module Registration

**Files:**
- Create: `apps/api/src/planner-ai-config/planner-ai-config.module.ts`
- Modify: `apps/api/src/app.module.ts:39` (import) and `:78` (register)

- [ ] **Step 1: Create the module**

Create `apps/api/src/planner-ai-config/planner-ai-config.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PlannerAiConfigController } from './planner-ai-config.controller';
import { PlannerAiConfigService } from './planner-ai-config.service';

@Module({
  controllers: [PlannerAiConfigController],
  providers: [PlannerAiConfigService],
  exports: [PlannerAiConfigService],
})
export class PlannerAiConfigModule {}
```

- [ ] **Step 2: Register in AppModule**

In `apps/api/src/app.module.ts`, add the import after line 39 (`PlannerModule`):

```typescript
import { PlannerAiConfigModule } from './planner-ai-config/planner-ai-config.module';
```

Add `PlannerAiConfigModule` to the imports array after `PlannerModule` (after line 78):

```typescript
    PlannerModule,
    PlannerAiConfigModule,
```

- [ ] **Step 3: Verify backend compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/planner-ai-config/ apps/api/src/app.module.ts
git commit -m "feat(planner-ai-config): register module in AppModule"
```

---

### Task 6: Backend — Planner Resolution Logic

**Files:**
- Modify: `apps/api/src/planner/planner-ai.service.ts:135-161`

- [ ] **Step 1: Update getProjectAiConfig to check PlannerAiConfig first**

In `apps/api/src/planner/planner-ai.service.ts`, replace the `getProjectAiConfig` method (lines 135-161) with:

```typescript
  async getProjectAiConfig(projectId: string): Promise<{
    provider: string;
    model: string;
    apiKey: string;
    workspacePath: string | null;
    cli: string;
  } | null> {
    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');

    // Check dedicated planner config first (OpenRouter)
    const plannerConfig = await this.prisma.plannerAiConfig.findUnique({ where: { projectId } });
    if (plannerConfig) {
      const apiKey = decrypt(plannerConfig.apiKey, encryptionKey);
      const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
      const workspacePath = repoConfig?.cloneStatus === 'cloned' ? repoConfig.workspacePath : null;
      return { provider: plannerConfig.provider, model: plannerConfig.model, apiKey, workspacePath, cli: '' };
    }

    // Fall back to shared AI config
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) return null;

    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);
    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    const workspacePath = repoConfig?.cloneStatus === 'cloned' ? repoConfig.workspacePath : null;

    const cliName = CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider;
    const cli = this.resolveCliPath(cliName);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      workspacePath,
      cli,
    };
  }
```

- [ ] **Step 2: Verify backend compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/planner/planner-ai.service.ts
git commit -m "feat(planner): check PlannerAiConfig first, fall back to AiConfig"
```

---

### Task 7: Frontend — Types and API Methods

**Files:**
- Modify: `apps/web/src/lib/types.ts:566` (after UpdateProjectContextPayload)
- Modify: `apps/web/src/lib/api.ts:346` (after generateProjectContext)

- [ ] **Step 1: Add types**

In `apps/web/src/lib/types.ts`, after the `UpdateProjectContextPayload` interface (line 566), add:

```typescript

// ─── Planner AI Config ───────────────────────────────────────────────────────

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

- [ ] **Step 2: Add API methods**

In `apps/web/src/lib/api.ts`, after the `generateProjectContext` method (line 346), add:

```typescript

  // ─── Planner AI Config ──────────────────────────────────────────────────────
  getPlannerAiConfig: (projectId: string) =>
    request<PlannerAiConfig | null>(`/projects/${projectId}/settings/planner-ai`),
  upsertPlannerAiConfig: (projectId: string, data: UpsertPlannerAiConfigPayload) =>
    request<PlannerAiConfig>(`/projects/${projectId}/settings/planner-ai`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
```

Also add the import at the top of `api.ts` — append `PlannerAiConfig, UpsertPlannerAiConfigPayload` to the existing type imports from `'../lib/types'`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(planner-ai-config): add frontend types and API methods"
```

---

### Task 8: Frontend — React Query Hooks

**Files:**
- Create: `apps/web/src/hooks/usePlannerAiConfig.ts`

- [ ] **Step 1: Create the hooks file**

Create `apps/web/src/hooks/usePlannerAiConfig.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { UpsertPlannerAiConfigPayload } from '../lib/types';

export function usePlannerAiConfig(projectId: string) {
  return useQuery({
    queryKey: ['plannerAiConfig', projectId],
    queryFn: () => api.getPlannerAiConfig(projectId),
    enabled: !!projectId,
  });
}

export function useUpsertPlannerAiConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertPlannerAiConfigPayload) =>
      api.upsertPlannerAiConfig(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plannerAiConfig', projectId] });
      toast.success('Planner AI configuration saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save planner AI configuration');
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/usePlannerAiConfig.ts
git commit -m "feat(planner-ai-config): add React Query hooks"
```

---

### Task 9: Frontend — PlannerAiConfigCard Component

**Files:**
- Create: `apps/web/src/components/settings/PlannerAiConfigCard.tsx`

- [ ] **Step 1: Create the card component**

Create `apps/web/src/components/settings/PlannerAiConfigCard.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Wand2, Eye, EyeOff, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { usePlannerAiConfig, useUpsertPlannerAiConfig } from '@/hooks/usePlannerAiConfig';

const POPULAR_MODELS = [
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'anthropic/claude-opus-4', label: 'Claude Opus 4' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'openai/gpt-4.1', label: 'GPT-4.1' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
];

interface Props {
  projectId: string;
  canManage: boolean;
}

export function PlannerAiConfigCard({ projectId, canManage }: Props) {
  const { data: config } = usePlannerAiConfig(projectId);
  const upsert = useUpsertPlannerAiConfig(projectId);

  const [model, setModel] = useState('anthropic/claude-sonnet-4');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setModel(config.model);
      setApiKey('');
      setInitialized(true);
    }
  }, [config, initialized]);

  const handleSave = () => {
    upsert.mutate({
      provider: 'openrouter',
      model,
      apiKey: apiKey || (config?.apiKey ?? ''),
    });
    setInitialized(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wand2 className="size-5 text-blue-500" />
          <CardTitle>Planner AI (OpenRouter)</CardTitle>
        </div>
        <CardDescription>
          Configure OpenRouter as the AI provider for the Project Planner.
          Falls back to the general AI configuration if not set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Model</Label>
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="w-full justify-between font-normal"
                disabled={!canManage}
              >
                {model || 'Select a model...'}
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput
                  placeholder="Search or type model slug..."
                  value={model}
                  onValueChange={setModel}
                />
                <CommandList>
                  <CommandEmpty>
                    <span className="text-xs text-muted-foreground">
                      Using custom model: <strong>{model}</strong>
                    </span>
                  </CommandEmpty>
                  <CommandGroup heading="Popular models">
                    {POPULAR_MODELS.map((m) => (
                      <CommandItem
                        key={m.value}
                        value={m.value}
                        onSelect={(value) => {
                          setModel(value);
                          setComboOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            model === m.value ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <span className="flex-1">{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.value}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="plannerApiKey">API Key</Label>
          <div className="relative">
            <Input
              id="plannerApiKey"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.apiKey || 'Enter OpenRouter API key'}
              disabled={!canManage}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {canManage && (
          <Button
            onClick={handleSave}
            disabled={upsert.isPending || !model.trim()}
            size="sm"
          >
            {upsert.isPending ? 'Saving...' : 'Save Planner AI Settings'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/settings/PlannerAiConfigCard.tsx
git commit -m "feat(planner-ai-config): add PlannerAiConfigCard settings component"
```

---

### Task 10: Frontend — Render Card in Settings Page

**Files:**
- Modify: `apps/web/src/pages/ProjectSettingsPage.tsx:16` (import) and `:232` (render)

- [ ] **Step 1: Add import**

In `apps/web/src/pages/ProjectSettingsPage.tsx`, after line 16 (`import { AiConfigCard }`), add:

```typescript
import { PlannerAiConfigCard } from '@/components/settings/PlannerAiConfigCard';
```

- [ ] **Step 2: Render the card after AiConfigCard**

In `apps/web/src/pages/ProjectSettingsPage.tsx`, after line 232 (`<AiConfigCard projectId={projectId} canManage={canManage} />`), add:

```tsx

          {/* Planner AI (OpenRouter) Card */}
          <PlannerAiConfigCard projectId={projectId} canManage={canManage} />
```

- [ ] **Step 3: Verify frontend compiles**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ProjectSettingsPage.tsx
git commit -m "feat(settings): render PlannerAiConfigCard in project settings"
```
