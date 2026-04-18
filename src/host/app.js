/**
 * Host application: serves the UI and a single /api/query endpoint that
 * runs the Claude-driven MCP agent.
 *
 * Start with: `node -r newrelic src/host/app.js`
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';
import express from 'express';

import { runAgent } from './agent.js';
import { shutdownMcpClient } from './mcp-client.js';
import { noticeError, setTransactionName } from './telemetry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(PUBLIC_DIR));

app.post('/api/query', async (req, res) => {
  setTransactionName('POST /api/query');
  const query = String(req.body?.query ?? '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Missing "query" field' });
  }
  try {
    const result = await runAgent(query);
    res.json(result);
  } catch (err) {
    noticeError(err);
    console.error('[/api/query]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const server = app.listen(PORT, () => {
  console.log(`[host] listening on http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`\n[host] received ${signal}, shutting down...`);
  server.close(() => console.log('[host] http server closed'));
  await shutdownMcpClient().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
