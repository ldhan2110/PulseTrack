import { MultiServerMCPClient } from '@langchain/mcp-adapters';

/**
 * Spawn the CodeGraph MCP server over stdio and return its tools plus a close()
 * handle. CodeGraph is installed globally on the API machine; `codegraph serve
 * --mcp` is a single server that reaches any indexed repo — the caller selects
 * the target by passing the repo's absolute workspace path as the `projectPath`
 * tool argument (each repo has its own `.codegraph/` under that path).
 */
export async function codegraphMcpTools() {
  const client = new MultiServerMCPClient({
    mcpServers: {
      codegraph: {
        transport: 'stdio',
        command: process.env.CODEGRAPH_BIN || 'codegraph',
        args: ['serve', '--mcp'],
      },
    },
  });
  const tools = await client.getTools();
  return { tools, close: () => client.close() };
}
