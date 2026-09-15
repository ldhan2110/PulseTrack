import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';
import { TasksService } from '../tasks/tasks.service';
import { BugsService } from '../bugs/bugs.service';
import { TestCasesService } from '../test-cases/test-cases.service';
import { TimeLogsService } from '../time-logs/time-logs.service';
import { TestModulesService } from '../test-modules/test-modules.service';
import { ProjectsService } from '../projects/projects.service';
import type { McpSession } from './mcp-pat.guard';

const TASKS_READ = 'tasks:read';
const TASKS_WRITE = 'tasks:write';
const TASKS_LOGTIME = 'tasks:logtime';
const BUGS_READ = 'bugs:read';
const TESTCASES_READ = 'testcases:read';
const TESTCASES_WRITE = 'testcases:write';

const PRIORITY = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BLOCKER']);
const TESTCASE_STATUS = z.enum(['DRAFT', 'ACTIVE', 'DEPRECATED']);

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
    ];
  }
}
