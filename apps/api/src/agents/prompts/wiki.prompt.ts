import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * The wiki-generation skill (agents/skills/wiki-generation.md) is copied by the
 * nest-cli `agents/skills/**` assets glob. TS emits under dist/src/... but assets
 * copy relative to sourceRoot (dist/agents/skills), so the two roots differ
 * between src (ts-node) and dist. Probe both. Read once at module load.
 */
function loadSkill(): string {
  const candidates = [
    join(__dirname, '..', 'skills', 'wiki-generation.md'), // src (ts-node)
    join(__dirname, '..', '..', '..', 'agents', 'skills', 'wiki-generation.md'), // dist
  ];
  const path = candidates.find(existsSync);
  if (!path) throw new Error(`wiki-generation.md not found. Tried: ${candidates.join(', ')}`);
  return readFileSync(path, 'utf-8');
}
const SKILL = loadSkill();

export const SYSTEM_PROMPT = `You are a technical writer generating a developer wiki from real source code.

${SKILL}

You have CodeGraph code-graph tools. Use them to inspect structure, symbols, call
graphs, and impact before writing — pass each repo's absolute path as the
\`projectPath\` argument. Write pages with the \`write_file\` tool. Do not stop until
the section's pages are written, including its \`index.md\`.`;

export function buildUserPrompt(section: string, repoPaths: string[]): string {
  return [
    `Generate the **${section}** section of the wiki.`,
    '',
    `Indexed repositories in this project (pass each absolute path as \`projectPath\`):`,
    ...repoPaths.map((p) => `- ${p}`),
    '',
    `Write one or more markdown pages for the "${section}" section using write_file.`,
    `Paths are relative to the section directory. Always include an index.md.`,
  ].join('\n');
}
