// apps/api/src/ai-wbs-generation/ai-wbs-generation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';
import type { WbsGenerationJobResult } from './dto/generate-wbs.dto';

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

const BUILD_GRAPH_PROMPT = `Build or update the knowledge graph for this repository using the code-review-graph skills installed.
Do not do anything else. Just build the graph and report the result.`;

const CODE_GRAPH_SCAN_PROMPT = `You have access to the code-review-graph MCP server with a freshly built knowledge graph for this repository.

Analyze the codebase architecture and structure to help create a realistic Work Breakdown Structure for:
"{USER_PROMPT}"

Use these tools in order:
1. semantic_search_nodes_tool — find relevant functions, classes, and types by keyword
2. query_graph_tool with patterns callers_of, callees_of, imports_of — trace relationships between found nodes
3. get_architecture_overview_tool — get high-level module structure
4. list_communities_tool — identify which modules/domains are involved

Return a structured summary with these sections:
- Architecture Overview: tech stack, frameworks, major modules
- Relevant Modules: which parts of the codebase relate to the requested features
- Key Patterns: existing conventions, coding patterns, folder structure
- Dependencies: external services, databases, APIs the project uses
- Complexity Indicators: large files, deeply nested modules, areas that need careful attention

Keep the summary concise and focused on what helps estimate and break down work accurately.`;

@Injectable()
export class AiWbsGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProjectAiConfig(projectId: string, requireRepo = false) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (requireRepo && (!repoConfig || repoConfig.cloneStatus !== 'cloned')) {
      throw new BadRequestException('Repository must be cloned before scanning codebase.');
    }

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      projectContext: aiConfig.projectContext,
      workspacePath: repoConfig?.workspacePath ?? process.cwd(),
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
    instructions?: string;
    features: string[];
    teamSize?: number;
    teamRoles?: { role: string; count: number }[];
    projectStartDate?: string;
    targetEndDate?: string;
    methodology?: string;
    sprintDuration?: string;
    projectContext: string | null;
    scanResults?: string | null;
    fileContents: string;
  }): string {
    const parts: string[] = [];

    parts.push(`You are a Project Estimation & WBS Specialist. Generate a detailed Work Breakdown Structure (WBS) as structured JSON based on the project information provided.

## CRITICAL: Output Completeness
You MUST return a complete, valid JSON response. Do not stop mid-output.
Keep descriptions concise so you can finish the entire response.

## Output Format
Return ONLY valid JSON matching this schema:
{
  "phases": [
    {
      "title": "string (max 200 chars)",
      "description": "string",
      "planStart": "YYYY-MM-DD or null",
      "planEnd": "YYYY-MM-DD or null",
      "tasks": [
        {
          "title": "string (max 200 chars)",
          "description": "string",
          "planStart": "YYYY-MM-DD or null",
          "planEnd": "YYYY-MM-DD or null",
          "subtasks": [
            {
              "title": "string (max 200 chars)",
              "description": "string",
              "planStart": "YYYY-MM-DD or null",
              "planEnd": "YYYY-MM-DD or null"
            }
          ]
        }
      ]
    }
  ]
}`);

    // Team composition
    if (opts.teamSize || (opts.teamRoles && opts.teamRoles.length > 0)) {
      const teamParts: string[] = [];
      if (opts.teamSize) teamParts.push(`Team Size: ${opts.teamSize} people`);
      if (opts.teamRoles && opts.teamRoles.length > 0) {
        const rolesList = opts.teamRoles.map((r) => `${r.count}x ${r.role}`).join(', ');
        teamParts.push(`Team Composition: ${rolesList}`);
      }
      parts.push(`\n## Team Composition\n${teamParts.join('\n')}`);
    }

    // Constraints
    const constraints: string[] = [];
    if (opts.projectStartDate) constraints.push(`Start Date: ${opts.projectStartDate}`);
    if (opts.targetEndDate) constraints.push(`Target End Date: ${opts.targetEndDate}`);
    if (opts.methodology) constraints.push(`Methodology: ${opts.methodology}`);
    if (opts.sprintDuration) constraints.push(`Sprint Duration: ${opts.sprintDuration}`);
    if (constraints.length > 0) {
      parts.push(`\n## Project Constraints\n${constraints.join('\n')}`);
    }

    // Project context
    if (opts.projectContext) {
      parts.push(`\n## Project Context\n${opts.projectContext}`);
    }

    // Codebase scan results
    if (opts.scanResults) {
      parts.push(`\n## Codebase Analysis\nThe following is a structural analysis of the project codebase. Use this to:\n- Create tasks that align with the actual code architecture\n- Estimate complexity based on real module structure\n- Identify integration points and dependencies\n\n${opts.scanResults}`);
    }

    // Uploaded file contents
    if (opts.fileContents) {
      parts.push(`\n## Uploaded Reference Documents\n${opts.fileContents}`);
    }

    // Features list
    if (opts.features && opts.features.length > 0) {
      parts.push(`\n## Features / Scope\n${opts.features.map((f) => `- ${f}`).join('\n')}`);
    }

    // Additional instructions
    if (opts.instructions) {
      parts.push(`\n## Additional Instructions\n${opts.instructions}`);
    }

    return parts.join('\n');
  }

  buildChatPrompt(
    currentWbs: any[],
    message: string,
    chatHistory?: { role: 'user' | 'assistant'; content: string }[],
  ): string {
    const parts: string[] = [];

    parts.push(`You are a Project Estimation & WBS Specialist helping refine a Work Breakdown Structure (WBS).
The user wants to modify the current WBS. Return the FULL updated WBS as valid JSON.

## CRITICAL
- Return ONLY valid JSON with the same schema as the current WBS.
- Include ALL phases, tasks, and subtasks (both unchanged and modified).
- Do not stop mid-output.

## Output Format
{
  "phases": [
    {
      "title": "string",
      "description": "string",
      "planStart": "YYYY-MM-DD or null",
      "planEnd": "YYYY-MM-DD or null",
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "planStart": "YYYY-MM-DD or null",
          "planEnd": "YYYY-MM-DD or null",
          "subtasks": [
            {
              "title": "string",
              "description": "string",
              "planStart": "YYYY-MM-DD or null",
              "planEnd": "YYYY-MM-DD or null"
            }
          ]
        }
      ]
    }
  ]
}`);

    parts.push(`\n## Current WBS\n\`\`\`json\n${JSON.stringify(currentWbs, null, 2)}\n\`\`\``);

    if (chatHistory && chatHistory.length > 0) {
      const historyText = chatHistory
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
        .join('\n');
      parts.push(`\n## Conversation History\n${historyText}`);
    }

    parts.push(`\n## User Request\n${message}`);

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

  parseAndValidateOutput(raw: string): WbsGenerationJobResult {
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

    const result = parsed as WbsGenerationJobResult;
    if (!result.phases || !Array.isArray(result.phases)) {
      throw new Error('AI output missing "phases" array');
    }

    // Truncate titles to 200 chars
    for (const phase of result.phases) {
      if (phase.title && phase.title.length > 200) {
        phase.title = phase.title.slice(0, 200);
      }
      if (Array.isArray(phase.tasks)) {
        for (const task of phase.tasks) {
          if (task.title && task.title.length > 200) {
            task.title = task.title.slice(0, 200);
          }
          if (Array.isArray(task.subtasks)) {
            for (const subtask of task.subtasks) {
              if (subtask.title && subtask.title.length > 200) {
                subtask.title = subtask.title.slice(0, 200);
              }
            }
          }
        }
      }
    }

    return result;
  }

  async readUploadedFiles(filePaths: string[]): Promise<string> {
    if (filePaths.length === 0) return '';

    const contents: string[] = [];
    for (const fp of filePaths) {
      const ext = fp.split('.').pop()?.toLowerCase();
      try {
        if (ext === 'xlsx' || ext === 'xls') {
          const text = await this.extractExcelText(fp);
          contents.push(`### File: ${fp}\n${text}`);
        } else {
          const { readFile } = await import('fs/promises');
          const content = await readFile(fp, 'utf-8');
          // Strip any null bytes from text files just in case
          contents.push(`### File: ${fp}\n${content.replace(/\0/g, '')}`);
        }
      } catch {
        contents.push(`### File: ${fp}\n[Could not extract text from file]`);
      }
    }
    return contents.join('\n\n');
  }

  /**
   * Extract text content from an Excel file using exceljs.
   * Returns a readable text representation of all sheets.
   */
  private async extractExcelText(filePath: string): Promise<string> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`## Sheet: ${sheet.name}`);
      sheet.eachRow((row, rowNumber) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
          const val = cell.text ?? String(cell.value ?? '');
          if (val.trim()) cells.push(val.trim());
        });
        if (cells.length > 0) {
          lines.push(cells.join(' | '));
        }
      });
      lines.push('');
    });

    return lines.join('\n');
  }
}
