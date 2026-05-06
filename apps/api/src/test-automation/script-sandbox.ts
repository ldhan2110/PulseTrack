import { VM } from 'vm2';

export interface SandboxContext {
  page: unknown;
  expect: unknown;
  baseUrl: string;
  env: Record<string, string>;
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

  const wrappedScript = `
    (async () => {
      const { page, expect, baseUrl, env } = __context__;
      const console = { log: (...args) => __onLog__(args.map(String).join(' ')) };
      ${script}
    })()
  `;

  const vm = new VM({
    timeout: options.timeoutMs,
    sandbox: {
      __context__: context,
      __onLog__: options.onLog,
    },
    eval: false,
    wasm: false,
  });

  try {
    const promise = vm.run(wrappedScript);
    await Promise.race([
      promise,
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
