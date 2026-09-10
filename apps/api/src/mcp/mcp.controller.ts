import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpPatGuard } from './mcp-pat.guard';
import type { McpSession } from './mcp-pat.guard';
import { McpServerService } from './mcp-server.service';

// The /mcp endpoint. NOT behind JwtAuthGuard — McpPatGuard is the trust boundary
// (external agents have no Keycloak session). Stateless streamable HTTP: one
// server + transport per request, torn down on close.
@Controller('mcp')
@UseGuards(McpPatGuard)
export class McpController {
  constructor(private readonly servers: McpServerService) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response) {
    const session = (req as any).mcpSession as McpSession;
    const server = this.servers.build(session);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, (req as any).body);
  }
}
