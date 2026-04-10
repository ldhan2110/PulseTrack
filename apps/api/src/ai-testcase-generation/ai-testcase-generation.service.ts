// apps/api/src/ai-testcase-generation/ai-testcase-generation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';
import type { GeneratedTestCase, TestCaseGenerationJobResult } from './dto/generate-testcases.dto';

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

const SYSTEM_PROMPT = `You are a QA Engineer assistant for a project management tool.
Generate test cases as structured JSON based on the provided user stories and instructions.

## CRITICAL: Output Completeness
You MUST return a complete, valid JSON response. Do not stop mid-output.
If the request is large, generate fewer but complete test cases rather than many incomplete ones.

## Test Case Design Principles
- Generate positive, negative, and edge-case test scenarios per user story
- Use acceptance criteria as the primary source for test coverage
- Keep test cases atomic — one scenario per test case
- Follow Given/When/Then thinking for step generation
- Include boundary value testing where applicable
- Cover error states and validation scenarios

## Title Format
Generate clean, descriptive test case titles. Do NOT include IDs or prefixes.
Example good title: "Valid email and password login succeeds"
Example bad title: "TC-001: Valid email and password login succeeds"

## Priority
CRITICAL — data loss or security risk if this fails
HIGH — core feature broken if this fails
MEDIUM — important but non-blocking
LOW — nice-to-have, cosmetic, minor UX

## Output Format
Return ONLY valid JSON matching this schema:
{
  "testCases": [
    {
      "title": "string (max 200 chars, descriptive test scenario name)",
      "preconditions": "string or null (setup required before test)",
      "expectedResult": "string (overall expected outcome of the test)",
      "priority": "CRITICAL | HIGH | MEDIUM | LOW",
      "estimatedMinutes": "number or null (estimated execution time in minutes)",
      "tags": ["string (relevant tags like 'regression', 'smoke', 'security')"],
      "suggestedModule": "string (best-fitting module name from the available modules list)",
      "sourceTaskTitle": "string (the user story title this test case was derived from)",
      "steps": [
        {
          "position": 1,
          "action": "string (what the tester does)",
          "expectedResult": "string (what should happen)"
        }
      ]
    }
  ]
}`;

const STEPS_ADDENDUM = `
Include detailed test steps for each test case. Each step should have:
- A clear action describing what the tester does
- An expected result describing what should happen after the action
Order steps logically. Typically 3-8 steps per test case.`;

const NO_STEPS_ADDENDUM = `
Do NOT include "steps" in the output. Generate only the test case metadata (title, preconditions, expectedResult, priority, tags, etc.) without step-by-step instructions.`;

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
export class AiTestCaseGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProjectAiConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating test cases.');
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

  async fetchTaskContexts(taskIds: string[]): Promise<string> {
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: {
        title: true,
        description: true,
        acceptanceCriteria: true,
        priority: true,
      },
    });

    if (tasks.length === 0) {
      throw new BadRequestException('No tasks found for the provided IDs.');
    }

    return tasks.map((t, i) => {
      const parts = [`### User Story ${i + 1}: ${t.title}`];
      if (t.description) parts.push(`**Description:**\n${t.description}`);
      if (t.acceptanceCriteria) {
        try {
          const criteria = JSON.parse(t.acceptanceCriteria) as { text: string }[];
          const list = criteria.map((c) => `- ${c.text}`).join('\n');
          parts.push(`**Acceptance Criteria:**\n${list}`);
        } catch {
          parts.push(`**Acceptance Criteria:**\n${t.acceptanceCriteria}`);
        }
      }
      if (t.priority) parts.push(`**Priority:** ${t.priority}`);
      return parts.join('\n');
    }).join('\n\n---\n\n');
  }

  async fetchAvailableModules(projectId: string): Promise<string> {
    const modules = await this.prisma.testModule.findMany({
      where: { projectId },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    if (modules.length === 0) return 'No modules defined yet. Use "General" as suggestedModule.';
    return `Available modules: ${modules.map((m) => m.name).join(', ')}`;
  }

  buildGraphPrompt(): string {
    return BUILD_GRAPH_PROMPT;
  }

  buildScanPrompt(userPrompt: string): string {
    return CODE_GRAPH_SCAN_PROMPT.replace('{USER_PROMPT}', userPrompt);
  }

  buildGenerationPrompt(opts: {
    userPrompt: string;
    taskContexts: string;
    moduleList: string;
    projectContext: string | null;
    scanResults: string | null;
    generateSteps: boolean;
  }): string {
    const parts: string[] = [SYSTEM_PROMPT];

    if (opts.generateSteps) {
      parts.push(STEPS_ADDENDUM);
    } else {
      parts.push(NO_STEPS_ADDENDUM);
    }

    parts.push(`\n## Available Test Modules\n${opts.moduleList}`);
    parts.push(`\n## User Stories to Generate Test Cases For\n${opts.taskContexts}`);

    if (opts.projectContext) {
      parts.push(`\n## Project Context\n${opts.projectContext}`);
    }

    if (opts.scanResults) {
      parts.push(`\n## Codebase Scan Results\n${opts.scanResults}`);
    }

    parts.push(`\n## Additional Instructions\n${opts.userPrompt}`);

    return parts.join('\n');
  }

  buildCliArgs(provider: string, model: string, prompt: string, filePaths: string[]): string[] {
    const baseArgs: string[] = [];
    switch (provider) {
      case 'claude':
        baseArgs.push('--dangerously-skip-permissions', '-p', prompt, '--output-format', 'text', '--model', model);
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

  parseAndValidateOutput(raw: string): TestCaseGenerationJobResult {
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

    const result = parsed as TestCaseGenerationJobResult;
    if (!result.testCases || !Array.isArray(result.testCases)) {
      throw new Error('AI output missing "testCases" array');
    }

    for (const tc of result.testCases) {
      this.validateTestCase(tc);
    }

    return result;
  }

  private validateTestCase(tc: GeneratedTestCase): void {
    if (!tc.title || typeof tc.title !== 'string') {
      throw new Error('Test case missing title');
    }
    if (tc.title.length > 200) {
      tc.title = tc.title.slice(0, 200);
    }
    if (!tc.expectedResult || typeof tc.expectedResult !== 'string') {
      tc.expectedResult = '';
    }
    const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'BLOCKER'];
    if (!validPriorities.includes(tc.priority)) {
      tc.priority = 'MEDIUM';
    }
    if (tc.estimatedMinutes !== null && tc.estimatedMinutes !== undefined) {
      tc.estimatedMinutes = Math.max(1, Math.round(tc.estimatedMinutes));
    }
    if (!Array.isArray(tc.tags)) {
      tc.tags = [];
    }
    tc.tags = tc.tags.filter((t: unknown) => typeof t === 'string' && (t as string).trim().length > 0);
    if (!tc.suggestedModule || typeof tc.suggestedModule !== 'string') {
      tc.suggestedModule = 'General';
    }
    if (!tc.sourceTaskTitle || typeof tc.sourceTaskTitle !== 'string') {
      tc.sourceTaskTitle = 'Unknown';
    }
    if (tc.steps) {
      tc.steps = tc.steps.filter(
        (s) => s && typeof s.action === 'string' && typeof s.expectedResult === 'string',
      );
      tc.steps.forEach((s, i) => { s.position = i + 1; });
    }
  }

  async augmentPromptWithFiles(
    prompt: string,
    filePaths: string[],
    provider: string,
  ): Promise<string> {
    if (filePaths.length === 0) return prompt;

    if (provider === 'claude') {
      const fileSection = filePaths.map((p) => `- ${p}`).join('\n');
      return `${prompt}\n\n## Uploaded Reference Documents (read these files)\n${fileSection}`;
    }

    const { readFile } = await import('fs/promises');
    const contents: string[] = [];
    for (const fp of filePaths) {
      try {
        const content = await readFile(fp, 'utf-8');
        contents.push(`### File: ${fp}\n${content}`);
      } catch {
        contents.push(`### File: ${fp}\n[Binary file — cannot extract text]`);
      }
    }
    return `${prompt}\n\n## Uploaded Reference Documents\n${contents.join('\n\n')}`;
  }
}
