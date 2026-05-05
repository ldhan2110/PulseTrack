import { existsSync } from 'fs';

/** Resolve git binary — check known locations since PM2's PATH is unreliable. */
export const GIT_PATH = (() => {
  const candidates = [
    process.env.GIT_PATH,          // explicit override via env
    '/opt/homebrew/bin/git',       // macOS Apple Silicon (Homebrew)
    '/usr/local/bin/git',          // macOS Intel (Homebrew)
    '/usr/bin/git',                // Linux / Xcode CLI tools
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return 'git';
})();
