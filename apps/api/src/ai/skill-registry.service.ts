import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';

@Injectable()
export class SkillRegistry {
  private cache = new Map<string, string>();
  private skillsDir: string;

  constructor() {
    // __dirname = dist/src/ai in prod, but skills aren't there in dev
    const distPath = join(__dirname, 'skills');
    this.skillsDir = existsSync(distPath)
      ? distPath
      : join(process.cwd(), 'src', 'ai', 'skills');
  }

  async load(name: string): Promise<string> {
    const cached = this.cache.get(name);
    if (cached) return cached;

    const filePath = join(this.skillsDir, `${name}.md`);
    const raw = await readFile(filePath, 'utf-8');
    const content = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
    this.cache.set(name, content);
    return content;
  }

  async catalog(): Promise<string> {
    let entries: string[];
    try {
      entries = await readdir(this.skillsDir);
    } catch {
      return '';
    }

    const lines = entries
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const name = f.replace(/\.md$/, '');
        const body = this.cache.get(name);
        const summary = body ? body.split('\n')[0] : name;
        return `- ${name}: ${summary}`;
      });

    return lines.join('\n');
  }
}
