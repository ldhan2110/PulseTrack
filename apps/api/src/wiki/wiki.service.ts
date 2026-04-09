import { Injectable, NotFoundException } from '@nestjs/common';
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { WikiConfigService } from '../wiki-config/wiki-config.service';

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
    private readonly wikiConfigService: WikiConfigService,
  ) {}

  async getPageTree(projectId: string): Promise<WikiTreeNode[]> {
    const config = await this.wikiConfigService.findByProjectId(projectId);
    if (!config || !existsSync(config.wikiPath)) return [];
    return this.buildTree(config.wikiPath, config.wikiPath);
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
    const config = await this.wikiConfigService.findByProjectId(projectId);
    if (!config) throw new NotFoundException('Wiki not configured');
    const fullPath = join(config.wikiPath, pagePath);
    if (!existsSync(fullPath)) throw new NotFoundException(`Wiki page not found: ${pagePath}`);
    const content = await readFile(fullPath, 'utf-8');
    return { path: pagePath, content };
  }

  async searchPages(projectId: string, query: string): Promise<Array<{ path: string; title: string; snippet: string }>> {
    const config = await this.wikiConfigService.findByProjectId(projectId);
    if (!config || !existsSync(config.wikiPath)) return [];
    const results: Array<{ path: string; title: string; snippet: string }> = [];
    const lowerQuery = query.toLowerCase();
    await this.searchDir(config.wikiPath, config.wikiPath, lowerQuery, results);
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
}
