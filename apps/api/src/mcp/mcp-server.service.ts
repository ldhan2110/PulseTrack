import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';
import { TasksService } from '../tasks/tasks.service';
import { BugsService } from '../bugs/bugs.service';
import type { McpSession } from './mcp-pat.guard';

const TASKS_READ = 'tasks:read';
const BUGS_READ = 'bugs:read';

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

// Builds a per-session MCP server with the read-only tool surface. Every tool
// closes over the session so projectId comes from the token — never a tool arg —
// and asserts its resource scope before touching a service. No write tools.
@Injectable()
export class McpServerService {
  constructor(
    private readonly tasks: TasksService,
    private readonly bugs: BugsService,
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

  // The read-only tool surface. Exposed for testing; the four tools are the
  // whole surface — no create/update/delete.
  tools(session: McpSession): McpToolDef[] {
    return [
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
    ];
  }
}
