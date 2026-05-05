import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';
import type { AiFixAnalysis } from './dto/ai-fix-job.dto';

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

const IN_PROGRESS_STATUSES = ['queued', 'preparing', 'fixing', 'pushing', 'creating-mr'];

@Injectable()
export class AiBugFixService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
  }

  async getProjectAiConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before AI fix.');
    }

    const apiKey = decrypt(aiConfig.apiKey, this.encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      projectContext: aiConfig.projectContext,
      workspacePath: repoConfig.workspacePath!,
      repoUrl: repoConfig.repoUrl,
      repoProvider: repoConfig.provider,
      repoToken: decrypt(repoConfig.accessToken, this.encryptionKey),
      cli: CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider,
    };
  }

  async assertNotInProgress(bugId: string): Promise<void> {
    const existing = await this.prisma.aiBugFix.findFirst({
      where: { bugId, status: { in: IN_PROGRESS_STATUSES } },
    });
    if (existing) {
      throw new ConflictException('AI fix already in progress for this bug.');
    }
  }

  async getNextAttempt(bugId: string): Promise<number> {
    const count = await this.prisma.aiBugFix.count({ where: { bugId } });
    return count + 1;
  }

  async createRecord(data: {
    bugId: string;
    projectId: string;
    requesterId: string;
    targetBranch: string;
    guidance: string | null;
    includeTests: boolean;
    attempt: number;
  }) {
    return this.prisma.aiBugFix.create({ data });
  }

  async updateRecord(fixId: string, data: Record<string, unknown>) {
    return this.prisma.aiBugFix.update({ where: { id: fixId }, data });
  }

  async findFixes(bugId: string) {
    return this.prisma.aiBugFix.findMany({
      where: { bugId },
      orderBy: { attempt: 'desc' },
      include: { requester: { select: { id: true, name: true, username: true, imageUrl: true } } },
    });
  }

  async findFix(fixId: string) {
    return this.prisma.aiBugFix.findUniqueOrThrow({
      where: { id: fixId },
      include: { requester: { select: { id: true, name: true, username: true, imageUrl: true } } },
    });
  }

  async findFixRecord(fixId: string) {
    return this.prisma.aiBugFix.findUniqueOrThrow({ where: { id: fixId } });
  }

  async deleteRecord(fixId: string) {
    const record = await this.prisma.aiBugFix.findUniqueOrThrow({ where: { id: fixId } });
    if (IN_PROGRESS_STATUSES.includes(record.status)) {
      throw new ConflictException('Cannot delete an in-progress fix. Cancel it first.');
    }
    await this.prisma.aiBugFix.delete({ where: { id: fixId } });
    return { deleted: true };
  }

  async fetchBugWithRelations(bugId: string) {
    return this.prisma.bug.findUniqueOrThrow({
      where: { id: bugId },
      include: {
        reproSteps: { orderBy: { position: 'asc' } },
        attachments: true,
        project: { select: { prefix: true } },
      },
    });
  }

  async fetchLinkedTestCases(bugId: string) {
    const links = await this.prisma.testCaseLink.findMany({
      where: { entityType: 'BUG', entityId: bugId },
      include: {
        testCase: {
          include: {
            steps: { orderBy: { position: 'asc' } },
          },
        },
      },
    });
    return links.map((l) => l.testCase);
  }

  async fetchPreviousAttempts(bugId: string) {
    return this.prisma.aiBugFix.findMany({
      where: { bugId, status: { in: ['completed', 'failed'] } },
      orderBy: { attempt: 'asc' },
      select: { attempt: true, rootCause: true, solution: true, guidance: true },
    });
  }

  buildPrompt(opts: {
    bug: Awaited<ReturnType<AiBugFixService['fetchBugWithRelations']>>;
    testCases: Awaited<ReturnType<AiBugFixService['fetchLinkedTestCases']>> | null;
    previousAttempts: Awaited<ReturnType<AiBugFixService['fetchPreviousAttempts']>>;
    guidance: string | null;
    projectContext: string | null;
  }): string {
    const { bug, testCases, previousAttempts, guidance, projectContext } = opts;
    const parts: string[] = [];

    parts.push(`You are a senior developer fixing a bug in a codebase.

## Step 1: Build Knowledge Graph
Build or update the code-review-graph for this repository using MCP tools.
Do not do anything else in this step. Just build the graph and report the result.

## Step 2: Analyze with Code Graph
Use semantic_search_nodes_tool, query_graph_tool, get_impact_radius_tool
to understand the area of code related to this bug before making changes.

## Step 3: Fix the Bug
Make minimal, surgical changes. Do not refactor unrelated code.
Commit your changes with clear commit messages.

## Step 4: Output Analysis
After fixing, output EXACTLY this format (no markdown fences):
<ai-fix-analysis>
ROOT_CAUSE: [1-3 sentences explaining why the bug happened]
SOLUTION: [1-3 sentences explaining what you changed and why]
FILES_CHANGED: [comma-separated list of changed files with brief reason]
</ai-fix-analysis>`);

    // Bug details
    parts.push(`\n## Bug Details
Title: ${bug.title}
Severity: ${bug.severity}
Key: ${bug.bugKey ?? 'N/A'}`);

    if (bug.description) parts.push(`Description: ${bug.description}`);
    if (bug.expectedResult) parts.push(`Expected Result: ${bug.expectedResult}`);
    if (bug.actualResult) parts.push(`Actual Result: ${bug.actualResult}`);
    if (bug.preconditions) parts.push(`Preconditions: ${bug.preconditions}`);
    if (bug.environment) parts.push(`Environment: ${bug.environment}`);

    // Repro steps
    if (bug.reproSteps.length > 0) {
      parts.push('\n## Reproduction Steps');
      for (const step of bug.reproSteps) {
        parts.push(`${step.position}. ${step.content}`);
      }
    }

    // Attachments
    if (bug.attachments.length > 0) {
      parts.push('\n## Attachments');
      for (const att of bug.attachments) {
        parts.push(`- ${att.filename} (${att.mimeType})`);
      }
    }

    // Linked test cases
    if (testCases && testCases.length > 0) {
      parts.push('\n## Linked Test Cases (verify fix satisfies these)');
      for (const tc of testCases) {
        parts.push(`\n### TC: ${tc.title}`);
        if (tc.preconditions) parts.push(`Preconditions: ${tc.preconditions}`);
        if (tc.steps.length > 0) {
          parts.push('Steps:');
          for (const s of tc.steps) {
            parts.push(`${s.position}. Action: ${s.action} → Expected: ${s.expectedResult}`);
          }
        }
      }
    }

    // Previous attempts
    if (previousAttempts.length > 0) {
      parts.push('\n## Previous Attempts (user was not satisfied)');
      for (const pa of previousAttempts) {
        parts.push(`\nAttempt ${pa.attempt}:`);
        if (pa.rootCause) parts.push(`  Root cause: ${pa.rootCause}`);
        if (pa.solution) parts.push(`  Solution: ${pa.solution}`);
        if (pa.guidance) parts.push(`  User feedback: ${pa.guidance}`);
      }
    }

    // Guidance
    if (guidance) {
      parts.push(`\n## Additional Guidance from Developer\n${guidance}`);
    }

    // Project context
    if (projectContext) {
      parts.push(`\n## Project Context\n${projectContext}`);
    }

    return parts.join('\n');
  }

  buildCliArgs(provider: string, model: string, prompt: string): string[] {
    switch (provider) {
      case 'claude':
        return ['--dangerously-skip-permissions', '-p', prompt, '--output-format', 'text', '--model', model];
      case 'gemini':
        return ['-p', prompt, '--model', model];
      case 'codex':
        return ['-p', prompt, '--model', model];
      default:
        return ['-p', prompt];
    }
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

  parseAnalysis(raw: string): AiFixAnalysis {
    const match = raw.match(/<ai-fix-analysis>([\s\S]*?)<\/ai-fix-analysis>/);
    if (!match) {
      return { rootCause: null, solution: null, filesChanged: null };
    }

    const block = match[1];
    const extract = (key: string): string | null => {
      const m = block.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 's'));
      return m ? m[1].trim() : null;
    };

    return {
      rootCause: extract('ROOT_CAUSE'),
      solution: extract('SOLUTION'),
      filesChanged: extract('FILES_CHANGED'),
    };
  }

  buildMrDescription(bug: { bugKey: string | null; title: string }, analysis: AiFixAnalysis): string {
    const lines: string[] = [];

    if (analysis.rootCause) {
      lines.push('## Root Cause', analysis.rootCause, '');
    }
    if (analysis.solution) {
      lines.push('## Solution', analysis.solution, '');
    }
    if (analysis.filesChanged) {
      lines.push('## Files Changed', analysis.filesChanged, '');
    }

    lines.push('## Bug Reference', `${bug.bugKey ?? 'N/A'}: ${bug.title}`);

    if (!analysis.rootCause && !analysis.solution) {
      return `## AI Bug Fix\nAutomated fix for ${bug.bugKey}: ${bug.title}\nAI analysis not available — review changes manually.`;
    }

    return lines.join('\n');
  }

  generateBranchName(bugKey: string | null, title: string, attempt: number): string {
    const slug = this.slugify(title);
    const key = bugKey ?? 'bug';
    const suffix = attempt > 1 ? `-${attempt}` : '';
    return `fix/${key}-${slug}${suffix}`;
  }
}
