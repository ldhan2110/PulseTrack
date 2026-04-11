# Report Settings Feature — Design Spec

## Overview

Add a "Report Settings" card to the Project Settings page (under AI Configuration) that allows users to configure automated project status reports. Reports gather tasks held by each member with their progress, and deliver them via Email and/or Google Chat webhook on a configurable schedule (daily, weekly, or custom multi-day).

## Data Model Changes

### 1. New `progress` field on `Task`

```prisma
progress  Int  @default(0)  // 0-100 percentage
```

- Editable directly via `PATCH /tasks/:taskId`
- Auto-updated when a time log includes a progress value

### 2. New `progress` field on `TimeLog`

```prisma
progress  Int?  // snapshot of progress at time of logging
```

- Optional field on `CreateTimeLogDto`
- When provided, the task's `progress` is updated in the same transaction

### 3. New `ReportConfig` model

```prisma
model ReportConfig {
  id                   String   @id @default(cuid())
  projectId            String   @unique

  // Channels
  emailEnabled         Boolean  @default(false)
  googleChatEnabled    Boolean  @default(false)
  googleChatWebhookUrl String?  // AES-256-GCM encrypted

  // Recipients (for email)
  recipientMode        String   @default("all")   // "all" | "roles" | "members"
  recipientRoles       String[] @default([])       // role IDs when mode = "roles"
  recipientMembers     String[] @default([])       // member IDs when mode = "members"

  // Schedule
  frequency            String   @default("daily")  // "daily" | "weekly" | "custom"
  scheduleDays         Int[]    @default([])        // 0=Sun..6=Sat (for weekly/custom)
  scheduleTime         String   @default("09:00")  // HH:mm
  timezone             String                       // default from server timezone at creation

  // State
  isActive             Boolean  @default(false)
  bullmqJobId          String?  // track repeatable job for cleanup

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  project              Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

### 4. Add relation on `Project`

```prisma
reportConfig    ReportConfig?
```

## Backend Architecture

### New Modules

#### `ReportConfigModule` — CRUD for report settings

- **`report-config.controller.ts`**
  - `GET /projects/:projectId/report-config` — fetch config (or null)
  - `PUT /projects/:projectId/report-config` — upsert config + manage BullMQ job
- **`report-config.service.ts`**
  - `getConfig(projectId)` — returns config or null
  - `upsertConfig(projectId, dto)` — saves config, encrypts webhook URL, registers/updates BullMQ repeatable job (or removes it if `isActive=false`)
  - Cron pattern generation: daily → `0 9 * * *`, weekly Mon → `0 9 * * 1`, custom Mon+Thu → `0 9 * * 1,4`
- **`dto/update-report-config.dto.ts`** — validation with class-validator

#### `ReportGeneratorModule` — report generation & delivery

- **`report-generator.service.ts`**
  - `generate(projectId)` — queries tasks + members, builds report content
  - Query: all non-draft tasks with assignees where `progress < 100` OR task's workflow status was set to a "closed" status today (appears once, then drops off)
  - Groups by member, calculates per-member and overall averages
  - Returns structured report data
- **`report-generator.processor.ts`**
  - BullMQ processor registered on `report-generation` queue
  - On trigger: calls `generate()`, then delivers via enabled channels
  - Saves report to existing `Report` model for history
- **`delivery/email-delivery.service.ts`**
  - Resolves recipients based on `recipientMode` (all/roles/members)
  - Sends HTML-formatted email using existing email infrastructure
- **`delivery/google-chat-delivery.service.ts`**
  - Decrypts webhook URL
  - POSTs a Google Chat card message via the webhook

### BullMQ Job Management

When a report config is saved with `isActive=true`:
1. Remove any existing repeatable job (using stored `bullmqJobId`)
2. Build cron pattern from `frequency`, `scheduleDays`, `scheduleTime`
3. Register new repeatable job with timezone support
4. Store the new job ID in `reportConfig.bullmqJobId`

When `isActive=false`:
1. Remove the repeatable job
2. Clear `bullmqJobId`

### Progress Update Flow

- `PATCH /projects/:projectId/tasks/:taskId` — accepts `progress` (0-100) directly in `UpdateTaskDto`
- `POST /projects/:projectId/tasks/:taskId/time-logs` — `CreateTimeLogDto` gets optional `progress` field. When provided, both the time log is created and `task.progress` is updated in the same Prisma transaction

### Timezone Handling

- Default timezone is detected from the server machine at config creation time using `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Stored per-project in `ReportConfig.timezone`
- Passed to BullMQ repeatable job options for correct scheduling

## Report Format

### Structure (Format C: Member Grouped + Overview Summary)

```
📊 Daily Report — {ProjectName} ({Date})

📈 Overview
   Tasks: {count} · Members: {count} · Avg Progress: {avg}%
   Done: {n} · In Progress: {n} · In Review: {n} · ...

👤 {MemberName} — Avg: {avg}%
   • {TaskKey} {Title} ({StatusName}) {Progress}%
   • {TaskKey} {Title} ({StatusName}) {Progress}%

👤 {MemberName} — Avg: {avg}%
   • {TaskKey} {Title} ({StatusName}) {Progress}%
```

### Filtering Rules

- Include tasks where `progress < 100` (actively in progress)
- Include tasks completed today (workflow status is "closed" AND `actualEndDate` = today)
- Exclude tasks completed before today — they drop off the next report
- Exclude draft tasks (`isDraft = true`)
- Only include tasks that have an assignee

### Email Format

HTML-formatted version of the above with styled tables, colored status badges, and progress bars.

### Google Chat Format

Google Chat Card v2 message with sections for overview and each member. Uses the webhook URL to POST the card JSON.

## Frontend

### New Component: `ReportSettingsCard`

**File:** `apps/web/src/components/settings/ReportSettingsCard.tsx`

**Props:** `{ projectId: string; canManage: boolean }`

**Layout:**
1. **Card header** — "Report Settings" with a FileText icon
2. **Active toggle** — enable/disable the entire report schedule
3. **Channels section:**
   - Email toggle → when enabled, shows recipient mode selector:
     - "All Members" — no additional config
     - "By Roles" — multi-select role picker (from project's custom roles)
     - "Specific Members" — multi-select member picker
   - Google Chat toggle → when enabled, shows webhook URL input
4. **Schedule section:**
   - Frequency: Daily / Weekly / Custom (radio or select)
   - Day picker: shown for Weekly (single day) and Custom (multi-day checkboxes Mon-Sun)
   - Time picker: HH:mm input
   - Timezone: displayed as read-only (from server)
5. **Save button**

### New Hook: `useReportConfig`

**File:** `apps/web/src/hooks/useReportConfig.ts`

- `useReportConfig(projectId)` — `GET /projects/:projectId/report-config`
- `useUpsertReportConfig(projectId)` — `PUT /projects/:projectId/report-config`

### Page Integration

**File:** `apps/web/src/pages/ProjectSettingsPage.tsx`

Add `<ReportSettingsCard projectId={projectId} canManage={canManage} />` after the `<AiConfigCard />` component.

## API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:projectId/report-config` | Fetch report config |
| PUT | `/projects/:projectId/report-config` | Upsert report config |
| GET | `/projects/:projectId/server-timezone` | Get server timezone |

## Files to Create/Modify

### New Files
- `apps/api/src/report-config/report-config.module.ts`
- `apps/api/src/report-config/report-config.controller.ts`
- `apps/api/src/report-config/report-config.service.ts`
- `apps/api/src/report-config/dto/update-report-config.dto.ts`
- `apps/api/src/report-generator/report-generator.module.ts`
- `apps/api/src/report-generator/report-generator.service.ts`
- `apps/api/src/report-generator/report-generator.processor.ts`
- `apps/api/src/report-generator/delivery/email-delivery.service.ts`
- `apps/api/src/report-generator/delivery/google-chat-delivery.service.ts`
- `apps/web/src/components/settings/ReportSettingsCard.tsx`
- `apps/web/src/hooks/useReportConfig.ts`

### Modified Files
- `apps/api/prisma/schema.prisma` — add `progress` to Task, `progress` to TimeLog, new `ReportConfig` model, relation on Project
- `apps/api/src/tasks/dto/update-task.dto.ts` — add `progress` field
- `apps/api/src/time-logs/dto/create-time-log.dto.ts` — add optional `progress` field
- `apps/api/src/time-logs/time-logs.service.ts` — update task progress in transaction
- `apps/api/src/app.module.ts` — register new modules
- `apps/web/src/pages/ProjectSettingsPage.tsx` — add ReportSettingsCard
- `apps/web/src/lib/types.ts` — add ReportConfig type (if types file exists)
