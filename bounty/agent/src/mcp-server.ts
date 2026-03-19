/**
 * MCP (Model Context Protocol) Server
 *
 * Exposes the Attestify Agent's 17 tools as MCP-compatible tools
 * over stdio transport. Any MCP client (Claude, Cursor, Kiro, etc.)
 * can connect and use the Attestify protocol through tool calls.
 *
 * Run: pnpm mcp
 *
 * MCP Spec: https://modelcontextprotocol.io/
 */

import 'dotenv/config';
import { initializeSDK, getAllTools } from './attestify-tools.js';

// ─── MCP Protocol Types ──────────────────────────────────────────────────────

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string };
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// ─── Tool Schema Extraction ──────────────────────────────────────────────────

function extractToolDefinitions(): MCPToolDefinition[] {
  const tools = getAllTools();
  return tools.map((t) => {
    const schema = t.schema as any;
    // Extract zod schema shape into JSON Schema
    const properties: Record<string, any> = {};
    const required: string[] = [];

    if (schema?.shape) {
      for (const [key, val] of Object.entries(schema.shape)) {
        const zodField = val as any;
        const isOptional = zodField?.isOptional?.() || zodField?._def?.typeName === 'ZodOptional';
        const innerType = isOptional ? zodField._def?.innerType : zodField;
        const typeName = innerType?._def?.typeName;

        let jsonType = 'string';
        if (typeName === 'ZodNumber') jsonType = 'number';
        else if (typeName === 'ZodBoolean') jsonType = 'boolean';

        properties[key] = {
          type: jsonType,
          description: innerType?._def?.description || zodField?.description || '',
        };

        if (!isOptional) {
          required.push(key);
        }
      }
    }

    return {
      name: t.name,
      description: t.description,
      inputSchema: {
        type: 'object' as const,
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    };
  });
}

// ─── MCP Server (stdio) ─────────────────────────────────────────────────────

const toolDefs: MCPToolDefinition[] = [];

function sendResponse(response: MCPResponse) {
  const json = JSON.stringify(response);
  process.stdout.write(json + '\n');
}

async function handleRequest(request: MCPRequest) {
  switch (request.method) {
    case 'initialize': {
      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: 'attestify-agent',
            version: '0.1.0',
          },
        },
      });
      break;
    }

    case 'notifications/initialized': {
      // Client acknowledged initialization — no response needed
      break;
    }

    case 'tools/list': {
      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: toolDefs },
      });
      break;
    }

    case 'tools/call': {
      const toolName = request.params?.name;
      const args = request.params?.arguments || {};

      const tools = getAllTools();
      const tool = tools.find((t) => t.name === toolName);

      if (!tool) {
        sendResponse({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
            isError: true,
          },
        });
        break;
      }

      try {
        const result = await (tool as any).invoke(args);
        const text = typeof result === 'string' ? result : JSON.stringify(result);
        sendResponse({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text', text }],
          },
        });
      } catch (error: any) {
        sendResponse({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          },
        });
      }
      break;
    }

    default: {
      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: `Method not found: ${request.method}` },
      });
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const indexerUrl = process.env.INDEXER_URL || 'http://localhost:3001/api';

  if (!accountId || !privateKey) {
    process.stderr.write('Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY\n');
    process.exit(1);
  }

  // Initialize SDK (no OpenAI needed — MCP exposes tools directly)
  initializeSDK({ accountId, privateKey, indexerUrl });
  toolDefs.push(...extractToolDefinitions());

  process.stderr.write(`[MCP] Attestify MCP server started with ${toolDefs.length} tools\n`);

  // Read JSON-RPC messages from stdin (line-delimited)
  let buffer = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const request = JSON.parse(trimmed) as MCPRequest;
        handleRequest(request).catch((err) => {
          process.stderr.write(`[MCP] Error handling request: ${err.message}\n`);
        });
      } catch {
        process.stderr.write(`[MCP] Invalid JSON: ${trimmed.substring(0, 100)}\n`);
      }
    }
  });
}

main().catch((err) => {
  process.stderr.write(`[MCP] Fatal: ${err.message}\n`);
  process.exit(1);
});
