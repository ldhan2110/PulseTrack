import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { readdir, readFile, stat, unlink } from 'fs/promises';
import { join, relative, isAbsolute, resolve } from 'path';
import { existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertWikiConfigDto } from './dto/upsert-wiki-config.dto';

/** Canonical section keys — must match ai/skills/wiki-generation.md and the frontend ALL_SECTIONS. */
export const WIKI_SECTIONS = [
  'architecture', 'modules', 'features', 'business-logic',
  'api-reference', 'data-models', 'glossary', 'user-guide',
] as const;

export interface WikiTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: WikiTreeNode[];
}

@Injectable()
export class WikiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('wiki-generation') private readonly queue: Queue,
  ) {}

  getWikiPath(projectId: string): string {
    // Co-locate wiki output with cloned repos under the workspace tree:
    // <WORKSPACE_DIR>/<projectId>/wiki. Resolved the same way as the clone processor.
    const configDir = this.config.get<string>('WORKSPACE_DIR', 'workspaces');
    const baseDir = isAbsolute(configDir) ? configDir : resolve(process.cwd(), '..', '..', configDir);
    return join(baseDir, projectId, 'wiki');
  }

  async getPageTree(projectId: string): Promise<WikiTreeNode[]> {
    const wikiPath = this.getWikiPath(projectId);
    if (!existsSync(wikiPath)) return [];
    return this.buildTree(wikiPath, wikiPath);
  }

  private async buildTree(rootPath: string, currentPath: string): Promise<WikiTreeNode[]> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    const nodes: WikiTreeNode[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const fullPath = join(currentPath, entry.name);
      const relPath = relative(rootPath, fullPath);
      if (entry.isDirectory()) {
        const children = await this.buildTree(rootPath, fullPath);
        nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
      } else if (entry.name.endsWith('.md')) {
        nodes.push({ name: entry.name, path: relPath, type: 'file' });
      }
    }
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async getPage(projectId: string, pagePath: string): Promise<{ path: string; content: string }> {
    const wikiPath = this.getWikiPath(projectId);
    const fullPath = join(wikiPath, pagePath);
    if (!existsSync(fullPath)) throw new NotFoundException(`Wiki page not found: ${pagePath}`);
    const fileStat = await stat(fullPath);
    if (fileStat.isDirectory()) {
      // Try index.md inside the directory
      const indexPath = join(fullPath, 'index.md');
      if (existsSync(indexPath)) {
        const content = await readFile(indexPath, 'utf-8');
        return { path: join(pagePath, 'index.md'), content };
      }
      throw new NotFoundException(`Cannot read directory as page: ${pagePath}`);
    }
    const content = await readFile(fullPath, 'utf-8');
    return { path: pagePath, content };
  }

  async searchPages(projectId: string, query: string): Promise<Array<{ path: string; title: string; snippet: string }>> {
    const wikiPath = this.getWikiPath(projectId);
    if (!existsSync(wikiPath)) return [];
    const results: Array<{ path: string; title: string; snippet: string }> = [];
    const lowerQuery = query.toLowerCase();
    await this.searchDir(wikiPath, wikiPath, lowerQuery, results);
    return results.slice(0, 20);
  }

  private async searchDir(
    rootPath: string, currentPath: string, query: string,
    results: Array<{ path: string; title: string; snippet: string }>,
  ) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const fullPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await this.searchDir(rootPath, fullPath, query, results);
      } else if (entry.name.endsWith('.md')) {
        const content = await readFile(fullPath, 'utf-8');
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes(query)) {
          const relPath = relative(rootPath, fullPath);
          const titleMatch = content.match(/^title:\s*(.+)$/m);
          const title = titleMatch ? titleMatch[1].trim() : entry.name.replace('.md', '');
          const idx = lowerContent.indexOf(query);
          const snippet = content.substring(Math.max(0, idx - 50), idx + query.length + 50).trim();
          results.push({ path: relPath, title, snippet });
        }
      }
    }
  }

  // ─── Annotations ───────────────────────────────────────────────────────

  async getAnnotations(projectId: string, pagePath: string) {
    return this.prisma.wikiAnnotation.findMany({
      where: { projectId, pagePath },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createAnnotation(projectId: string, authorId: string, data: {
    pagePath: string; sectionRef?: string; content: string;
  }) {
    return this.prisma.wikiAnnotation.create({
      data: {
        projectId, authorId,
        pagePath: data.pagePath,
        sectionRef: data.sectionRef ?? null,
        content: data.content,
      },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  async updateAnnotation(annotationId: string, authorId: string, content: string) {
    const annotation = await this.prisma.wikiAnnotation.findUnique({ where: { id: annotationId } });
    if (!annotation) throw new NotFoundException('Annotation not found');
    if (annotation.authorId !== authorId) {
      throw new NotFoundException('Only the author can edit this annotation');
    }
    return this.prisma.wikiAnnotation.update({
      where: { id: annotationId },
      data: { content },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  async deleteAnnotation(annotationId: string, authorId: string) {
    const annotation = await this.prisma.wikiAnnotation.findUnique({ where: { id: annotationId } });
    if (!annotation) throw new NotFoundException('Annotation not found');
    if (annotation.authorId !== authorId) {
      throw new NotFoundException('Only the author can delete this annotation');
    }
    await this.prisma.wikiAnnotation.delete({ where: { id: annotationId } });
  }

  // ─── Q&A ───────────────────────────────────────────────────────────

  async getQaHistory(projectId: string): Promise<Array<{ id: string; question: string; answer: string; createdAt: string }>> {
    const wikiPath = this.getWikiPath(projectId);
    if (!existsSync(join(wikiPath, 'qa'))) return [];

    const qaDir = join(wikiPath, 'qa');
    const entries = await readdir(qaDir);
    const results: Array<{ id: string; question: string; answer: string; createdAt: string }> = [];

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const content = await readFile(join(qaDir, entry), 'utf-8');
      const questionMatch = content.match(/^question:\s*(.+)$/m);
      const createdAtMatch = content.match(/^generatedAt:\s*(.+)$/m) || content.match(/^createdAt:\s*(.+)$/m);
      const answerStart = content.indexOf('---', content.indexOf('---') + 3);
      const answer = answerStart >= 0 ? content.substring(answerStart + 3).trim() : content;

      results.push({
        id: entry.replace('.md', ''),
        question: questionMatch?.[1]?.trim() ?? entry.replace('.md', ''),
        answer,
        createdAt: createdAtMatch?.[1]?.trim() ?? '',
      });
    }

    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteQa(projectId: string, qaId: string): Promise<void> {
    const wikiPath = this.getWikiPath(projectId);
    const filePath = join(wikiPath, 'qa', `${qaId}.md`);
    if (!existsSync(filePath)) throw new NotFoundException('Q&A entry not found');
    await unlink(filePath);
  }

  // ─── Config ────────────────────────────────────────────────────────────

  async getConfig(projectId: string) {
    return this.prisma.wikiConfig.findUnique({ where: { projectId } });
  }

  async upsertConfig(projectId: string, dto: UpsertWikiConfigDto) {
    const data = {
      autoUpdate: dto.autoUpdate ?? 'manual',
      sections: dto.sections ?? [...WIKI_SECTIONS],
    };
    return this.prisma.wikiConfig.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: {
        ...(dto.autoUpdate !== undefined ? { autoUpdate: dto.autoUpdate } : {}),
        ...(dto.sections !== undefined ? { sections: dto.sections } : {}),
      },
    });
  }

  // ─── Generation ────────────────────────────────────────────────────────

  /** Sections to generate: explicit single section, else the project's enabled set (default: all). */
  private async resolveSections(projectId: string, section?: string): Promise<string[]> {
    if (section) {
      if (!WIKI_SECTIONS.includes(section as (typeof WIKI_SECTIONS)[number])) {
        throw new BadRequestException(`Unknown wiki section: ${section}`);
      }
      return [section];
    }
    const cfg = await this.prisma.wikiConfig.findUnique({ where: { projectId } });
    const sections = cfg?.sections?.length ? cfg.sections : [...WIKI_SECTIONS];
    return sections;
  }

  async startGeneration(projectId: string, section?: string): Promise<{ jobId: string }> {
    // Single active job per project (frontend getActiveJob assumes this).
    const existing = await this.prisma.wikiGenerationJob.findFirst({
      where: { projectId, status: { in: ['queued', 'running'] } },
    });
    if (existing) throw new ConflictException('A wiki generation job is already running for this project.');

    const sections = await this.resolveSections(projectId, section);
    const job = await this.prisma.wikiGenerationJob.create({
      data: {
        projectId,
        status: 'queued',
        sections,
        progress: { create: sections.map((s) => ({ section: s })) },
      },
    });
    await this.queue.add('generate', { jobId: job.id, projectId, sections }, { jobId: job.id });
    return { jobId: job.id };
  }

  async getGenerationStatus(jobId: string) {
    const job = await this.prisma.wikiGenerationJob.findUnique({
      where: { id: jobId },
      include: { progress: true },
    });
    if (!job) throw new NotFoundException('Wiki generation job not found');

    const sections: Record<string, number> = {};
    const errors: string[] = [];
    for (const p of job.progress) {
      sections[p.section] = p.pages;
      if (p.error) errors.push(`${p.section}: ${p.error}`);
    }
    const pagesGenerated = job.progress.reduce((sum, p) => sum + p.pages, 0);
    return {
      status: job.status,
      step: job.step ?? undefined,
      result: { pagesGenerated, sections, errors },
      error: job.error ?? undefined,
    };
  }

  async getActiveJob(projectId: string) {
    const job = await this.prisma.wikiGenerationJob.findFirst({
      where: { projectId, status: { in: ['queued', 'running'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (!job) return { active: false };
    return {
      active: true,
      jobId: job.id,
      status: job.status,
      step: job.step ?? undefined,
      sections: job.sections,
    };
  }

  async abortGeneration(jobId: string): Promise<{ aborted: boolean }> {
    const job = await this.prisma.wikiGenerationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Wiki generation job not found');
    // Signal the processor (in-memory registry) and mark aborted; the running
    // section stops at its next checkpoint.
    this.abortControllers.get(jobId)?.abort();
    await this.prisma.wikiGenerationJob.update({
      where: { id: jobId },
      data: { status: 'aborted', endedAt: new Date() },
    });
    const bullJob = await this.queue.getJob(jobId);
    await bullJob?.remove().catch(() => undefined);
    return { aborted: true };
  }

  /** In-memory abort registry shared with the processor (single-node). */
  readonly abortControllers = new Map<string, AbortController>();
}
