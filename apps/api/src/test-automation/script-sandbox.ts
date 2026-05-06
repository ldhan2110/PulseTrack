export interface SandboxContext {
  page: unknown;
  expect: unknown;
  baseUrl: string;
  env: Record<string, string>;
  step: (name: string, fn: () => Promise<void>) => Promise<void>;
}

export interface SandboxOptions {
  timeoutMs: number;
  onLog: (message: string) => void;
}

export interface SandboxResult {
  success: boolean;
  error?: string;
  duration: number;
}

export async function executeSandboxedScript(
  script: string,
  context: SandboxContext,
  options: SandboxOptions,
): Promise<SandboxResult> {
  const start = Date.now();

  // Build async function with context destructured as params
  // Using AsyncFunction constructor instead of vm2 — Playwright's browser
  // provides the real sandbox; vm2's Proxy wrappers break complex native objects.
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  const fn = new AsyncFunction(
    'page',
    'expect',
    'baseUrl',
    'env',
    'console',
    'step',
    script,
  );

  const sandboxConsole = {
    log: (...args: unknown[]) => options.onLog(args.map(String).join(' ')),
    warn: (...args: unknown[]) => options.onLog('[warn] ' + args.map(String).join(' ')),
    error: (...args: unknown[]) => options.onLog('[error] ' + args.map(String).join(' ')),
  };

  try {
    await Promise.race([
      fn(context.page, context.expect, context.baseUrl, context.env, sandboxConsole, context.step),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Script timed out after ${options.timeoutMs}ms`)),
          options.timeoutMs,
        ),
      ),
    ]);

    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}
