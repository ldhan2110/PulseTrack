# Code Graph Integration for Task Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When "Scan Codebase" is enabled, build the code-review-graph before scanning and use explicit MCP tool instructions in prompts for accurate, structure-aware task generation.

**Architecture:** New `building-graph` step inserted into the existing scanCodebase conditional in the processor. Service gets a new `buildGraphPrompt()` method and rewritten scan/generation prompts. Frontend gets the new step label and progress value.

**Tech Stack:** NestJS (processor + service), React (modal UI), TypeScript types

---

### Task 1: Add `building-graph` to the AiGenerationStep type

**Files:**
- Modify: `apps/web/src/lib/types.ts:486`

- [ ] **Step 1: Add the new step to the union type**

In `apps/web/src/lib/types.ts`, change line 486 from:

```typescript
export type AiGenerationStep = 'pulling' | 'scanning' | 'generating' | 'parsing';
```

to:

```typescript
export type AiGenerationStep = 'pulling' | 'building-graph' | 'scanning' | 'generating' | 'parsing';
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(ai-gen): add building-graph to AiGenerationStep type"
```

---

### Task 2: Add `buildGraphPrompt()` and rewrite prompts in the service

**Files:**
- Modify: `apps/api/src/ai-task-generation/ai-task-generation.service.ts`

- [ ] **Step 1: Replace the `CODE_GRAPH_SCAN_PROMPT` constant**

In `apps/api/src/ai-task-generation/ai-task-generation.service.ts`, replace the existing `CODE_GRAPH_SCAN_PROMPT` (lines 72–81):

```typescript
const BUILD_GRAPH_PROMPT = `You have access to the code-review-graph MCP server. Perform these steps:

1. Run build_or_update_graph_tool to build or update the knowledge graph for this repository.
2. Run embed_graph_tool to enable semantic search on the graph.
3. Run list_graph_stats_tool and report the stats.

Do not do anything else. Just build the graph and report the result.`;

const CODE_GRAPH_SCAN_PROMPT = `You have access to the code-review-graph MCP server with a freshly built knowledge graph for this repository.

Analyze the codebase for areas related to:
"{USER_PROMPT}"

Use these tools in order:
1. semantic_search_nodes_tool — find relevant functions, classes, and types by keyword
2. query_graph_tool with patterns callers_of, callees_of, imports_of — trace relationships between found nodes
3. get_architecture_overview_tool — get high-level module structure
4. list_communities_tool — identify which modules/domains are involved

Return a structured summary with these sections:
- Relevant Files: file paths and their purpose
- Key Functions/Classes: names, signatures, what they do
- Architecture: how the affected area is structured
- Patterns: existing conventions new code should follow
- Dependencies: what the affected code depends on or what depends on it

Keep the summary concise and focused on what is relevant to the request.`;
```

- [ ] **Step 2: Add `buildGraphPrompt()` method to the service class**

In the `AiTaskGenerationService` class, add this method after `buildScanPrompt()`:

```typescript
buildGraphPrompt(): string {
  return BUILD_GRAPH_PROMPT;
}
```

- [ ] **Step 3: Update the scan results guidance in `SYSTEM_PROMPT`**

In the `SYSTEM_PROMPT` constant, find the line:

```
Reference relevant code areas inline if codebase scan results are provided.
```

Replace it with:

```
Reference relevant code areas inline if codebase scan results are provided.
When codebase scan results are provided, use them to make tasks implementation-aware:
- Reference specific files, functions, and modules in descriptions
- Align task boundaries with the actual code architecture
- Note existing patterns that implementation should follow
- Flag dependencies or constraints discovered in the scan
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai-task-generation/ai-task-generation.service.ts
git commit -m "feat(ai-gen): add buildGraphPrompt and rewrite scan/generation prompts"
```

---

### Task 3: Add the building-graph step to the processor

**Files:**
- Modify: `apps/api/src/ai-task-generation/ai-task-generation.processor.ts`

- [ ] **Step 1: Insert the graph build step inside the `if (scanCodebase)` block**

In `apps/api/src/ai-task-generation/ai-task-generation.processor.ts`, find the existing `if (scanCodebase)` block (line 157). Replace the entire block (lines 155–174) with:

```typescript
      // Step 2: Build code graph + scan (if requested)
      let scanResults: string | null = null;
      if (scanCodebase) {
        // Step 2a: Build/update the code knowledge graph
        currentStep = 'building-graph';
        this.emitStep(userId, job, 'building-graph');
        emitStream(`$ ${config.cli} (building code graph)\n`);

        const graphPrompt = this.aiService.buildGraphPrompt();
        const graphArgs = this.aiService.buildCliArgs(config.provider, config.model, graphPrompt, []);
        const graphEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

        await this.runCliStreaming(config.cli, graphArgs, {
          cwd: config.workspacePath,
          timeout: 300_000,
          env: { ...process.env, ...graphEnv },
        }, job.id, emitStream);

        emitStream('\n');

        // Step 2b: Scan codebase using the freshly built graph
        currentStep = 'scanning';
        this.emitStep(userId, job, 'scanning');
        emitStream(`$ ${config.cli} (scanning codebase with code-graph)\n`);

        const scanPrompt = this.aiService.buildScanPrompt(prompt);
        const scanArgs = this.aiService.buildCliArgs(config.provider, config.model, scanPrompt, []);
        const scanEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

        const scanOutput = await this.runCliStreaming(config.cli, scanArgs, {
          cwd: config.workspacePath,
          timeout: 300_000,
          env: { ...process.env, ...scanEnv },
        }, job.id, emitStream);

        scanResults = scanOutput.trim();
        emitStream('\n');
      }
```

Note: The `let scanResults` declaration moves up to before the `if` block since the original had it at line 156. The rest of the processor (Step 3: generation, Step 4: parse) remains unchanged.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-task-generation/ai-task-generation.processor.ts
git commit -m "feat(ai-gen): add building-graph step before codebase scan"
```

---

### Task 4: Update the frontend step labels and progress

**Files:**
- Modify: `apps/web/src/components/tasks/GenerateTasksModal.tsx`

- [ ] **Step 1: Add the new step to `STEP_LABELS`**

In `apps/web/src/components/tasks/GenerateTasksModal.tsx`, replace the `STEP_LABELS` constant (lines 18–24) with:

```typescript
const STEP_LABELS: Record<string, string> = {
  queued: 'Queued — waiting for available slot...',
  pulling: 'Pulling latest code...',
  'building-graph': 'Building code knowledge graph...',
  scanning: 'Scanning codebase with code-graph...',
  generating: 'Generating tasks with AI...',
  parsing: 'Parsing results...',
};
```

- [ ] **Step 2: Update `STEP_PROGRESS` values**

Replace the `STEP_PROGRESS` constant (lines 26–32) with:

```typescript
const STEP_PROGRESS: Record<string, number> = {
  queued: 10,
  pulling: 20,
  'building-graph': 35,
  scanning: 50,
  generating: 72,
  parsing: 90,
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/GenerateTasksModal.tsx
git commit -m "feat(ai-gen): add building-graph step label and progress to modal"
```

---

### Task 5: Verify the build compiles

**Files:** None (verification only)

- [ ] **Step 1: Run the frontend TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors. The new `'building-graph'` value is part of `AiGenerationStep` which flows through the hook and modal via the union type.

- [ ] **Step 2: Run the backend TypeScript check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors. The new `buildGraphPrompt()` method is called from the processor which already imports the service.

- [ ] **Step 3: Commit if any fixes were needed**

Only if tsc found issues — fix and commit with:

```bash
git commit -m "fix(ai-gen): resolve type errors from code-graph integration"
```
