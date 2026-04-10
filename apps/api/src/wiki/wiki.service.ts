import { Injectable, NotFoundException } from '@nestjs/common';
import { readdir, readFile, stat, unlink } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { WikiGenerationService } from '../wiki-generation/wiki-generation.service';

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
    private readonly wikiGenService: WikiGenerationService,
  ) {}

  async getPageTree(projectId: string): Promise<WikiTreeNode[]> {
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
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
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
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
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
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
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
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
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
    const filePath = join(wikiPath, 'qa', `${qaId}.md`);
    if (!existsSync(filePath)) throw new NotFoundException('Q&A entry not found');
    await unlink(filePath);
  }
}
