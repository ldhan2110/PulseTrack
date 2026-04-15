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

@Injectable()
export class AiWbsGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProjectAiConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      projectContext: aiConfig.projectContext,
      cli: CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider,
    };
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
    return contents.join('\n\n');
  }
}
