/**
 * Attestify Agent — MCP Protocol Demo
 *
 * Demonstrates the Model Context Protocol (MCP) server by spawning it as a
 * child process and communicating over stdio with JSON-RPC messages — exactly
 * how Claude, Cursor, or Kiro would connect.
 *
 * This proves that any MCP client can discover and use all 17 Attestify tools
 * without needing an LLM intermediary.
 *
 * Run: pnpm demo-mcp
 */

import 'dotenv/config';
import { spawn, type ChildProcess } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mcpProcess: ChildProcess | null = null;
let requestId = 0;
let responseBuffer = '';

// Pending responses keyed by request ID
const pending = new Map<
  number,
  { resolve: (value: any) => void; reject: (err: Error) => void }
>();

// ─── MCP Communication ───────────────────────────────────────────────────────

function sendRequest(method: string, params?: any): Promise<any> {
  return new Promise((resolvePromise, reject) => {
    if (!mcpProcess?.stdin) {
      reject(new Error('MCP process not running'));
      return;
    }

    requestId++;
    const id = requestId;
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    pending.set(id, { resolve: resolvePromise, reject });
    mcpProcess.stdin.write(msg + '\n');

    // Timeout after 60s
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }
    }, 60000);
  });
}

function handleStdout(chunk: string) {
  responseBuffer += chunk;
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve: res } = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.error) {
          res({ error: msg.error });
        } else {
          res(msg.result);
        }
      }
    } catch {
      // Not JSON — ignore
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Attestify Agent — MCP Protocol Demo                   ║');
  console.log('║   Tool calls over stdio (like Claude/Cursor/Kiro)       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  // ─── Spawn MCP server ──────────────────────────────────────────────────
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Phase 1: Spawn MCP Server (stdio)');
  console.log('└──────────────────────────────────────────────────────');

  const mcpScript = resolve(__dirname, '..', 'mcp-server.ts');
  mcpProcess = spawn('tsx', [mcpScript], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  mcpProcess.stdout!.setEncoding('utf-8');
  mcpProcess.stdout!.on('data', handleStdout);

  // Log stderr (MCP server logs go here)
  mcpProcess.stderr!.setEncoding('utf-8');
  mcpProcess.stderr!.on('data', (data: string) => {
    for (const line of data.trim().split('\n')) {
      console.log('  [MCP Server] %s', line);
    }
  });

  // Wait for server to initialize
  await sleep(2000);

  // ─── Initialize handshake ──────────────────────────────────────────────
  console.log();
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Phase 2: MCP Initialize Handshake');
  console.log('└──────────────────────────────────────────────────────');

  const initResult = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'attestify-demo', version: '1.0.0' },
  });

  console.log('  Server: %s v%s', initResult.serverInfo?.name, initResult.serverInfo?.version);
  console.log('  Protocol: %s', initResult.protocolVersion);
  console.log('  Tools capability: %s', initResult.capabilities?.tools ? 'yes' : 'no');

  // Send initialized notification (no response expected)
  mcpProcess.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // ─── List tools ────────────────────────────────────────────────────────
  console.log();
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Phase 3: Discover Tools (tools/list)');
  console.log('└──────────────────────────────────────────────────────');

  const toolsResult = await sendRequest('tools/list');
  const tools = toolsResult.tools || [];

  console.log('  Found %d tools:', tools.length);
  for (const tool of tools) {
    const params = Object.keys(tool.inputSchema?.properties || {}).join(', ');
    console.log('    • %s(%s)', tool.name, params);
  }

  // ─── Call tools ────────────────────────────────────────────────────────
  console.log();
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Phase 4: Call Tools (tools/call)');
  console.log('└──────────────────────────────────────────────────────');

  // Tool call 1: list_schemas
  console.log();
  console.log('  → Calling: list_schemas()');
  const schemasResult = await sendRequest('tools/call', {
    name: 'list_schemas',
    arguments: {},
  });
  const schemasText = schemasResult.content?.[0]?.text || '(no result)';
  console.log('  ◀ Result:');
  for (const line of schemasText.split('\n').slice(0, 15)) {
    console.log('    %s', line);
  }
  if (schemasText.split('\n').length > 15) {
    console.log('    ... (%d more lines)', schemasText.split('\n').length - 15);
  }

  // Tool call 2: get_schema (use a known UID if available)
  console.log();
  console.log('  → Calling: list_attestations(subject: "0x0000000000000000000000000000000000001234")');
  const attestResult = await sendRequest('tools/call', {
    name: 'list_attestations',
    arguments: { subject: '0x0000000000000000000000000000000000001234' },
  });
  const attestText = attestResult.content?.[0]?.text || '(no result)';
  console.log('  ◀ Result:');
  for (const line of attestText.split('\n').slice(0, 10)) {
    console.log('    %s', line);
  }

  // Tool call 3: encode_attestation_data
  console.log();
  console.log('  → Calling: encode_attestation_data(definition: "string name, bool verified", values: \'{"name":"Alice","verified":true}\')');
  const encodeResult = await sendRequest('tools/call', {
    name: 'encode_attestation_data',
    arguments: {
      definition: 'string name, bool verified',
      values: '{"name":"Alice","verified":true}',
    },
  });
  const encodeText = encodeResult.content?.[0]?.text || '(no result)';
  console.log('  ◀ Result:');
  console.log('    %s', encodeText.substring(0, 120) + (encodeText.length > 120 ? '...' : ''));

  // ─── Done ──────────────────────────────────────────────────────────────
  console.log();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   MCP Demo complete!                                    ║');
  console.log('║                                                         ║');
  console.log('║   Any MCP client (Claude, Cursor, Kiro) can connect     ║');
  console.log('║   and use all 17 Attestify tools directly over stdio.   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  cleanup();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanup() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch((err) => {
  console.error('[MCP Demo] Fatal error:', err);
  cleanup();
});
