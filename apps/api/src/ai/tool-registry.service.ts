import type { AiToolDef } from './interfaces/ai-client.interface';

export type ToolHandler = (input: Record<string, unknown>) => Promise<string>;

export interface RegisteredTool {
  def: AiToolDef;
  handler: ToolHandler;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(def: AiToolDef, handler: ToolHandler): void {
    this.tools.set(def.name, { def, handler });
  }

  getToolDefs(): AiToolDef[] {
    return Array.from(this.tools.values()).map((t) => t.def);
  }

  async execute(name: string, input: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return `Error: unknown tool "${name}"`;
    }
    try {
      return await tool.handler(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error: ${message}`;
    }
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
