import { vi } from 'vitest';
import { McpServerService, toCommentHtml } from './mcp-server.service';
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
    findByBugKey: async (bugKey: string) => ({ id: 'bug1', projectId: proj(bugKey), bugKey }),
    create: vi.fn(async (projectId: string, reporterId: string, dto: any) => ({ id: 'bugnew', projectId, reporterId, ...dto })),
    update: vi.fn(async (id: string, dto: any, actorId: string) => ({ id, actorId, ...dto })),
  };
  // One root comment with one reply; both carry like data that MCP must strip.
  const commentTree = (owner: string) => [
    {
      id: 'c1', content: `on ${owner}`, parentId: null, likes: [{ userId: 'u1' }],
      replies: [{ id: 'c2', content: 'reply', parentId: 'c1', likes: [], replies: [] }],
    },
  ];
  const comments = {
    findAll: async (taskId: string) => commentTree(taskId),
    findAllForBug: async (bugId: string) => commentTree(bugId),
    create: vi.fn(async (taskId: string, authorId: string, content: string) => ({ id: 'cnew', taskId, authorId, content })),
    createReply: vi.fn(async (taskId: string, parentId: string, authorId: string, content: string) => ({ id: 'rnew', taskId, parentId, authorId, content })),
    createForBug: vi.fn(async (bugId: string, authorId: string, content: string) => ({ id: 'cnew', bugId, authorId, content })),
    createReplyForBug: vi.fn(async (bugId: string, parentId: string, authorId: string, content: string) => ({ id: 'rnew', bugId, parentId, authorId, content })),
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
      // Only u1 is a member of p1.
      findUnique: async ({ where }: any) =>
        where.projectId_userId.projectId === 'p1' && where.projectId_userId.userId === 'u1'
          ? { projectId: 'p1', userId: 'u1' }
          : null,
    },
    // p1 has bug statuses bs-open / bs-closed; 'ts-todo' is a TASK status and
    // 'bs-p2' belongs to another project.
    workflowStatus: {
      findMany: async ({ where }: any) =>
        where.projectId === 'p1' && where.kind === 'BUG'
          ? [
              { id: 'bs-open', name: 'Open', key: 'OPEN', isDefault: true, isClosed: false },
              { id: 'bs-closed', name: 'Closed', key: 'CLOSED', isDefault: false, isClosed: true },
            ]
          : [],
      findFirst: async ({ where }: any) =>
        where.projectId === 'p1' && where.kind === 'BUG' && ['bs-open', 'bs-closed'].includes(where.id)
          ? { id: where.id }
          : null,
    },
  };
  const svc = new McpServerService(
    tasks as any, bugs as any, testCases as any, timeLogs as any, testModules as any,
    {} as any, testExecutions as any, {} as any, prisma as any, comments as any,
  );
  return { svc, tasks, bugs, timeLogs, testExecutions, comments };
}

const ALL_SCOPES = ['tasks:read', 'bugs:read', 'bugs:create', 'bugs:write', 'tasks:write', 'tasks:logtime', 'testcases:read', 'testcases:write', 'testexec:read', 'testexec:write'];

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

describe('MCP comment + bug tools', () => {
  it('get_bug resolves by bugKey and still enforces isolation', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['bugs:read']), 'get_bug').handler({ bugKey: 'AXC-BUG-1' });
    expect(JSON.parse(res.content[0].text).bugKey).toBe('AXC-BUG-1');
    await expect(tool(svc, session(['bugs:read']), 'get_bug').handler({ bugKey: 'other' })).rejects.toThrow(/not found/i);
  });

  it('list_task_comments returns the nested thread without likes', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['tasks:read']), 'list_task_comments').handler({ taskKey: 'AXC-1' });
    expect(JSON.parse(res.content[0].text)).toEqual([
      {
        id: 'c1', content: 'on task1', parentId: null,
        replies: [{ id: 'c2', content: 'reply', parentId: 'c1', replies: [] }],
      },
    ]);
  });

  it('list_task_comments needs tasks:read and rejects cross-project tasks', async () => {
    const { svc } = makeServices();
    await expect(tool(svc, session(['bugs:read']), 'list_task_comments').handler({ id: 'task1' })).rejects.toThrow(/scope: tasks:read/);
    await expect(tool(svc, session(['tasks:read']), 'list_task_comments').handler({ id: 'other' })).rejects.toThrow(/not found/i);
    await expect(tool(svc, session(['tasks:read']), 'list_task_comments').handler({})).rejects.toThrow(/Provide id or taskKey/);
  });

  it('list_bug_comments needs bugs:read and rejects cross-project bugs', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['bugs:read']), 'list_bug_comments').handler({ id: 'bug1' });
    expect(JSON.parse(res.content[0].text)[0].likes).toBeUndefined();
    await expect(tool(svc, session(['tasks:read']), 'list_bug_comments').handler({ id: 'bug1' })).rejects.toThrow(/scope: bugs:read/);
    await expect(tool(svc, session(['bugs:read']), 'list_bug_comments').handler({ id: 'other' })).rejects.toThrow(/not found/i);
  });

  it('toCommentHtml wraps plain text per line, escapes it, and passes HTML through', () => {
    expect(toCommentHtml('hello world')).toBe('<p>hello world</p>');
    expect(toCommentHtml('line 1\r\n\nline 3')).toBe('<p>line 1</p><p></p><p>line 3</p>');
    expect(toCommentHtml('a < b & c > d')).toBe('<p>a &lt; b &amp; c &gt; d</p>');
    expect(toCommentHtml('<p>already <b>html</b></p>')).toBe('<p>already <b>html</b></p>');
    expect(toCommentHtml('<ul><li>x</li></ul>')).toBe('<ul><li>x</li></ul>');
  });

  it('add_task_comment posts as the token owner, or replies with parentId', async () => {
    const { svc, comments } = makeServices();
    const res = await tool(svc, session(['tasks:write']), 'add_task_comment').handler({ taskKey: 'AXC-1', content: 'hello world' });
    expect(JSON.parse(res.content[0].text)).toEqual({ id: 'cnew', taskId: 'task1', authorId: 'u1', content: '<p>hello world</p>' });
    await tool(svc, session(['tasks:write']), 'add_task_comment').handler({ id: 'task1', content: 'hi', parentId: 'c1' });
    expect(comments.createReply).toHaveBeenCalledWith('task1', 'c1', 'u1', '<p>hi</p>');
  });

  it('add_task_comment needs tasks:write + write consent and rejects cross-project tasks', async () => {
    const { svc, comments } = makeServices();
    await expect(tool(svc, session(['tasks:read']), 'add_task_comment').handler({ id: 'task1', content: 'x' })).rejects.toThrow(/scope: tasks:write/);
    await expect(tool(svc, session(['tasks:write'], false), 'add_task_comment').handler({ id: 'task1', content: 'x' })).rejects.toThrow(/write consent/);
    await expect(tool(svc, session(['tasks:write']), 'add_task_comment').handler({ id: 'other', content: 'x' })).rejects.toThrow(/not found/i);
    await expect(tool(svc, session(['tasks:write']), 'add_task_comment').handler({ content: 'x' })).rejects.toThrow(/Provide id or taskKey/);
    expect(comments.create).not.toHaveBeenCalled();
  });

  it('add_bug_comment posts as the token owner, or replies with parentId', async () => {
    const { svc, comments } = makeServices();
    const res = await tool(svc, session(['bugs:write']), 'add_bug_comment').handler({ bugKey: 'AXC-BUG-1', content: 'hello world' });
    expect(JSON.parse(res.content[0].text)).toEqual({ id: 'cnew', bugId: 'bug1', authorId: 'u1', content: '<p>hello world</p>' });
    await tool(svc, session(['bugs:write']), 'add_bug_comment').handler({ id: 'bug1', content: 'hi', parentId: 'c1' });
    expect(comments.createReplyForBug).toHaveBeenCalledWith('bug1', 'c1', 'u1', '<p>hi</p>');
  });

  it('add_bug_comment needs bugs:write + write consent and rejects cross-project bugs', async () => {
    const { svc, comments } = makeServices();
    await expect(tool(svc, session(['bugs:read']), 'add_bug_comment').handler({ id: 'bug1', content: 'x' })).rejects.toThrow(/scope: bugs:write/);
    await expect(tool(svc, session(['bugs:write'], false), 'add_bug_comment').handler({ id: 'bug1', content: 'x' })).rejects.toThrow(/write consent/);
    await expect(tool(svc, session(['bugs:write']), 'add_bug_comment').handler({ id: 'other', content: 'x' })).rejects.toThrow(/not found/i);
    expect(comments.createForBug).not.toHaveBeenCalled();
  });

  it('create_bug requires bugs:create, and bugs:read alone is not enough', async () => {
    const { svc, bugs } = makeServices();
    await expect(
      tool(svc, session(['bugs:read']), 'create_bug').handler({ title: 'Broken', severity: 'HIGH' }),
    ).rejects.toThrow(/scope: bugs:create/);
    expect(bugs.create).not.toHaveBeenCalled();
  });

  it('create_bug is blocked without write consent', async () => {
    const { svc, bugs } = makeServices();
    await expect(
      tool(svc, session(['bugs:create'], false), 'create_bug').handler({ title: 'Broken', severity: 'HIGH' }),
    ).rejects.toThrow(/write consent/);
    expect(bugs.create).not.toHaveBeenCalled();
  });

  it('create_bug uses projectId + reporter from the session', async () => {
    const { svc, bugs } = makeServices();
    const res = await tool(svc, session(['bugs:create']), 'create_bug').handler({
      title: 'Broken', severity: 'HIGH', assigneeId: 'u1',
    });
    expect(bugs.create).toHaveBeenCalledWith('p1', 'u1', { title: 'Broken', severity: 'HIGH', assigneeId: 'u1' });
    expect(JSON.parse(res.content[0].text)).toMatchObject({ id: 'bugnew', projectId: 'p1', reporterId: 'u1' });
  });

  it('create_bug rejects an assignee or owner outside the project', async () => {
    const { svc, bugs } = makeServices();
    await expect(
      tool(svc, session(['bugs:create']), 'create_bug').handler({ title: 'Broken', severity: 'LOW', assigneeId: 'stranger' }),
    ).rejects.toThrow(/assigneeId is not a member/);
    await expect(
      tool(svc, session(['bugs:create']), 'create_bug').handler({ title: 'Broken', severity: 'LOW', ownerId: 'stranger' }),
    ).rejects.toThrow(/ownerId is not a member/);
    expect(bugs.create).not.toHaveBeenCalled();
  });
});

describe('MCP update_bug / list_bug_statuses', () => {
  it('list_bug_statuses returns this project bug statuses; needs bugs:read', async () => {
    const { svc } = makeServices();
    const res = await tool(svc, session(['bugs:read']), 'list_bug_statuses').handler({});
    expect(JSON.parse(res.content[0].text).map((s: any) => s.id)).toEqual(['bs-open', 'bs-closed']);
    await expect(tool(svc, session(['tasks:read']), 'list_bug_statuses').handler({})).rejects.toThrow(/scope: bugs:read/);
  });

  it('update_bug needs bugs:write — bugs:create alone is not enough', async () => {
    const { svc, bugs } = makeServices();
    await expect(
      tool(svc, session(['bugs:create', 'bugs:read']), 'update_bug').handler({ id: 'bug1', severity: 'LOW' }),
    ).rejects.toThrow(/scope: bugs:write/);
    expect(bugs.update).not.toHaveBeenCalled();
  });

  it('update_bug is blocked without write consent', async () => {
    const { svc, bugs } = makeServices();
    await expect(
      tool(svc, session(['bugs:write'], false), 'update_bug').handler({ id: 'bug1', severity: 'LOW' }),
    ).rejects.toThrow(/write consent/);
    expect(bugs.update).not.toHaveBeenCalled();
  });

  it('update_bug by bugKey passes only the given fields with the session user as actor', async () => {
    const { svc, bugs } = makeServices();
    await tool(svc, session(['bugs:write']), 'update_bug').handler({
      bugKey: 'TM-BUG-1', severity: 'CRITICAL', workflowStatusId: 'bs-closed', assigneeId: null,
    });
    expect(bugs.update).toHaveBeenCalledWith(
      'bug1', { severity: 'CRITICAL', workflowStatusId: 'bs-closed', assigneeId: null }, 'u1',
    );
  });

  it('update_bug rejects bugs from another project', async () => {
    const { svc, bugs } = makeServices();
    await expect(
      tool(svc, session(['bugs:write']), 'update_bug').handler({ bugKey: 'other', severity: 'LOW' }),
    ).rejects.toThrow(/not found/i);
    expect(bugs.update).not.toHaveBeenCalled();
  });

  it('update_bug rejects a task status, another project status, or an unknown status', async () => {
    const { svc, bugs } = makeServices();
    for (const workflowStatusId of ['ts-todo', 'bs-p2', 'nope']) {
      await expect(
        tool(svc, session(['bugs:write']), 'update_bug').handler({ id: 'bug1', workflowStatusId }),
      ).rejects.toThrow(/not a bug status/);
    }
    expect(bugs.update).not.toHaveBeenCalled();
  });

  it('update_bug rejects assignee/owner outside the project', async () => {
    const { svc, bugs } = makeServices();
    await expect(
      tool(svc, session(['bugs:write']), 'update_bug').handler({ id: 'bug1', assigneeId: 'stranger' }),
    ).rejects.toThrow(/assigneeId is not a member/);
    await expect(
      tool(svc, session(['bugs:write']), 'update_bug').handler({ id: 'bug1', ownerId: 'stranger' }),
    ).rejects.toThrow(/ownerId is not a member/);
    expect(bugs.update).not.toHaveBeenCalled();
  });
});

describe('MCP write tools', () => {
  it('registers the full read+write surface', () => {
    const { svc } = makeServices();
    const names = svc.tools(session(ALL_SCOPES)).map((t) => t.name).sort();
    expect(names).toEqual([
      'add_bug_comment', 'add_task_comment', 'attach_result_file', 'attach_task_file', 'create_bug', 'create_task', 'create_test_case', 'create_test_execution',
      'get_bug', 'get_task', 'get_test_case', 'get_test_execution',
      'list_bug_comments', 'list_bug_statuses', 'list_bugs', 'list_project_members', 'list_task_comments', 'list_task_types', 'list_tasks',
      'list_test_cases', 'list_test_executions', 'list_test_modules',
      'log_time', 'update_bug', 'update_execution_result', 'update_task', 'update_test_case',
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
