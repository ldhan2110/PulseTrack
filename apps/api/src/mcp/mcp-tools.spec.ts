import { McpServerService } from './mcp-server.service';
import type { McpSession } from './mcp-pat.guard';

function session(scopes: string[], allowWrite = true): McpSession {
  return { userId: 'u1', projectId: 'p1', scopes, allowWrite, tokenId: 't1' };
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
  // Execution 'ex1' lives in p1 with case 'ec1' (testCaseKey TC-1); 'other' → p2.
  const testExecutions = {
    findAll: async (projectId: string) => [{ id: 'ex1', projectId }],
    findOne: async (id: string) => ({
      id,
      projectId: proj(id),
      executionKey: null,
      name: 'E',
      status: 'PENDING',
      cases: [{ id: 'ec1', result: 'NOT_RUN', testCase: { testCaseKey: 'TC-1' } }],
    }),
    findByKey: async (executionKey: string) => ({
      id: 'ex1',
      projectId: proj(executionKey),
      executionKey,
      name: 'E',
      status: 'PENDING',
      cases: [{ id: 'ec1', result: 'NOT_RUN', testCase: { testCaseKey: 'TC-1' } }],
    }),
    create: async (projectId: string, dto: any, userId: string) => ({ id: 'exnew', projectId, userId, ...dto }),
    updateResult: async (executionCaseId: string, userId: string, dto: any) => ({ id: executionCaseId, executedById: userId, ...dto }),
    createAttachment: async (executionCaseId: string, uploaderId: string, file: any) => ({ id: 'att1', executionCaseId, uploaderId, filename: file.originalname, size: file.size }),
  };
  const prisma = {
    testCase: {
      findMany: async ({ where }: any) => {
        const keys: string[] = where.testCaseKey.in;
        // 'TC-1' resolves; anything else is unknown.
        return keys.filter((k) => k === 'TC-1').map((k) => ({ id: 'tc1', testCaseKey: k }));
      },
    },
    testExecutionCase: {
      findUnique: async ({ where }: any) => (where.id === 'ec1'
        ? { id: 'ec1', execution: { projectId: 'p1' } }
        : where.id === 'ecother'
          ? { id: 'ecother', execution: { projectId: 'p2' } }
          : null),
    },
    projectMember: {
      findMany: async ({ where }: any) =>
        where.projectId === 'p1'
          ? [{ user: { id: 'u1', name: 'Ann', username: 'ann', email: 'ann@x.io' } }]
          : [],
    },
  };
  const svc = new McpServerService(
    tasks as any, bugs as any, testCases as any, timeLogs as any, testModules as any,
    {} as any, testExecutions as any, {} as any, prisma as any,
  );
  return { svc, tasks, timeLogs, testExecutions };
}

const ALL_SCOPES = ['tasks:read', 'bugs:read', 'tasks:write', 'tasks:logtime', 'testcases:read', 'testcases:write', 'testexec:read', 'testexec:write'];

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

  it('list_project_members returns the token project members (unwrapped users); denied without scope', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['tasks:read']), 'list_project_members').handler({});
    expect(JSON.parse(res.content[0].text)).toEqual([{ id: 'u1', name: 'Ann', username: 'ann', email: 'ann@x.io' }]);
    await expect(
      tool(svc, session(['bugs:read']), 'list_project_members').handler({}),
    ).rejects.toThrow(/scope: tasks:read/);
  });
});

describe('MCP write tools', () => {
  it('registers the full read+write surface', () => {
    const { svc } = makeServices();
    const names = svc.tools(session(ALL_SCOPES)).map((t) => t.name).sort();
    expect(names).toEqual([
      'attach_result_file', 'attach_task_file', 'create_task', 'create_test_case', 'create_test_execution',
      'get_bug', 'get_task', 'get_test_case', 'get_test_execution',
      'list_bugs', 'list_project_members', 'list_task_types', 'list_tasks', 'list_test_cases', 'list_test_executions', 'list_test_modules',
      'log_time', 'update_execution_result', 'update_task', 'update_test_case',
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

describe('MCP test-execution tools', () => {
  it('list_test_executions returns project executions; denied without scope', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['testexec:read']), 'list_test_executions').handler({});
    expect(JSON.parse(res.content[0].text)).toEqual([{ id: 'ex1', projectId: 'p1' }]);
    await expect(
      tool(svc, session(['tasks:read']), 'list_test_executions').handler({}),
    ).rejects.toThrow(/scope: testexec:read/);
  });

  it('get_test_execution returns cases with executionCaseId + testCaseKey; cross-project rejected', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['testexec:read']), 'get_test_execution').handler({ executionKey: 'AXC-TX-1' });
    const out = JSON.parse(res.content[0].text);
    expect(out.cases).toEqual([{ executionCaseId: 'ec1', testCaseKey: 'TC-1', result: 'NOT_RUN' }]);
    await expect(
      tool(svc, session(['testexec:read']), 'get_test_execution').handler({ executionKey: 'other' }),
    ).rejects.toThrow(/not found/i);
  });

  it('create_test_execution resolves keys, assignee = token user; unknown key fails; denied without scope', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['testexec:write']), 'create_test_execution').handler({ name: 'Run', testCaseKeys: ['TC-1'] });
    const out = JSON.parse(res.content[0].text);
    expect(out.projectId).toBe('p1');
    expect(out.assigneeId).toBe('u1');
    expect(out.testCaseIds).toEqual(['tc1']);
    await expect(
      tool(svc, session(['testexec:write']), 'create_test_execution').handler({ name: 'Run', testCaseKeys: ['TC-1', 'NOPE'] }),
    ).rejects.toThrow(/NOPE/);
    await expect(
      tool(svc, session(['testexec:read']), 'create_test_execution').handler({ name: 'Run', testCaseKeys: ['TC-1'] }),
    ).rejects.toThrow(/scope: testexec:write/);
  });

  it('update_execution_result sets result by keys; invalid status rejected; denied without scope', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['testexec:write']), 'update_execution_result').handler({ executionKey: 'AXC-TX-1', testCaseKey: 'TC-1', result: 'FAIL', notes: 'boom' });
    const out = JSON.parse(res.content[0].text);
    expect(out.id).toBe('ec1');
    expect(out.result).toBe('FAIL');
    expect(out.executedById).toBe('u1');
    // invalid enum value rejected by zod parse at registration/validation layer
    const t = tool(svc, session(['testexec:write']), 'update_execution_result');
    expect(t.inputSchema.result.safeParse('PASSED').success).toBe(false);
    await expect(
      tool(svc, session(['testexec:read']), 'update_execution_result').handler({ executionCaseId: 'ec1', result: 'PASS' }),
    ).rejects.toThrow(/scope: testexec:write/);
  });

  it('attach_result_file writes ≤2MB with uploader = token user; >2MB rejected; denied without scope', async () => {
    const { svc } = makeServices();
    const small = Buffer.from('hello').toString('base64');
    const res = await tool(svc, session(['testexec:write']), 'attach_result_file').handler({ executionCaseId: 'ec1', filename: 'shot.png', mimeType: 'image/png', dataBase64: small });
    const out = JSON.parse(res.content[0].text);
    expect(out.uploaderId).toBe('u1');
    expect(out.executionCaseId).toBe('ec1');
    const big = Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64');
    await expect(
      tool(svc, session(['testexec:write']), 'attach_result_file').handler({ executionCaseId: 'ec1', filename: 'big.png', mimeType: 'image/png', dataBase64: big }),
    ).rejects.toThrow(/2MB/);
    await expect(
      tool(svc, session(['testexec:read']), 'attach_result_file').handler({ executionCaseId: 'ec1', filename: 'x.png', mimeType: 'image/png', dataBase64: small }),
    ).rejects.toThrow(/scope: testexec:write/);
  });
});

describe('MCP write consent gate', () => {
  it('write tool with allowWrite:false → hard error, no mutation', async () => {
    const { svc, tasks } = makeServices();
    let created = false;
    tasks.create = async (...args: any[]) => {
      created = true;
      return { id: 'new', projectId: args[0], userId: args[1] };
    };
    await expect(
      tool(svc, session(['tasks:write'], false), 'create_task').handler({ title: 'Hello', taskTypeId: 'tt1' }),
    ).rejects.toThrow('Agent writes not permitted: token has no write consent');
    expect(created).toBe(false);
  });

  it('write tool with allowWrite:true → succeeds', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['tasks:write'], true), 'create_task').handler({ title: 'Hello', taskTypeId: 'tt1' });
    expect(JSON.parse(res.content[0].text).projectId).toBe('p1');
  });

  it('read tool with allowWrite:false → succeeds', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['tasks:read'], false), 'list_tasks').handler({});
    expect(JSON.parse(res.content[0].text)).toEqual([{ id: 'task1', projectId: 'p1' }]);
  });

  it('missing scope error precedes consent error', async () => {
    const { svc } = makeServices();
    // has no tasks:write scope AND no consent → the scope error wins.
    await expect(
      tool(svc, session(['tasks:read'], false), 'create_task').handler({ title: 'Hello', taskTypeId: 'tt1' }),
    ).rejects.toThrow(/scope: tasks:write/);
  });
});
