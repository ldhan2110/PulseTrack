import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { buildRepoFingerprint } from '../../ai-config/repo-fingerprint.util';
import type { Agent } from '../agent.interface';
import { modelFor } from '../ai-client';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts/project-context.prompt';

const CONTEXT_MAX_LENGTH = 10000;

export interface ProjectContextCtx {
  projectId: string;
}

@Injectable()
export class ProjectContextAgent implements Agent {
  readonly kind = 'project-context';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async run(ctx: unknown): Promise<string> {
    const { projectId } = ctx as ProjectContextCtx;

    const cfg = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!cfg) throw new NotFoundException('AI config not found. Save AI settings first.');

    const repos = await this.prisma.repository.findMany({
      where: { projectId, cloneStatus: 'cloned' },
    });
    if (repos.length === 0) throw new BadRequestException('Clone a repository first');

    const fingerprints = (
      await Promise.all(repos.map((r) => buildRepoFingerprint(r.workspacePath ?? '', r.name)))
    ).filter((f): f is string => f !== null);
    if (fingerprints.length === 0) throw new BadRequestException('Clone a repository first');

    const model = modelFor(cfg, this.config.getOrThrow<string>('ENCRYPTION_KEY'));
    const response = await model.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(fingerprints) },
    ]);
    const raw = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c: any) => (typeof c === 'string' ? c : ('text' in c ? c.text : ''))).join('')
        : String(response.content);
    return raw.slice(0, CONTEXT_MAX_LENGTH);
  }
}
