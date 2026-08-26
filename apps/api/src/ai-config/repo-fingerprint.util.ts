import { readdir, readFile, stat } from 'fs/promises';
import { existsSync, Dirent } from 'fs';
import { join, extname } from 'path';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'target', 'vendor', '.next', 'coverage',
]);
const MANIFESTS = [
  'package.json', 'pom.xml', 'build.gradle', 'requirements.txt', 'pyproject.toml',
  'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile',
];
const README_MAX = 4000;
const MANIFEST_MAX = 2000;
const LISTING_MAX = 50;
const EXT_MAX = 20;

async function findReadme(root: string): Promise<string | null> {
  const entries = await readdir(root).catch(() => [] as string[]);
  const readme = entries.find((e) => /^readme(\.|$)/i.test(e));
  if (!readme) return null;
  const content = await readFile(join(root, readme), 'utf-8').catch(() => null);
  return content ? content.slice(0, README_MAX) : null;
}

async function findManifest(root: string): Promise<string | null> {
  for (const name of MANIFESTS) {
    if (existsSync(join(root, name))) {
      const content = await readFile(join(root, name), 'utf-8').catch(() => null);
      if (content) return `${name}:\n${content.slice(0, MANIFEST_MAX)}`;
    }
  }
  // *.csproj / *.sln fallback
  const entries = await readdir(root).catch(() => [] as string[]);
  const dotnet = entries.find((e) => /\.(csproj|sln)$/i.test(e));
  if (dotnet) {
    const content = await readFile(join(root, dotnet), 'utf-8').catch(() => null);
    if (content) return `${dotnet}:\n${content.slice(0, MANIFEST_MAX)}`;
  }
  return null;
}

// ponytail: naive recursive walk, cap depth 3 + ignore-dirs. Parallelize if a repo is huge.
async function extHistogram(root: string, depth = 3): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  async function walk(dir: string, d: number) {
    if (d < 0) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [] as Dirent[]);
    for (const e of entries) {
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        await walk(join(dir, e.name), d - 1);
      } else {
        const ext = extname(e.name).toLowerCase() || '(none)';
        counts[ext] = (counts[ext] ?? 0) + 1;
      }
    }
  }
  await walk(root, depth);
  return counts;
}

async function topLevelListing(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [] as Dirent[]);
  return entries
    .filter((e) => !IGNORE_DIRS.has(e.name))
    .slice(0, LISTING_MAX)
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}

/**
 * Language-agnostic fingerprint of a cloned repo for AI context generation.
 * Returns a labeled text block, or null if the workspace is missing/unreadable.
 */
export async function buildRepoFingerprint(
  workspacePath: string,
  name: string,
): Promise<string | null> {
  if (!workspacePath || !existsSync(workspacePath)) return null;
  const isDir = await stat(workspacePath).then((s) => s.isDirectory()).catch(() => false);
  if (!isDir) return null;

  const [readme, manifest, hist, listing] = await Promise.all([
    findReadme(workspacePath),
    findManifest(workspacePath),
    extHistogram(workspacePath),
    topLevelListing(workspacePath),
  ]);

  const topExts = Object.entries(hist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, EXT_MAX)
    .map(([ext, n]) => `${ext}:${n}`)
    .join(', ');

  const parts = [`### Repository: ${name}`];
  parts.push(`Top-level: ${listing.join(', ') || '(empty)'}`);
  parts.push(`File extensions: ${topExts || '(none)'}`);
  if (manifest) parts.push(`Manifest ${manifest}`);
  if (readme) parts.push(`README:\n${readme}`);
  return parts.join('\n\n');
}
