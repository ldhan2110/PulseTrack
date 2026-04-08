# Code Graph Integration for AI Task Generation

**Date:** 2026-04-08
**Status:** Approved

## Problem

When "Scan Codebase" is enabled, the AI scan step uses a vague prompt that doesn't leverage the code-review-graph MCP tools effectively. There's no guarantee the knowledge graph exists or is up-to-date before scanning. This leads to generic scan results that don't reflect the actual codebase structure.

## Solution

Add a "Build Code Graph" pre-step after `git pull` (only when scanCodebase is enabled), then rewrite the scan and generation prompts to explicitly use the graph's MCP tools for accurate, structure-aware task generation.

## Flow

```
[scanCodebase = false]: git pull → Generate Tasks → Parse
[scanCodebase = true]:  git pull → Build Code Graph → Scan with Code Graph → Generate Tasks → Parse
```

## Changes

### 1. `ai-task-generation.processor.ts`

Add a new step inside the existing `if (scanCodebase)` block, between `git pull` and the scan step:

```
if (scanCodebase) {
  // NEW: Step 2 — Build/update code graph
  currentStep = 'building-graph';
  emitStep(userId, job, 'building-graph');
  emitStream(`$ ${config.cli} (building code graph)\n`);

  const graphPrompt = this.aiService.buildGraphPrompt();
  const graphArgs = this.aiService.buildCliArgs(config.provider, config.model, graphPrompt, []);
  const graphEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

  await this.runCliStreaming(config.cli, graphArgs, {
    cwd: config.workspacePath,
    timeout: 300_000, // 5 min — graph build can be slow on large repos
    env: { ...process.env, ...graphEnv },
  }, job.id, emitStream);

  emitStream('\n');

  // Step 3 — Scan with code graph (existing, with rewritten prompt)
  currentStep = 'scanning';
  ...
}
```

### 2. `ai-task-generation.service.ts`

#### New method: `buildGraphPrompt()`

```typescript
buildGraphPrompt(): string {
  return BUILD_GRAPH_PROMPT;
}
```

#### New constant: `BUILD_GRAPH_PROMPT`

```
You have access to the code-review-graph MCP server. Perform these steps:

1. Run `build_or_update_graph_tool` to build or update the knowledge graph for this repository.
2. Run `embed_graph_tool` to enable semantic search on the graph.
3. Run `list_graph_stats_tool` and report the stats.

Do not do anything else. Just build the graph and report the result.
```

#### Rewrite: `CODE_GRAPH_SCAN_PROMPT`

Replace the current vague prompt with explicit MCP tool instructions:

```
You have access to the code-review-graph MCP server with a freshly built knowledge graph for this repository.

Analyze the codebase for areas related to:
"{USER_PROMPT}"

Use these tools in order:
1. `semantic_search_nodes_tool` — find relevant functions, classes, and types by keyword
2. `query_graph_tool` with patterns `callers_of`, `callees_of`, `imports_of` — trace relationships between found nodes
3. `get_architecture_overview_tool` — get high-level module structure
4. `list_communities_tool` — identify which modules/domains are involved

Return a structured summary with these sections:
- **Relevant Files**: file paths and their purpose
- **Key Functions/Classes**: names, signatures, what they do
- **Architecture**: how the affected area is structured
- **Patterns**: existing conventions new code should follow
- **Dependencies**: what the affected code depends on or what depends on it

Keep the summary concise and focused on what's relevant to the request.
```

#### Update: `SYSTEM_PROMPT` — add scan results guidance

Add to the description format section (after the existing "Reference relevant code areas inline if codebase scan results are provided." line):

```
When codebase scan results are provided, use them to make tasks implementation-aware:
- Reference specific files, functions, and modules in descriptions
- Align task boundaries with the actual code architecture
- Note existing patterns that implementation should follow
- Flag dependencies or constraints discovered in the scan
```

### 3. `GenerateTasksModal.tsx`

#### Update `STEP_LABELS`

Add:
```typescript
'building-graph': 'Building code knowledge graph...',
```

#### Update `STEP_PROGRESS`

```typescript
queued: 10,
pulling: 20,
'building-graph': 35,
scanning: 50,
generating: 72,
parsing: 90,
```

### 4. `types.ts`

Add `'building-graph'` to the `AiGenerationStep` type if it's an explicit union type.

## Gating

All new behavior is gated by the existing `scanCodebase` boolean. When the user does not tick "Scan Codebase":
- No graph build step
- No scan step
- Generation prompt has no scan results section
- No change to existing behavior

## Timeouts

- Graph build: 300,000ms (5 minutes) — large repos can take time
- Scan: 300,000ms (5 minutes) — unchanged
- Generation: 600,000ms (10 minutes) — unchanged
