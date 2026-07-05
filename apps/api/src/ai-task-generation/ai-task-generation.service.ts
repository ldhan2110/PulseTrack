// apps/api/src/ai-task-generation/ai-task-generation.service.ts
import { Injectable } from '@nestjs/common';
import type { GeneratedTask, GenerationJobResult } from './dto/generate-tasks.dto';
import { readFile } from 'fs/promises';

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
  buildGraphPrompt(): string {
    return BUILD_GRAPH_PROMPT;
  }

  buildScanPrompt(userPrompt: string): string {
    return CODE_GRAPH_SCAN_PROMPT.replace('{USER_PROMPT}', userPrompt);
  }

  /**
   * Validate parsed AI output matches expected schema.
   */
  validateOutput(result: GenerationJobResult): void {
    if (!result.tasks || !Array.isArray(result.tasks)) {
      throw new Error('AI output missing "tasks" array');
    }
    for (const task of result.tasks) {
      this.validateTask(task);
      if (task.subTasks) {
        for (const sub of task.subTasks) {
          this.validateTask(sub);
        }
      }
    }
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
      task.storyPoints = validPoints.reduce((prev, curr) =>
        Math.abs(curr - task.storyPoints) < Math.abs(prev - task.storyPoints) ? curr : prev,
      );
    }
  }

  /**
   * For non-Claude providers, read uploaded files and append their content to the prompt.
   */
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
