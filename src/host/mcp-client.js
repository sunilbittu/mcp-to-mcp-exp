/**
 * MCP client wrapper.
 *
 * Spawns the local weather MCP server as a stdio child process and exposes a
 * singleton client. Each tool invocation is wrapped in a New Relic segment so
 * the call shows up in the distributed trace under the calling transaction.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { instrument } from './telemetry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.resolve(__dirname, '../mcp-server/server.js');

let clientPromise = null;
let cachedTools = null;

async function createClient() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    stderr: 'inherit',
  });

  const client = new Client(
    { name: 'mcp-to-mcp-host', version: '1.0.0' },
    { capabilities: {} },
  );

  await client.connect(transport);
  return client;
}

export async function getMcpClient() {
  if (!clientPromise) {
    clientPromise = createClient().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

export async function listMcpTools() {
  if (cachedTools) return cachedTools;
  const client = await getMcpClient();
  const { tools } = await client.listTools();
  cachedTools = tools;
  return tools;
}

export async function callMcpTool(name, args) {
  return instrument(`mcp.tool.${name}`, async (recorder) => {
    const client = await getMcpClient();
    const started = Date.now();

    recorder.addAttributes({
      'mcp.tool.name': name,
      'mcp.tool.arguments': JSON.stringify(args ?? {}),
      'mcp.server': 'weather-mcp-server',
      'mcp.transport': 'stdio',
    });

    const result = await client.callTool({ name, arguments: args ?? {} });
    const duration = Date.now() - started;

    const text = result.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON tool output is fine; leave parsed null.
    }

    recorder.addAttributes({
      'mcp.tool.duration_ms': duration,
      'mcp.tool.is_error': Boolean(result.isError),
    });
    recorder.recordEvent('MCPToolCall', {
      tool: name,
      server: 'weather-mcp-server',
      duration_ms: duration,
      success: !result.isError,
    });

    return { raw: result, text, parsed };
  });
}

export async function shutdownMcpClient() {
  if (!clientPromise) return;
  try {
    const client = await clientPromise;
    await client.close();
  } finally {
    clientPromise = null;
    cachedTools = null;
  }
}
