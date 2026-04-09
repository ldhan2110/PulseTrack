import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';

const SECTION_PROMPTS: Record<string, string> = {
  architecture: `Analyze this repository's architecture using the code-review-graph MCP tools.
Use get_architecture_overview_tool and list_communities_tool to understand the high-level structure.

Generate markdown files for the architecture/ wiki section:
1. overview.md — system overview, main components, how they interact
2. tech-stack.md — languages, frameworks, databases, infrastructure
3. deployment.md — how the app is deployed, environments, CI/CD (if detectable)

Each file MUST include YAML frontmatter:
---
title: [Page Title]
section: architecture
generatedAt: [ISO timestamp]
relatedFiles: [list of key file paths]
tags: [relevant tags]
---

Include these sections where applicable: Overview, Related Code (with file paths), Impact Analysis, Relationships.
Return each file as a markdown code block prefixed with the filename comment: <!-- file: architecture/overview.md -->`,

  modules: `Analyze this repository's modules/packages using the code-review-graph MCP tools.
Use list_communities_tool to identify modules, then semantic_search_nodes_tool and query_graph_tool (callers_of, callees_of, imports_of) to analyze each one.

Generate one markdown file per module in the modules/ wiki section.
Name each file after the module (e.g., modules/auth.md, modules/cart.md).

Each file MUST include YAML frontmatter:
---
title: [Module Name] Module
section: modules
generatedAt: [ISO timestamp]
relatedFiles: [list of file paths in this module]
impactedBy: [list of other module wiki page paths]
tags: [relevant tags]
---

Each module page MUST include ALL of these sections:
- Overview — what this module does
- UI Behavior — user-facing interactions (forms, screens, validation, error states)
- Business Rules — domain rules, constraints, edge cases, special handling
- Related Code — file paths and key function names
- Impact Analysis — what other modules are affected when this changes (HIGH/MED/LOW)
- Field Specifications — table with Field, Type, Constraints, Required columns
- Relationships — how this connects to other modules
Return each file as a markdown code block prefixed with: <!-- file: modules/[name].md -->`,

  features: `Analyze this repository's user-facing features using the code-review-graph MCP tools.
Use list_flows_tool to identify execution flows, then trace them with get_flow_tool.

Generate one markdown file per major feature in the features/ wiki section.

Each file MUST include YAML frontmatter:
---
title: [Feature Name]
section: features
generatedAt: [ISO timestamp]
relatedFiles: [file paths]
tags: [relevant tags]
---

Include: Overview, UI Behavior, Business Rules, Related Code, Impact Analysis, Relationships.
Return each file as a markdown code block prefixed with: <!-- file: features/[name].md -->`,

  'business-logic': `Analyze this repository's business logic using the code-review-graph MCP tools.
Search for validation rules, business constraints, domain logic, pricing, permissions, and workflow rules.
Use semantic_search_nodes_tool with keywords like "validate", "check", "rule", "policy", "constraint".

Generate markdown files for cross-cutting business rules in the business-logic/ wiki section.

Each file MUST include YAML frontmatter:
---
title: [Rule/Logic Name]
section: business-logic
generatedAt: [ISO timestamp]
relatedFiles: [file paths]
tags: [relevant tags]
---

Include: Overview, Business Rules (detailed), Related Code, Impact Analysis, Edge Cases.
Return each file as a markdown code block prefixed with: <!-- file: business-logic/[name].md -->`,

  'api-reference': `Analyze this repository's API endpoints using the code-review-graph MCP tools.
Use semantic_search_nodes_tool to find controllers/routes, then query_graph_tool for their dependencies.

Generate markdown files for the api-reference/ wiki section.

Each file MUST include YAML frontmatter:
---
title: [API Group Name]
section: api-reference
generatedAt: [ISO timestamp]
relatedFiles: [file paths]
tags: [relevant tags]
---

For each endpoint include: HTTP method, path, description, request body/params, response shape, auth requirements.
Include Field Specifications tables for DTOs.
Return each file as a markdown code block prefixed with: <!-- file: api-reference/[name].md -->`,

  'data-models': `Analyze this repository's data models using the code-review-graph MCP tools.
Look for ORM models, database schemas, type definitions, and entity relationships.
Use semantic_search_nodes_tool with keywords like "model", "schema", "entity", "table".

Generate markdown files for the data-models/ wiki section.

Each file MUST include YAML frontmatter:
---
title: [Model Group Name]
section: data-models
generatedAt: [ISO timestamp]
relatedFiles: [file paths]
tags: [relevant tags]
---

Include: Overview, Field Specifications (table), Relationships (with diagram notation), Impact Analysis.
Return each file as a markdown code block prefixed with: <!-- file: data-models/[name].md -->`,

  glossary: `Based on the wiki pages already generated for this project, extract a glossary of project-specific terms.
Read the existing wiki markdown files in the wiki directory.

Generate a single terms.md file for the glossary/ section.

The file MUST include YAML frontmatter:
---
title: Project Glossary
section: glossary
generatedAt: [ISO timestamp]
relatedFiles: []
tags: [glossary, terms]
---

Format each term as: **Term** — Definition. Include which module/feature the term belongs to.
Return the file as a markdown code block prefixed with: <!-- file: glossary/terms.md -->`,
};

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

@Injectable()
export class WikiGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProjectConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating wiki.');
    }

    const wikiConfig = await this.prisma.wikiConfig.findUnique({ where: { projectId } });
    if (!wikiConfig) throw new BadRequestException('Wiki configuration not found. Save wiki settings first.');

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      projectContext: aiConfig.projectContext,
      workspacePath: repoConfig.workspacePath!,
      cli: CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider,
      wikiPath: wikiConfig.wikiPath,
      sections: wikiConfig.sections,
    };
  }

  buildGraphPrompt(): string {
    return 'Build or update the knowledge graph for this repository using the code-review-graph skills installed. Do not do anything else. Just build the graph and report the result.';
  }

  buildSectionPrompt(section: string, projectContext: string | null): string {
    const base = SECTION_PROMPTS[section];
    if (!base) throw new BadRequestException(`Unknown wiki section: ${section}`);

    const parts = [base];
    if (projectContext) {
      parts.push(`\n## Project Context\n${projectContext}`);
    }
    parts.push('\nReturn ONLY the markdown files. Do not add explanatory text outside the file blocks.');
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

  parseGeneratedFiles(raw: string): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    const filePattern = /<!--\s*file:\s*([\w\-\/\.]+)\s*-->\s*(?:```(?:markdown|md)?\s*\n?([\s\S]*?)```|([\s\S]*?))(?=<!--\s*file:|$)/g;
    let match: RegExpExecArray | null;
    while ((match = filePattern.exec(raw)) !== null) {
      const filePath = match[1].trim();
      const content = (match[2] ?? match[3] ?? '').trim();
      if (filePath && content) {
        files.push({ path: filePath, content });
      }
    }
    return files;
  }

  async updateLastGenerated(projectId: string) {
    await this.prisma.wikiConfig.update({
      where: { projectId },
      data: { lastGeneratedAt: new Date() },
    });
  }
}
