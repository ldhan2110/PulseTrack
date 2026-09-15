import { McpServerService } from './mcp-server.service';
import type { McpSession } from './mcp-pat.guard';

function session(scopes: string[]): McpSession {
  return { userId: 'u1', projectId: 'p1', scopes, tokenId: 't1' };
}

// projectId 'p1' = same project, 'p2' = other project. Keys resolve to whatever
// the id/key string implies via the 'other' sentinel.
function makeServices() {
  const proj = (key: string) => (key === 'other' ? 'p2' : 'p1');
  const tasks = {
    findAll: async (projectId: string) => [{ id: 'task1', projectId }],
    findOne: async (id: string) => ({ id, projectId: proj(id), title: 'T' }),
    findByTaskKey: async (taskKey: string) => ({ id: 'task1', projectId: proj(taskKey), taskKey }),
    create: async (projectId: string, userId: string, dto: any) => ({ id: 'new', projectId, userId, ...dto }),
    update: async (id: string, dto: any, actorId: string) => ({ id, actorId, ...dto }),
  };
  const bugs = {
    findAll: async (projectId: string) => [{ id: 'bug1', projectId }],
    findOne: async (id: string) => ({ id, projectId: proj(id), title: 'B' }),
  };
  const testCases = {
    findAll: async (projectId: string) => [{ id: 'tc1', projectId }],
    findOne: async (id: string) => ({ id, projectId: proj(id), title: 'TC' }),
    findByKey: async (testCaseKey: string) => ({ id: 'tc1', projectId: proj(testCaseKey), testCaseKey }),
    create: async (projectId: string, creatorId: string, dto: any) => ({ id: 'tcnew', projectId, ...dto }),
    update: async (id: string, dto: any) => ({ id, ...dto }),
  };
  const timeLogs = {
    create: async (projectId: string, taskId: string, userId: string, dto: any) => ({ id: 'tl1', projectId, taskId, userId, ...dto }),
  };
  const testModules = {
    findAll: async (projectId: string) => [{ id: 'm1', projectId }],
  };
  const svc = new McpServerService(
    tasks as any, bugs as any, testCases as any, timeLogs as any, testModules as any,
  );
  return { svc, tasks, timeLogs };
}

const ALL_SCOPES = ['tasks:read', 'bugs:read', 'tasks:write', 'tasks:logtime', 'testcases:read', 'testcases:write'];

function tool(svc: McpServerService, s: McpSession, name: string) {
  return svc.tools(s).find((t) => t.name === name)!;
}

describe('MCP read-only tools', () => {
  it('present scope → list_tasks returns data', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['tasks:read']), 'list_tasks').handler({});
    expect(JSON.parse(res.content[0].text)).toEqual([{ id: 'task1', projectId: 'p1' }]);
  });

  it('missing scope → list_tasks errors and returns no data', async () => {
    const { svc } = makeServices();
    await expect(tool(svc, session(['bugs:read']), 'list_tasks').handler({})).rejects.toThrow(/scope/);
  });

  it('get_task ignores cross-project id — isolation enforced by token projectId', async () => {
    const { svc } = makeServices();
    await expect(tool(svc, session(['tasks:read']), 'get_task').handler({ id: 'other' })).rejects.toThrow(/not found/i);
    const ok = await tool(svc, session(['tasks:read']), 'get_task').handler({ id: 'task1' });
    expect(JSON.parse(ok.content[0].text).id).toBe('task1');
  });

  it('get_bug enforces the same project isolation', async () => {
    const { svc } = makeServices();
    await expect(tool(svc, session(['bugs:read']), 'get_bug').handler({ id: 'other' })).rejects.toThrow(/not found/i);
  });
});

describe('MCP write tools', () => {
  it('registers the full read+write surface', () => {
    const { svc } = makeServices();
    const names = svc.tools(session(ALL_SCOPES)).map((t) => t.name).sort();
    expect(names).toEqual([
      'create_task', 'create_test_case', 'get_bug', 'get_task', 'get_test_case',
      'list_bugs', 'list_tasks', 'list_test_cases', 'list_test_modules',
      'log_time', 'update_task', 'update_test_case',
    ]);
  });

  it('create_task requires tasks:write scope', async () => {
    const { svc } = makeServices();
    await expect(
      tool(svc, session(['tasks:read']), 'create_task').handler({ title: 'Hello', taskTypeId: 'tt1' }),
    ).rejects.toThrow(/scope: tasks:write/);
  });

  it('create_task passes projectId + userId from session', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['tasks:write']), 'create_task').handler({ title: 'Hello', taskTypeId: 'tt1' });
    const out = JSON.parse(res.content[0].text);
    expect(out.projectId).toBe('p1');
    expect(out.userId).toBe('u1');
  });

  it('update_task by taskKey enforces project isolation', async () => {
    const { svc } = makeServices();
    // key resolving to p2 → rejected
    await expect(
      tool(svc, session(['tasks:write']), 'update_task').handler({ taskKey: 'other', title: 'x' }),
    ).rejects.toThrow(/not found/i);
    // same-project key → updates resolved id
    const ok = await tool(svc, session(['tasks:write']), 'update_task').handler({ taskKey: 'AXC-1', title: 'x' });
    expect(JSON.parse(ok.content[0].text).id).toBe('task1');
  });

  it('log_time uses tasks:logtime scope, distinct from tasks:write', async () => {
    const { svc } = makeServices();
    // logtime scope can log
    const ok = await tool(svc, session(['tasks:logtime']), 'log_time').handler({ taskKey: 'AXC-1', minutes: 30 });
    expect(JSON.parse(ok.content[0].text).taskId).toBe('task1');
    // but cannot create_task
    await expect(
      tool(svc, session(['tasks:logtime']), 'create_task').handler({ title: 'Hello', taskTypeId: 'tt1' }),
    ).rejects.toThrow(/scope: tasks:write/);
  });

  it('create_test_case requires testcases:write; read-only blocked', async () => {
    const { svc } = makeServices();
    await expect(
      tool(svc, session(['testcases:read']), 'create_test_case').handler({ title: 'Case', moduleId: 'm1' }),
    ).rejects.toThrow(/scope: testcases:write/);
  });

  it('get_test_case rejects cross-project id', async () => {
    const { svc } = makeServices();
    await expect(
      tool(svc, session(['testcases:read']), 'get_test_case').handler({ id: 'other' }),
    ).rejects.toThrow(/not found/i);
  });

  it('list_test_modules returns project modules', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['testcases:read']), 'list_test_modules').handler({});
    expect(JSON.parse(res.content[0].text)).toEqual([{ id: 'm1', projectId: 'p1' }]);
  });
});
