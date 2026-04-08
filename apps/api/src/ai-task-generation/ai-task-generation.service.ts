// apps/api/src/ai-task-generation/ai-task-generation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';
import type { GeneratedTask, GenerationJobResult } from './dto/generate-tasks.dto';

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

const SYSTEM_PROMPT = `You are a Business Analyst assistant for a project management tool.
Generate tasks as structured JSON based on the user's request.

## CRITICAL: Output Completeness
You MUST return a complete, valid JSON response. Do not stop mid-output.
Keep descriptions concise so you can finish the entire response.
If the request is large, generate fewer but complete tasks rather than many incomplete ones.

## Title Format
Generate clean, descriptive task titles only. Do NOT include task IDs, prefixes, numbering, or codes (e.g., "HRM-1:", "TASK-001:") in titles. The system assigns task IDs automatically.
Example good title: "Implement user authentication with JWT"
Example bad title: "HRM-1: Implement user authentication with JWT"

## Task Description Format
Generate the description as structured HTML with these sections:
<h4>User Story</h4> — "As a [role], I want [capability], so that [business value]"
<h4>Precondition</h4> — What must be true before this task starts (<ul><li> bullet list)
<h4>Given</h4> — The initial state or context (<ul><li> bullet list)
<h4>When</h4> — The action or trigger (<ul><li> bullet list)
<h4>Then</h4> — The expected outcome (<ul><li> bullet list)

Use HTML tags for formatting. Keep each bullet concise (1 sentence max).
Omit any section that is not applicable. Always include User Story and Then.
Reference relevant code areas inline if codebase scan results are provided.
When codebase scan results are provided, use them to make tasks implementation-aware:
- Reference specific files, functions, and modules in descriptions
- Align task boundaries with the actual code architecture
- Note existing patterns that implementation should follow
- Flag dependencies or constraints discovered in the scan

## Acceptance Criteria Format
Return acceptance criteria as an array of 2-5 individual testable statements.
Each criterion must be a single verifiable assertion that can independently pass or fail.
Example: ["Valid email and password returns 200 with JWT token", "Invalid credentials return 401 with generic error message"]
Do NOT return a paragraph. Return a JSON array of short, specific strings.

## Priority: CRITICAL (blocks other work / security), HIGH (core functionality), MEDIUM (important, not blocking), LOW (nice-to-have)

## Story Points (Fibonacci): 1, 2, 3, 5, 8, 13 — base on complexity, not time.

## Output Format
Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "title": "string (max 200 chars, NO task IDs or prefixes)",
      "description": "string (structured HTML with User Story, Precondition, Given, When, Then sections)",
      "acceptanceCriteria": ["string (testable assertion)", "string (testable assertion)"],
      "priority": "CRITICAL | HIGH | MEDIUM | LOW",
      "storyPoints": "number (1 | 2 | 3 | 5 | 8 | 13)",
      "subTasks": []
    }
  ]
}`;

const SUB_TASK_ADDENDUM = `
When generating sub-tasks, include them in the "subTasks" array of their parent task.
Sub-tasks follow the same schema but WITHOUT their own subTasks array.
Break each parent task into 2-5 focused sub-tasks that together deliver the parent's scope.`;

const NO_SUB_TASK_ADDENDUM = `
Do NOT include "subTasks" in the output. Generate only top-level tasks.`;

const BUILD_GRAPH_PROMPT = `Build or update the knowledge graph for this repository using the code-review-graph skills installed.
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

@Injectable()
export class AiTaskGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProjectAiConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating tasks.');
    }

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      projectContext: aiConfig.projectContext,
      workspacePath: repoConfig.workspacePath!,
      cli: CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider,
    };
  }

  buildGraphPrompt(): string {
    return BUILD_GRAPH_PROMPT;
  }

  buildScanPrompt(userPrompt: string): string {
    return CODE_GRAPH_SCAN_PROMPT.replace('{USER_PROMPT}', userPrompt);
  }

  buildGenerationPrompt(opts: {
    userPrompt: string;
    projectContext: string | null;
    scanResults: string | null;
    breakIntoSubTasks: boolean;
  }): string {
    const parts: string[] = [SYSTEM_PROMPT];

    if (opts.breakIntoSubTasks) {
      parts.push(SUB_TASK_ADDENDUM);
    } else {
      parts.push(NO_SUB_TASK_ADDENDUM);
    }

    if (opts.projectContext) {
      parts.push(`\n## Project Context\n${opts.projectContext}`);
    }

    if (opts.scanResults) {
      parts.push(`\n## Codebase Scan Results\n${opts.scanResults}`);
    }

    parts.push(`\n## User Request\n${opts.userPrompt}`);

    return parts.join('\n');
  }

  buildCliArgs(provider: string, model: string, prompt: string, filePaths: string[]): string[] {
    const baseArgs: string[] = [];

    switch (provider) {
      case 'claude':
        baseArgs.push('--dangerously-skip-permissions','-p', prompt, '--output-format', 'text', '--model', model);
        // Claude Code can read files passed in the prompt by referencing paths
        break;
      case 'gemini':
        baseArgs.push('-p', prompt, '--model', model);
        break;
      case 'codex':
        baseArgs.push('-p', prompt, '--model', model);
        break;
      default:
        baseArgs.push('-p', prompt);
    }

    return baseArgs;
  }

  buildCliEnv(provider: string, apiKey: string): Record<string, string> {
    switch (provider) {
      case 'claude':
        return { CLAUDE_CODE_OAUTH_TOKEN: apiKey };
      case 'gemini':
        return { GEMINI_API_KEY: apiKey };
      case 'codex':
        return { OPENAI_API_KEY: apiKey };
      default:
        return {};
    }
  }

  parseAndValidateOutput(raw: string): GenerationJobResult {
    // Extract JSON from the response — AI may wrap it in markdown code blocks
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error('AI returned invalid JSON. Raw output: ' + raw.slice(0, 500));
    }

    const result = parsed as GenerationJobResult;
    if (!result.tasks || !Array.isArray(result.tasks)) {
      throw new Error('AI output missing "tasks" array');
    }

    // Validate each task
    for (const task of result.tasks) {
      this.validateTask(task);
      if (task.subTasks) {
        for (const sub of task.subTasks) {
          this.validateTask(sub);
        }
      }
    }

    return result;
  }

  private validateTask(task: GeneratedTask): void {
    if (!task.title || typeof task.title !== 'string') {
      throw new Error('Task missing title');
    }
    if (task.title.length > 200) {
      task.title = task.title.slice(0, 200);
    }
    if (!task.description || typeof task.description !== 'string') {
      throw new Error(`Task "${task.title}" missing description`);
    }
    if (!task.acceptanceCriteria || !Array.isArray(task.acceptanceCriteria)) {
      throw new Error(`Task "${task.title}" missing acceptance criteria`);
    }
    task.acceptanceCriteria = task.acceptanceCriteria
      .filter((c: unknown) => typeof c === 'string' && (c as string).trim().length > 0)
      .map((c: string) => c.trim());
    if (task.acceptanceCriteria.length === 0) {
      throw new Error(`Task "${task.title}" has no valid acceptance criteria`);
    }
    const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    if (!validPriorities.includes(task.priority)) {
      task.priority = 'MEDIUM';
    }
    const validPoints = [1, 2, 3, 5, 8, 13];
    if (!validPoints.includes(task.storyPoints)) {
      // Find nearest valid value
      task.storyPoints = validPoints.reduce((prev, curr) =>
        Math.abs(curr - task.storyPoints) < Math.abs(prev - task.storyPoints) ? curr : prev,
      );
    }
  }

  /**
   * For non-Claude providers, read uploaded files and append their content to the prompt.
   * Claude Code can read files from the filesystem directly via path references in the prompt.
   */
  async augmentPromptWithFiles(
    prompt: string,
    filePaths: string[],
    provider: string,
  ): Promise<string> {
    if (filePaths.length === 0) return prompt;

    if (provider === 'claude') {
      // Claude can read files directly — just reference paths
      const fileSection = filePaths.map((p) => `- ${p}`).join('\n');
      return `${prompt}\n\n## Uploaded Reference Documents (read these files)\n${fileSection}`;
    }

    // For other providers, read file contents and inject into prompt
    const { readFile } = await import('fs/promises');
    const contents: string[] = [];
    for (const fp of filePaths) {
      try {
        const content = await readFile(fp, 'utf-8');
        contents.push(`### File: ${fp}\n${content}`);
      } catch {
        // Skip binary files or unreadable files
        contents.push(`### File: ${fp}\n[Binary file — cannot extract text]`);
      }
    }
    return `${prompt}\n\n## Uploaded Reference Documents\n${contents.join('\n\n')}`;
  }
}
