export interface Agent {
  kind: string;
  run(ctx: unknown, onStep?: (line: string) => void): Promise<unknown>;
}
