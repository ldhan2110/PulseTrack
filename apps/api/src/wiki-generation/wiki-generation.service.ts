import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAbsolute, resolve, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';

/**
 * Each section maps to a specialized voltagent sub-agent type for parallel dispatch.
 * The spawned CLI uses the Agent tool with the specified subagent_type for domain expertise,
 * and code-review-graph MCP tools for fast codebase analysis (no file scanning).
 */
interface SectionConfig {
  agent: string;
  prompt: string;
}

const SECTION_CONFIGS: Record<string, SectionConfig> = {
  architecture: {
    agent: 'voltagent-qa-sec:architect-reviewer',
    prompt: `You are an architecture reviewer. Use the Agent tool with subagent_type="voltagent-qa-sec:architect-reviewer" to analyze this repository.

IMPORTANT: Use code-review-graph MCP tools ONLY — do NOT scan files manually:
1. Call get_architecture_overview_tool first for the high-level view
2. Call list_communities_tool to identify component boundaries
3. Call query_graph_tool with pattern="imports_of" for dependency analysis

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
  },

  modules: {
    agent: 'voltagent-research:research-analyst',
    prompt: `You are a codebase research analyst. Use the Agent tool with subagent_type="voltagent-research:research-analyst" to analyze this repository's modules.

IMPORTANT: Use code-review-graph MCP tools ONLY — do NOT scan files manually:
1. Call list_communities_tool to identify all modules/packages
2. Call get_community_tool for each community to get its members
3. Call query_graph_tool with "imports_of" and "importers_of" for cross-module dependencies
4. Call semantic_search_nodes_tool for key classes/functions in each module

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
  },

  features: {
    agent: 'voltagent-biz:product-manager',
    prompt: `You are a product manager analyzing user-facing features. Use the Agent tool with subagent_type="voltagent-biz:product-manager" to analyze this repository's features.

IMPORTANT: Use code-review-graph MCP tools ONLY — do NOT scan files manually:
1. Call list_flows_tool to identify all execution flows (user journeys)
2. Call get_flow_tool for each flow to trace the full path
3. Call semantic_search_nodes_tool for UI components, handlers, and routes

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
  },

  'business-logic': {
    agent: 'voltagent-biz:business-analyst',
    prompt: `You are a business analyst. Use the Agent tool with subagent_type="voltagent-biz:business-analyst" to analyze this repository's business logic.

IMPORTANT: Use code-review-graph MCP tools ONLY — do NOT scan files manually:
1. Call semantic_search_nodes_tool with keywords: "validate", "check", "rule", "policy", "constraint", "guard"
2. Call query_graph_tool with "callers_of" to trace where business rules are enforced
3. Call get_impact_radius_tool on key business logic files

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
  },

  'api-reference': {
    agent: 'voltagent-core-dev:api-designer',
    prompt: `You are an API designer. Use the Agent tool with subagent_type="voltagent-core-dev:api-designer" to document this repository's API.

IMPORTANT: Use code-review-graph MCP tools ONLY — do NOT scan files manually:
1. Call semantic_search_nodes_tool with kind="Class" for controllers/routes
2. Call query_graph_tool with "children_of" for each controller to list endpoints
3. Call query_graph_tool with "callees_of" for each endpoint to trace service calls
4. Call semantic_search_nodes_tool for DTOs and request/response types

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
  },

  'data-models': {
    agent: 'voltagent-research:data-researcher',
    prompt: `You are a data researcher. Use the Agent tool with subagent_type="voltagent-research:data-researcher" to analyze this repository's data layer.

IMPORTANT: Use code-review-graph MCP tools ONLY — do NOT scan files manually:
1. Call semantic_search_nodes_tool with keywords: "model", "schema", "entity", "table", "prisma"
2. Call query_graph_tool with "children_of" for schema/model files
3. Call query_graph_tool with "importers_of" to find where models are consumed

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
  },

  glossary: {
    agent: 'voltagent-biz:technical-writer',
    prompt: `You are a technical writer. Use the Agent tool with subagent_type="voltagent-biz:technical-writer" to build a project glossary.

Read the existing wiki markdown files in the wiki directory using code-review-graph MCP tools:
1. Call list_graph_stats_tool for a project overview
2. Call semantic_search_nodes_tool for domain-specific types, classes, and concepts

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
  },
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

  getWikiPath(projectId: string): string {
    const configDir = this.config.get<string>('WIKI_DIR');
    if (!configDir) {
      return join(process.cwd(), 'wikis', projectId);
    }
    const baseDir = isAbsolute(configDir) ? configDir : resolve(process.cwd(), configDir);
    return join(baseDir, projectId);
  }

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
      wikiPath: this.getWikiPath(projectId),
      sections: wikiConfig.sections,
    };
  }

  buildGraphPrompt(): string {
    return 'Build or update the knowledge graph for this repository using the code-review-graph skills installed. Do not do anything else. Just build the graph and report the result.';
  }

  getSectionConfig(section: string): SectionConfig {
    const config = SECTION_CONFIGS[section];
    if (!config) throw new BadRequestException(`Unknown wiki section: ${section}`);
    return config;
  }

  buildSectionPrompt(section: string, projectContext: string | null): string {
    const config = this.getSectionConfig(section);

    const parts = [config.prompt];
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
