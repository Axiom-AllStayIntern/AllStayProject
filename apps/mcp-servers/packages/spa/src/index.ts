import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';

const app = express();
app.use(express.json());

app.post('/api/mcp', async (req, res) => {
	const server = new McpServer({ name: 'spa-mcp-server', version: '1.0.0' });
	registerTools(server);
	const transport = new StreamableHTTPServerTransport({});
	await server.connect(transport);
	await transport.handleRequest(req, res, req.body);
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'spa' }));

const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => console.log(`Spa MCP Server running on :${PORT}`));
