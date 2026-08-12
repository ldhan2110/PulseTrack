export interface Agent {
  kind: string;
  run(ctx: unknown): Promise<unknown>;
}
