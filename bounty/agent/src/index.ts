/**
 * Attestify Agent — Entry Point
 *
 * Starts the agent server with multiple communication protocols:
 * 1. SDK initialization (connects to Hedera contracts + indexer)
 * 2. LangChain agent initialization (LLM + Attestify tools)
 * 3. Express HTTP server (REST API for frontend chat + A2A protocol)
 * 4. HCS-10 listener (agent-to-agent communication on Hedera)
 * 5. XMTP listener (optional — web3 messaging)
 *
 * MCP server runs as a separate process: pnpm mcp
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initializeSDK } from './attestify-tools.js';
import { initializeAgent } from './agent.js';
import { createRouter } from './routes.js';
import { startHCS10Server } from './hcs10-server.js';
import { createA2ARouter } from './a2a-server.js';
import { startXMTPServer } from './xmtp-server.js';

async function main() {
  // ─── Validate env ────────────────────────────────────────────────────────
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;
  const indexerUrl = process.env.INDEXER_URL || 'http://localhost:3001/api';
  const port = parseInt(process.env.PORT || '3002', 10);

  if (!accountId || !privateKey) {
    console.error('Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY');
    process.exit(1);
  }
  if (!openAIKey) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  // ─── Initialize SDK ──────────────────────────────────────────────────────
  console.log('[Boot] Initializing Attestify SDK...');
  initializeSDK({ accountId, privateKey, indexerUrl });
  console.log('[Boot] SDK initialized (operator: %s)', accountId);

  // ─── Initialize LangChain Agent ──────────────────────────────────────────
  console.log('[Boot] Initializing LangChain agent...');
  await initializeAgent(openAIKey);

  // ─── Start HTTP Server (REST + A2A) ──────────────────────────────────────
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check (top-level)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'attestify-agent', timestamp: new Date().toISOString() });
  });

  // REST API for frontend chat
  app.use('/api', createRouter());

  // A2A protocol endpoints
  const a2aRouter = createA2ARouter();
  app.use(a2aRouter);

  app.listen(port, () => {
    console.log('[Boot] Attestify Agent running on port %d', port);
    console.log('[Boot] Protocols:');
    console.log('[Boot]   REST API:  POST http://localhost:%d/api/chat', port);
    console.log('[Boot]   A2A:       POST http://localhost:%d/a2a', port);
    console.log('[Boot]   A2A Card:  GET  http://localhost:%d/.well-known/agent.json', port);
    console.log('[Boot]   Agent Info: GET http://localhost:%d/api/agent/info', port);
    console.log('[Boot]   MCP:       Run "pnpm mcp" (separate stdio process)');
  });

  // ─── Start HCS-10 Server (agent-to-agent on Hedera) ──────────────────────
  const inboundTopicId = process.env.AGENT_INBOUND_TOPIC_ID;
  const outboundTopicId = process.env.AGENT_OUTBOUND_TOPIC_ID;

  if (inboundTopicId && outboundTopicId) {
    await startHCS10Server({
      accountId,
      privateKey,
      inboundTopicId,
      outboundTopicId,
    });
  } else {
    console.log('[Boot] HCS-10 not configured — run "pnpm register" first');
  }

  // ─── Start XMTP Server (optional) ────────────────────────────────────────
  await startXMTPServer();
}

// Crash on unhandled errors so Railway restarts the process
process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught exception — exiting:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled rejection — exiting:', reason);
  process.exit(1);
});

main().catch((err) => {
  console.error('[Fatal] Bootstrap failed — exiting:', err);
  process.exit(1);
});
