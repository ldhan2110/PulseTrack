import { MultiServerMCPClient } from '@langchain/mcp-adapters';

/**
 * Spawn the GitNexus MCP server over stdio and return its tools plus a close()
 * handle. GitNexus is installed globally on the API machine; `gitnexus mcp`
 * reads the shared ~/.gitnexus/registry.json, so per-repo tools reach any
 * indexed repo — the caller passes the target repo's registered name as the
 * `repo` tool argument (we register under repo.name at `gitnexus analyze` time).
 */
export async function gitnexusMcpTools() {
  const client = new MultiServerMCPClient({
    mcpServers: {
      gitnexus: {
        transport: 'stdio',
        command: process.env.GITNEXUS_BIN || 'gitnexus',
        args: ['mcp'],
      },
    },
  });
  const tools = await client.getTools();
  return { tools, close: () => client.close() };
}
