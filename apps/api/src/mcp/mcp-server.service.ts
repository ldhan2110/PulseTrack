import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';
import { TasksService } from '../tasks/tasks.service';
import { BugsService } from '../bugs/bugs.service';
import { TestCasesService } from '../test-cases/test-cases.service';
import { TimeLogsService } from '../time-logs/time-logs.service';
import { TestModulesService } from '../test-modules/test-modules.service';
import { ProjectsService } from '../projects/projects.service';
import { TestExecutionsService } from '../test-executions/test-executions.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { CommentsService } from '../comments/comments.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { McpSession } from './mcp-pat.guard';

const TASKS_READ = 'tasks:read';
const TASKS_WRITE = 'tasks:write';
const TASKS_LOGTIME = 'tasks:logtime';
const TASKS_ATTACH = 'tasks:attach';
const BUGS_READ = 'bugs:read';
const BUGS_CREATE = 'bugs:create';
const BUGS_WRITE = 'bugs:write';
const TESTCASES_READ = 'testcases:read';
const TESTCASES_WRITE = 'testcases:write';
const EXEC_READ = 'testexec:read';
const EXEC_WRITE = 'testexec:write';

// Scopes that mutate data as the token owner — gated behind per-token write consent.
const WRITE_SCOPES = new Set([TASKS_WRITE, TASKS_LOGTIME, TASKS_ATTACH, BUGS_CREATE, BUGS_WRITE, TESTCASES_WRITE, EXEC_WRITE]);

const PRIORITY = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BLOCKER']);
const BUG_SEVERITY = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
const TESTCASE_STATUS = z.enum(['DRAFT', 'ACTIVE', 'DEPRECATED']);
const RESULT_STATUS = z.enum(['NOT_RUN', 'IN_PROGRESS', 'PASS', 'FAIL', 'BLOCKED', 'SKIP']);

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'test-executions');
const TASK_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'tasks');
const MAX_ATTACH_BYTES = 2 * 1024 * 1024;

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (args: any) => Promise<{ content: { type: 'text'; text: string }[] }>;
}

function requireScope(session: McpSession, scope: string): void {
  if (!session.scopes.includes(scope)) {
    // Surfaced to the agent as an MCP tool error; no data is returned.
    throw new Error(`Missing required scope: ${scope}`);
  }
  // Missing-scope check first so it takes precedence over the consent gate.
  if (WRITE_SCOPES.has(scope) && !session.allowWrite) {
    throw new Error('Agent writes not permitted: token has no write consent');
  }
}

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

// Drops UI-only like data from a comment tree before handing it to an agent.
function stripLikes(comments: any[]): any[] {
  return comments.map(({ likes: _likes, replies, ...c }) => ({
    ...c,
    replies: stripLikes(replies ?? []),
  }));
}

// The web editor stores comments as HTML (<p> per paragraph). Agents usually send
// plain text, so wrap each line in <p> (escaped) to match. Content that already
// starts with a block-level tag is treated as HTML and passed through unchanged.
const HTML_BLOCK_START = /^\s*<(p|ul|ol|h[1-6]|blockquote|pre|div)[\s>]/i;
export function toCommentHtml(content: string): string {
  if (HTML_BLOCK_START.test(content)) return content;
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => `<p>${escape(line)}</p>`)
    .join('');
}

// Builds a per-session MCP server. Every tool closes over the session so
// projectId comes from the token — never a tool arg — and asserts its resource
// scope before touching a service. Write tools accept a human key (taskKey /
// testCaseKey) OR a raw id; keys are globally @unique, so after resolving a key
// the tool re-asserts projectId === session.projectId (security boundary).
@Injectable()
export class McpServerService {
  constructor(
    private readonly tasks: TasksService,
    private readonly bugs: BugsService,
    private readonly testCases: TestCasesService,
    private readonly timeLogs: TimeLogsService,
    private readonly testModules: TestModulesService,
    private readonly projects: ProjectsService,
    private readonly testExecutions: TestExecutionsService,
    private readonly attachments: AttachmentsService,
    private readonly prisma: PrismaService,
    private readonly comments: CommentsService,
  ) {}

  build(session: McpSession): McpServer {
    const server = new McpServer(
      { name: 'pulsetrack', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
    for (const tool of this.tools(session)) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputSchema },
        tool.handler,
      );
    }
    return server;
  }

  // Resolve a task by id or taskKey and enforce project isolation.
  private async resolveTask(session: McpSession, id?: string, taskKey?: string) {
    const task = taskKey
      ? await this.tasks.findByTaskKey(taskKey)
      : await this.tasks.findOne(id as string);
    if (!task || task.projectId !== session.projectId) {
      throw new Error('Task not found');
    }
    return task;
  }

  // Resolve a bug by id or bugKey and enforce project isolation.
  private async resolveBug(session: McpSession, id?: string, bugKey?: string) {
    if (!id && !bugKey) throw new Error('Provide id or bugKey');
    const bug = bugKey
      ? await this.bugs.findByBugKey(bugKey)
      : await this.bugs.findOne(id as string);
    if (!bug || bug.projectId !== session.projectId) {
      throw new Error('Bug not found');
    }
    return bug;
  }

  // Throws unless userId is a member of the token's project.
  private async assertMember(session: McpSession, userId: string, field: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: session.projectId, userId } },
    });
    if (!member) throw new Error(`${field} is not a member of this project`);
  }

  // Resolve a test case by id or testCaseKey and enforce project isolation.
  private async resolveTestCase(session: McpSession, id?: string, testCaseKey?: string) {
    const tc = testCaseKey
      ? await this.testCases.findByKey(testCaseKey)
      : await this.testCases.findOne(id as string);
    if (!tc || tc.projectId !== session.projectId) {
      throw new Error('Test case not found');
    }
    return tc;
  }

  // Resolve an execution by key or id and enforce project isolation.
  private async resolveExecution(session: McpSession, executionId?: string, executionKey?: string) {
    const exec = executionKey
      ? await this.testExecutions.findByKey(executionKey)
      : await this.testExecutions.findOne(executionId as string);
    if (!exec || exec.projectId !== session.projectId) {
      throw new Error('Execution not found');
    }
    return exec;
  }

  // Resolve to an executionCaseId from either a direct id, or (executionKey, testCaseKey).
  private async resolveExecCase(
    session: McpSession,
    args: { executionCaseId?: string; executionKey?: string; testCaseKey?: string },
  ): Promise<string> {
    if (args.executionCaseId) {
      const row = await this.prisma.testExecutionCase.findUnique({
        where: { id: args.executionCaseId },
        include: { execution: { select: { projectId: true } } },
      });
      if (!row || row.execution.projectId !== session.projectId) {
        throw new Error('Execution case not found');
      }
      return row.id;
    }
    if (!args.executionKey || !args.testCaseKey) {
      throw new Error('Provide executionCaseId, or both executionKey and testCaseKey');
    }
    const exec = await this.resolveExecution(session, undefined, args.executionKey);
    const match = (exec as any).cases?.find(
      (c: any) => c.testCase?.testCaseKey === args.testCaseKey,
    );
    if (!match) {
      throw new Error(`Test case ${args.testCaseKey} not in execution ${args.executionKey}`);
    }
    return match.id;
  }

  tools(session: McpSession): McpToolDef[] {
    return [
      // ---- tasks: read ----
      {
        name: 'list_tasks',
        description: "List this project's tasks.",
        inputSchema: {},
        handler: async () => {
          requireScope(session, TASKS_READ);
          return json(await this.tasks.findAll(session.projectId));
        },
      },
      {
        name: 'get_task',
        description: 'Get one task by id.',
        inputSchema: { id: z.string() },
        handler: async ({ id }) => {
          requireScope(session, TASKS_READ);
          const task = await this.tasks.findOne(id);
          // findOne takes only id — enforce project isolation here.
          if (!task || task.projectId !== session.projectId) {
            throw new Error('Task not found');
          }
          return json(task);
        },
      },
      {
        name: 'list_task_comments',
        description: 'List the comment thread (with nested replies) on a task, by id or taskKey (e.g. AXC-1).',
        inputSchema: { id: z.string().optional(), taskKey: z.string().optional() },
        handler: async ({ id, taskKey }) => {
          requireScope(session, TASKS_READ);
          if (!id && !taskKey) throw new Error('Provide id or taskKey');
          const task = await this.resolveTask(session, id, taskKey);
          return json(stripLikes(await this.comments.findAll(task.id)));
        },
      },
      {
        name: 'list_task_types',
        description: "List this project's task types. Use a type's id as taskTypeId when creating a task.",
        inputSchema: {},
        handler: async () => {
          requireScope(session, TASKS_READ);
          return json(await this.projects.getTaskTypes(session.projectId));
        },
      },
      {
        name: 'list_project_members',
        description: "List this project's members. Use a member's userId as assigneeId when creating or updating a task.",
        inputSchema: {},
        handler: async () => {
          requireScope(session, TASKS_READ);
          const members = await this.prisma.projectMember.findMany({
            where: { projectId: session.projectId },
            select: { user: { select: { id: true, name: true, username: true, email: true } } },
          });
          return json(members.map((m) => m.user));
        },
      },
      // ---- bugs: read ----
      {
        name: 'list_bugs',
        description: "List this project's bugs.",
        inputSchema: {},
        handler: async () => {
          requireScope(session, BUGS_READ);
          return json(await this.bugs.findAll(session.projectId));
        },
      },
      {
        name: 'get_bug',
        description: 'Get one bug by id or bugKey (e.g. AXC-BUG-1). Provide exactly one.',
        inputSchema: { id: z.string().optional(), bugKey: z.string().optional() },
        handler: async ({ id, bugKey }) => {
          requireScope(session, BUGS_READ);
          return json(await this.resolveBug(session, id, bugKey));
        },
      },
      {
        name: 'list_bug_statuses',
        description: "List this project's bug workflow statuses. Use a status's id as workflowStatusId in update_bug.",
        inputSchema: {},
        handler: async () => {
          requireScope(session, BUGS_READ);
          return json(
            await this.prisma.workflowStatus.findMany({
              where: { projectId: session.projectId, kind: 'BUG' },
              select: { id: true, name: true, key: true, isDefault: true, isClosed: true },
              orderBy: { position: 'asc' },
            }),
          );
        },
      },
      {
        name: 'list_bug_comments',
        description: 'List the comment thread (with nested replies) on a bug, by id or bugKey.',
        inputSchema: { id: z.string().optional(), bugKey: z.string().optional() },
        handler: async ({ id, bugKey }) => {
          requireScope(session, BUGS_READ);
          const bug = await this.resolveBug(session, id, bugKey);
          return json(stripLikes(await this.comments.findAllForBug(bug.id)));
        },
      },
      // ---- bugs: create ----
      {
        name: 'create_bug',
        description:
          'Report a bug in this project. assigneeId/ownerId must be project members (see list_project_members).',
        inputSchema: {
          title: z.string().min(3).max(200),
          severity: BUG_SEVERITY,
          description: z.string().max(5000).optional(),
          preconditions: z.string().max(5000).optional(),
          environment: z.string().max(1000).optional(),
          expectedResult: z.string().optional(),
          actualResult: z.string().optional(),
          assigneeId: z.string().optional(),
          ownerId: z.string().optional(),
          reproSteps: z
            .array(z.object({ position: z.number().int().min(0), content: z.string().max(2000) }))
            .optional(),
        },
        handler: async (dto) => {
          requireScope(session, BUGS_CREATE);
          if (dto.assigneeId) await this.assertMember(session, dto.assigneeId, 'assigneeId');
          if (dto.ownerId) await this.assertMember(session, dto.ownerId, 'ownerId');
          return json(await this.bugs.create(session.projectId, session.userId, dto));
        },
      },
      // ---- bugs: write ----
      {
        name: 'update_bug',
        description:
          'Update a bug by id or bugKey (provide exactly one). Only the fields you pass change. ' +
          'workflowStatusId must come from list_bug_statuses; assigneeId/ownerId must be project members (null unassigns). ' +
          'reproSteps, when given, replaces the whole step list.',
        inputSchema: {
          id: z.string().optional(),
          bugKey: z.string().optional(),
          title: z.string().min(3).max(200).optional(),
          severity: BUG_SEVERITY.optional(),
          workflowStatusId: z.string().optional(),
          description: z.string().max(5000).optional(),
          preconditions: z.string().max(5000).optional(),
          environment: z.string().max(1000).optional(),
          expectedResult: z.string().optional(),
          actualResult: z.string().optional(),
          assigneeId: z.string().nullable().optional(),
          ownerId: z.string().nullable().optional(),
          reproSteps: z
            .array(z.object({ position: z.number().int().min(0), content: z.string().max(2000) }))
            .optional(),
        },
        handler: async ({ id, bugKey, ...dto }) => {
          requireScope(session, BUGS_WRITE);
          const bug = await this.resolveBug(session, id, bugKey);
          if (dto.assigneeId) await this.assertMember(session, dto.assigneeId, 'assigneeId');
          if (dto.ownerId) await this.assertMember(session, dto.ownerId, 'ownerId');
          if (dto.workflowStatusId !== undefined) {
            // BugsService.update accepts any existing status id, so pin it to this
            // project's BUG workflow here.
            const status = await this.prisma.workflowStatus.findFirst({
              where: { id: dto.workflowStatusId, projectId: session.projectId, kind: 'BUG' },
              select: { id: true },
            });
            if (!status) throw new Error('workflowStatusId is not a bug status of this project (see list_bug_statuses)');
          }
          return json(await this.bugs.update(bug.id, dto, session.userId));
        },
      },
      {
        name: 'add_bug_comment',
        description:
          'Add a comment to a bug, by id or bugKey (provide exactly one), as the token owner. ' +
          'Pass parentId (a comment id from list_bug_comments) to reply instead. ' +
          'Plain text is converted to HTML (one <p> per line); content starting with a block tag (<p>, <ul>, ...) is stored as-is.',
        inputSchema: {
          id: z.string().optional(),
          bugKey: z.string().optional(),
          content: z.string().trim().min(1).max(5000),
          parentId: z.string().optional(),
        },
        handler: async ({ id, bugKey, content, parentId }) => {
          requireScope(session, BUGS_WRITE);
          const bug = await this.resolveBug(session, id, bugKey);
          const html = toCommentHtml(content);
          const comment = parentId
            ? await this.comments.createReplyForBug(bug.id, parentId, session.userId, html)
            : await this.comments.createForBug(bug.id, session.userId, html);
          return json(comment);
        },
      },
      // ---- tasks: write ----
      {
        name: 'create_task',
        description: 'Create a task in this project. Requires taskTypeId; pass parentId to create a sub-task.',
        inputSchema: {
          title: z.string().min(3).max(200),
          taskTypeId: z.string(),
          description: z.string().max(5000).optional(),
          assigneeId: z.string().optional(),
          storyPoints: z.number().int().min(1).max(100).optional(),
          sprintId: z.string().optional(),
          acceptanceCriteria: z.string().max(5000).optional(),
          priority: PRIORITY.optional(),
          parentId: z.string().optional(),
          estimatedMinutes: z.number().int().min(1).optional(),
          requestedDate: z.string().optional(),
          receiptDate: z.string().optional(),
          plannedStartDate: z.string().optional(),
          plannedEndDate: z.string().optional(),
          actualStartDate: z.string().optional(),
          actualEndDate: z.string().optional(),
        },
        handler: async (dto) => {
          requireScope(session, TASKS_WRITE);
          return json(await this.tasks.create(session.projectId, session.userId, dto));
        },
      },
      {
        name: 'update_task',
        description: 'Update a task by id or taskKey (e.g. AXC-1). Provide exactly one.',
        inputSchema: {
          id: z.string().optional(),
          taskKey: z.string().optional(),
          title: z.string().max(200).optional(),
          description: z.string().max(5000).optional(),
          workflowStatusId: z.string().optional(),
          taskTypeId: z.string().optional(),
          assigneeId: z.string().nullable().optional(),
          storyPoints: z.number().int().min(1).max(100).optional(),
          sprintId: z.string().nullable().optional(),
          acceptanceCriteria: z.string().max(5000).optional(),
          priority: PRIORITY.nullable().optional(),
          estimatedMinutes: z.number().int().min(1).nullable().optional(),
          progress: z.number().int().min(0).max(100).optional(),
        },
        handler: async ({ id, taskKey, ...dto }) => {
          requireScope(session, TASKS_WRITE);
          const task = await this.resolveTask(session, id, taskKey);
          return json(await this.tasks.update(task.id, dto, session.userId));
        },
      },
      {
        name: 'add_task_comment',
        description:
          'Add a comment to a task, by id or taskKey (e.g. AXC-1; provide exactly one), as the token owner. ' +
          'Pass parentId (a comment id from list_task_comments) to reply instead. ' +
          'Plain text is converted to HTML (one <p> per line); content starting with a block tag (<p>, <ul>, ...) is stored as-is.',
        inputSchema: {
          id: z.string().optional(),
          taskKey: z.string().optional(),
          content: z.string().trim().min(1).max(5000),
          parentId: z.string().optional(),
        },
        handler: async ({ id, taskKey, content, parentId }) => {
          requireScope(session, TASKS_WRITE);
          if (!id && !taskKey) throw new Error('Provide id or taskKey');
          const task = await this.resolveTask(session, id, taskKey);
          const html = toCommentHtml(content);
          const comment = parentId
            ? await this.comments.createReply(task.id, parentId, session.userId, html)
            : await this.comments.create(task.id, session.userId, html);
          return json(comment);
        },
      },
      // ---- tasks: log time ----
      {
        name: 'log_time',
        description: 'Log time against a task (by id or taskKey). Task must have an estimate and no sub-tasks.',
        inputSchema: {
          id: z.string().optional(),
          taskKey: z.string().optional(),
          minutes: z.number().int().min(1).max(1440),
          comment: z.string().optional(),
          loggedAt: z.string().optional(),
          progress: z.number().int().min(0).max(100).optional(),
        },
        handler: async ({ id, taskKey, ...dto }) => {
          requireScope(session, TASKS_LOGTIME);
          const task = await this.resolveTask(session, id, taskKey);
          return json(
            await this.timeLogs.create(session.projectId, task.id, session.userId, dto),
          );
        },
      },
      // ---- test cases: read ----
      {
        name: 'list_test_modules',
        description: "List this project's test modules (use a module's id for create_test_case).",
        inputSchema: {},
        handler: async () => {
          requireScope(session, TESTCASES_READ);
          return json(await this.testModules.findAll(session.projectId));
        },
      },
      {
        name: 'list_test_cases',
        description: "List this project's test cases.",
        inputSchema: {},
        handler: async () => {
          requireScope(session, TESTCASES_READ);
          return json(await this.testCases.findAll(session.projectId));
        },
      },
      {
        name: 'get_test_case',
        description: 'Get one test case by id or testCaseKey. Provide exactly one.',
        inputSchema: { id: z.string().optional(), testCaseKey: z.string().optional() },
        handler: async ({ id, testCaseKey }) => {
          requireScope(session, TESTCASES_READ);
          return json(await this.resolveTestCase(session, id, testCaseKey));
        },
      },
      // ---- test cases: write ----
      {
        name: 'create_test_case',
        description: 'Create a test case in this project. Requires a moduleId (see list_test_modules).',
        inputSchema: {
          title: z.string().min(3).max(200),
          moduleId: z.string(),
          preconditions: z.string().max(5000).optional(),
          expectedResult: z.string().max(5000).optional(),
          priority: PRIORITY.optional(),
          tags: z.array(z.string()).optional(),
          estimatedMinutes: z.number().int().min(1).optional(),
          steps: z
            .array(
              z.object({
                position: z.number().int().min(0),
                action: z.string().max(2000),
                expectedResult: z.string().max(2000),
              }),
            )
            .optional(),
          links: z
            .array(z.object({ entityType: z.string(), entityId: z.string() }))
            .optional(),
        },
        handler: async (dto) => {
          requireScope(session, TESTCASES_WRITE);
          return json(await this.testCases.create(session.projectId, session.userId, dto));
        },
      },
      {
        name: 'update_test_case',
        description: 'Update a test case by id or testCaseKey. Provide exactly one.',
        inputSchema: {
          id: z.string().optional(),
          testCaseKey: z.string().optional(),
          title: z.string().min(3).max(200).optional(),
          preconditions: z.string().max(5000).optional(),
          expectedResult: z.string().max(5000).optional(),
          priority: PRIORITY.optional(),
          status: TESTCASE_STATUS.optional(),
          tags: z.array(z.string()).optional(),
          estimatedMinutes: z.number().int().min(1).optional(),
          moduleId: z.string().optional(),
          steps: z
            .array(
              z.object({
                position: z.number().int().min(0),
                action: z.string().max(2000),
                expectedResult: z.string().max(2000),
              }),
            )
            .optional(),
          links: z
            .array(z.object({ entityType: z.string(), entityId: z.string() }))
            .optional(),
        },
        handler: async ({ id, testCaseKey, ...dto }) => {
          requireScope(session, TESTCASES_WRITE);
          const tc = await this.resolveTestCase(session, id, testCaseKey);
          return json(await this.testCases.update(tc.id, dto));
        },
      },
      // ---- test executions: read ----
      {
        name: 'list_test_executions',
        description: "List this project's test executions.",
        inputSchema: {},
        handler: async () => {
          requireScope(session, EXEC_READ);
          return json(await this.testExecutions.findAll(session.projectId));
        },
      },
      {
        name: 'get_test_execution',
        description:
          'Get one test execution by executionKey (e.g. AXC-TX-1) or executionId, including its cases. Each case has executionCaseId, testCaseKey and current result.',
        inputSchema: { executionId: z.string().optional(), executionKey: z.string().optional() },
        handler: async ({ executionId, executionKey }) => {
          requireScope(session, EXEC_READ);
          const exec: any = await this.resolveExecution(session, executionId, executionKey);
          const cases = (exec.cases ?? []).map((c: any) => ({
            executionCaseId: c.id,
            testCaseKey: c.testCase?.testCaseKey ?? null,
            result: c.result,
          }));
          return json({
            id: exec.id,
            executionKey: exec.executionKey,
            name: exec.name,
            status: exec.status,
            cases,
          });
        },
      },
      // ---- test executions: write ----
      {
        name: 'create_test_execution',
        description:
          'Create a test execution from test-case keys. Resolves each key to a case; unknown keys fail loud. Assignee defaults to the token user.',
        inputSchema: {
          name: z.string().min(1).max(200),
          testCaseKeys: z.array(z.string()).min(1),
          sprintId: z.string().optional(),
        },
        handler: async ({ name, testCaseKeys, sprintId }) => {
          requireScope(session, EXEC_WRITE);
          const found = await this.prisma.testCase.findMany({
            where: { testCaseKey: { in: testCaseKeys }, projectId: session.projectId },
            select: { id: true, testCaseKey: true },
          });
          const byKey = new Map(found.map((tc) => [tc.testCaseKey, tc.id]));
          const missing = testCaseKeys.filter((k) => !byKey.has(k));
          if (missing.length > 0) {
            throw new Error(`Unknown test case key(s): ${missing.join(', ')}`);
          }
          const testCaseIds = testCaseKeys.map((k) => byKey.get(k) as string);
          return json(
            await this.testExecutions.create(
              session.projectId,
              { name, assigneeId: session.userId, sprintId, testCaseIds },
              session.userId,
            ),
          );
        },
      },
      {
        name: 'update_execution_result',
        description:
          "Set one execution case's result. Identify it by executionCaseId, or by (executionKey, testCaseKey). Execution status rolls up automatically.",
        inputSchema: {
          executionCaseId: z.string().optional(),
          executionKey: z.string().optional(),
          testCaseKey: z.string().optional(),
          result: RESULT_STATUS,
          notes: z.string().max(5000).optional(),
        },
        handler: async ({ executionCaseId, executionKey, testCaseKey, result, notes }) => {
          requireScope(session, EXEC_WRITE);
          const caseId = await this.resolveExecCase(session, {
            executionCaseId,
            executionKey,
            testCaseKey,
          });
          return json(
            await this.testExecutions.updateResult(caseId, session.userId, { result, notes }),
          );
        },
      },
      {
        name: 'attach_result_file',
        description:
          'Attach a base64-encoded file (e.g. failure screenshot, ≤2MB) to an execution case. Identify the case by executionCaseId, or by (executionKey, testCaseKey).',
        inputSchema: {
          executionCaseId: z.string().optional(),
          executionKey: z.string().optional(),
          testCaseKey: z.string().optional(),
          filename: z.string().min(1).max(255),
          mimeType: z.string().min(1).max(255),
          dataBase64: z.string().min(1),
        },
        handler: async ({ executionCaseId, executionKey, testCaseKey, filename, mimeType, dataBase64 }) => {
          requireScope(session, EXEC_WRITE);
          const buf = Buffer.from(dataBase64, 'base64');
          if (buf.length > MAX_ATTACH_BYTES) {
            throw new Error(`File exceeds 2MB limit (${buf.length} bytes)`);
          }
          const caseId = await this.resolveExecCase(session, {
            executionCaseId,
            executionKey,
            testCaseKey,
          });
          const dir = path.join(UPLOAD_DIR, caseId);
          fs.mkdirSync(dir, { recursive: true });
          const storedName = `${randomUUID()}${path.extname(filename)}`;
          fs.writeFileSync(path.join(dir, storedName), buf);
          return json(
            await this.testExecutions.createAttachment(caseId, session.userId, {
              originalname: filename,
              filename: storedName,
              mimetype: mimeType,
              size: buf.length,
            } as Express.Multer.File),
          );
        },
      },
      {
        name: 'attach_task_file',
        description:
          'Attach a base64-encoded file (e.g. a spec .md or an HTML UI mockup, ≤2MB) to a task. Identify the task by id or taskKey (e.g. AXC-1). Provide exactly one.',
        inputSchema: {
          id: z.string().optional(),
          taskKey: z.string().optional(),
          filename: z.string().min(1).max(255),
          mimeType: z.string().min(1).max(255),
          dataBase64: z.string().min(1),
        },
        handler: async ({ id, taskKey, filename, mimeType, dataBase64 }) => {
          requireScope(session, TASKS_ATTACH);
          const buf = Buffer.from(dataBase64, 'base64');
          if (buf.length > MAX_ATTACH_BYTES) {
            throw new Error(`File exceeds 2MB limit (${buf.length} bytes)`);
          }
          const task = await this.resolveTask(session, id, taskKey);
          const dir = path.join(TASK_UPLOAD_DIR, task.id);
          fs.mkdirSync(dir, { recursive: true });
          const storedName = `${randomUUID()}${path.extname(filename)}`;
          fs.writeFileSync(path.join(dir, storedName), buf);
          return json(
            await this.attachments.create(task.id, session.userId, {
              originalname: filename,
              filename: storedName,
              mimetype: mimeType,
              size: buf.length,
            } as Express.Multer.File),
          );
        },
      },
    ];
  }
}
