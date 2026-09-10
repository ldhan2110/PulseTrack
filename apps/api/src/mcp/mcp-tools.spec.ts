import { McpServerService } from './mcp-server.service';
import type { McpSession } from './mcp-pat.guard';

function session(scopes: string[]): McpSession {
  return { userId: 'u1', projectId: 'p1', scopes, tokenId: 't1' };
}

function makeServices() {
  const tasks = {
    findAll: async (projectId: string) => [{ id: 'task1', projectId }],
    findOne: async (id: string) => ({ id, projectId: id === 'other' ? 'p2' : 'p1', title: 'T' }),
  };
  const bugs = {
    findAll: async (projectId: string) => [{ id: 'bug1', projectId }],
    findOne: async (id: string) => ({ id, projectId: id === 'other' ? 'p2' : 'p1', title: 'B' }),
  };
  return { svc: new McpServerService(tasks as any, bugs as any), tasks, bugs };
}

function tool(svc: McpServerService, s: McpSession, name: string) {
  return svc.tools(s).find((t) => t.name === name)!;
}

describe('MCP read-only tools', () => {
  it('registers exactly the four read tools — no write tools', () => {
    const { svc } = makeServices();
    const names = svc.tools(session(['tasks:read', 'bugs:read'])).map((t) => t.name).sort();
    expect(names).toEqual(['get_bug', 'get_task', 'list_bugs', 'list_tasks']);
    // no create/update/delete anywhere
    expect(names.some((n) => /create|update|delete|write/.test(n))).toBe(false);
  });

  it('present scope → list_tasks returns data', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['tasks:read']), 'list_tasks').handler({});
    expect(JSON.parse(res.content[0].text)).toEqual([{ id: 'task1', projectId: 'p1' }]);
  });

  it('missing scope → list_tasks errors and returns no data', async () => {
    const { svc } = makeServices();
    await expect(tool(svc, session(['bugs:read']), 'list_tasks').handler({})).rejects.toThrow(/scope/);
  });

  it('missing scope → list_bugs errors', async () => {
    const { svc } = makeServices();
    await expect(tool(svc, session(['tasks:read']), 'list_bugs').handler({})).rejects.toThrow(/scope/);
  });

  it('get_task ignores cross-project id — isolation enforced by token projectId', async () => {
    const { svc } = makeServices();
    // 'other' resolves to projectId p2, session is bound to p1 → not found
    await expect(tool(svc, session(['tasks:read']), 'get_task').handler({ id: 'other' })).rejects.toThrow(/not found/i);
    // same-project id works
    const ok = await tool(svc, session(['tasks:read']), 'get_task').handler({ id: 'task1' });
    expect(JSON.parse(ok.content[0].text).id).toBe('task1');
  });

  it('get_bug enforces the same project isolation', async () => {
    const { svc } = makeServices();
    await expect(tool(svc, session(['bugs:read']), 'get_bug').handler({ id: 'other' })).rejects.toThrow(/not found/i);
  });
});
