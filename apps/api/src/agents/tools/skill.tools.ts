import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Runtime access to a project's Skills for an AI agent, with progressive
 * disclosure: `buildSkillIndex` returns cheap metadata (key/name/description)
 * for the prompt, and `buildSkillTools` returns a `load_skill` tool the agent
 * calls to pull a skill's full body only when it needs it. Skill `content` is
 * never eagerly injected — a project may hold many large skills.
 */

/** One-line-per-skill index of ENABLED skills; content is never included. */
export async function buildSkillIndex(prisma: PrismaService, projectId: string): Promise<string> {
  const skills = await prisma.skill.findMany({
    where: { projectId, enabled: true },
    select: { key: true, name: true, description: true },
  });
  return skills
    .map((s) => `- ${s.key}: ${s.name}${s.description ? ` — ${s.description}` : ''}`)
    .join('\n');
}

/** A `load_skill(key)` tool scoped to this project's enabled skills. */
export function buildSkillTools(prisma: PrismaService, projectId: string) {
  const loadSkill = tool(
    async ({ key }: { key: string }) => {
      const skill = await prisma.skill.findFirst({
        where: { projectId, key, enabled: true },
        select: { content: true },
      });
      return skill?.content ?? `No enabled skill found for key "${key}".`;
    },
    {
      name: 'load_skill',
      description:
        'Load the full body of a project skill by its key. Read the skill index in ' +
        'the system prompt first, then call this for each skill you need.',
      schema: z.object({ key: z.string().describe('The skill key from the index') }),
    },
  );
  return [loadSkill];
}
