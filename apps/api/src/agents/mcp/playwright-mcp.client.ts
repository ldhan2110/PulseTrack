import { MultiServerMCPClient } from '@langchain/mcp-adapters';

/**
 * Connect to the playwright-mcp server over HTTP and return its tools plus a
 * close() handle. Tools are passed to the deep agent so the model can inspect
 * the live page (browser_snapshot → ref) while writing selectors.
 */
export async function playwrightMcpTools(url: string) {
  const client = new MultiServerMCPClient({
    mcpServers: {
      // ponytail: image:'artifact' drops screenshot blocks from message content.
      // Anthropic rejects the adapter's `image_url`-typed tool_result, and the
      // text-snapshot workflow never needs images in-context anyway.
      playwright: { url, transport: 'http', outputHandling: { image: 'artifact' } },
    },
  });
  // ponytail: drop file-write tools (e.g. `save`) — the agent returns script
  // text, never writes to disk.
  const tools = (await client.getTools());
  return { tools, close: () => client.close() };
}
