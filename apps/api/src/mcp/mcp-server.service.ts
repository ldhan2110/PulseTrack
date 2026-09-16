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
const TESTCASES_READ = 'testcases:read';
const TESTCASES_WRITE = 'testcases:write';
const EXEC_READ = 'testexec:read';
const EXEC_WRITE = 'testexec:write';

const PRIORITY = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BLOCKER']);
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
}

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
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
        name: 'list_task_types',
        description: "List this project's task types. Use a type's id as taskTypeId when creating a task.",
        inputSchema: {},
        handler: async () => {
          requireScope(session, TASKS_READ);
          return json(await this.projects.getTaskTypes(session.projectId));
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
        description: 'Get one bug by id.',
        inputSchema: { id: z.string() },
        handler: async ({ id }) => {
          requireScope(session, BUGS_READ);
          const bug = await this.bugs.findOne(id);
          if (!bug || bug.projectId !== session.projectId) {
            throw new Error('Bug not found');
          }
          return json(bug);
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
