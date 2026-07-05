import { ToolRegistry } from '../tool-registry.service';
import { BASH_DEF, createBashHandler } from './bash.tool';
import { GLOB_DEF, createGlobHandler } from './glob.tool';
import { GREP_DEF, createGrepHandler } from './grep.tool';
import { READ_FILE_DEF, createReadFileHandler } from './read-file.tool';
import { WRITE_FILE_DEF, createWriteFileHandler } from './write-file.tool';

export function createWorkspaceToolRegistry(workspacePath: string): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(READ_FILE_DEF, createReadFileHandler(workspacePath));
  registry.register(WRITE_FILE_DEF, createWriteFileHandler(workspacePath));
  registry.register(BASH_DEF, createBashHandler(workspacePath));
  registry.register(GLOB_DEF, createGlobHandler(workspacePath));
  registry.register(GREP_DEF, createGrepHandler(workspacePath));

  return registry;
}

export { READ_FILE_DEF, createReadFileHandler } from './read-file.tool';
export { WRITE_FILE_DEF, createWriteFileHandler } from './write-file.tool';
export { BASH_DEF, createBashHandler } from './bash.tool';
export { GLOB_DEF, createGlobHandler } from './glob.tool';
export { GREP_DEF, createGrepHandler } from './grep.tool';
export { resolveSafePath } from './safe-path';
