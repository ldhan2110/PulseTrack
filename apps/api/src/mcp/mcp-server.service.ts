import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpSession } from './mcp-pat.guard';

// Builds a per-session MCP server. Tools are registered in registerTools (T4),
// each closing over the session so projectId/scopes come from the token only.
@Injectable()
export class McpServerService {
  build(session: McpSession): McpServer {
    const server = new McpServer(
      { name: 'pulsetrack', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
    this.registerTools(server, session);
    return server;
  }

  // Overridden/extended in T4 with the read-only tool surface.
  // ponytail: empty until T4 wires list/get tasks+bugs.
  protected registerTools(_server: McpServer, _session: McpSession): void {}
}
