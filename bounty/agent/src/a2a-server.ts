/**
 * A2A (Agent-to-Agent) Protocol Server
 *
 * Implements Google's A2A protocol specification over HTTP.
 * Exposes the Attestify Agent as an A2A-compatible agent that any
 * A2A client can discover and communicate with.
 *
 * Endpoints:
 *   GET  /.well-known/agent.json  — Agent Card (discovery)
 *   POST /a2a                     — JSON-RPC message handler
 *
 * Spec: https://google.github.io/A2A/
 */

import { type Router, type Request, type Response } from 'express';
import { Router as createExpressRouter } from 'express';
import { processMessage, clearConversation } from './agent.js';

/** A2A Agent Card — returned at /.well-known/agent.json for discovery */
const AGENT_CARD = {
  name: 'Attestify Agent',
  description:
    'AI agent for the Attestify attestation protocol on Hedera. ' +
    'Supports schemas, attestations, authorities, resolvers, NFT credentials, ' +
    'and scheduled revocations via natural language.',
  url: process.env.A2A_BASE_URL || 'http://localhost:3002',
  version: '0.1.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
  },
  skills: [
    {
      id: 'attestify-protocol',
      name: 'Attestify Protocol',
      description:
        'Interact with the Attestify attestation protocol on Hedera Testnet. ' +
        'Register schemas, create/revoke attestations, manage authorities, ' +
        'encode/decode data, check resolvers, mint NFT credentials, schedule revocations.',
      tags: ['hedera', 'attestation', 'blockchain', 'identity', 'credentials'],
      examples: [
        'Register a KYC schema with fields name, documentType, verified',
        'Create an attestation for 0x1234 using schema 0xabc...',
        'List all attestations for address 0x5678',
        'Revoke attestation 0xdef...',
      ],
    },
  ],
};

/** A2A JSON-RPC request structure */
interface A2ARequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

/** A2A Task state */
interface A2ATask {
  id: string;
  status: { state: 'completed' | 'failed'; message?: { role: string; parts: Array<{ text: string }> } };
  artifacts?: Array<{ parts: Array<{ text: string }> }>;
}

const tasks = new Map<string, A2ATask>();

/**
 * Create Express router with A2A protocol endpoints.
 */
export function createA2ARouter(): Router {
  const router = createExpressRouter();

  // ─── Agent Card (Discovery) ────────────────────────────────────────────
  router.get('/.well-known/agent.json', (_req: Request, res: Response) => {
    res.json(AGENT_CARD);
  });

  // ─── JSON-RPC Handler ─────────────────────────────────────────────────
  router.post('/a2a', async (req: Request, res: Response) => {
    const body = req.body as A2ARequest;

    if (!body || body.jsonrpc !== '2.0' || !body.method) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: body?.id ?? null,
        error: { code: -32600, message: 'Invalid Request' },
      });
      return;
    }

    try {
      switch (body.method) {
        case 'tasks/send': {
          const params = body.params || {};
          const taskId = params.id || `task-${Date.now()}`;
          const message = params.message;

          if (!message?.parts?.length) {
            res.json({
              jsonrpc: '2.0',
              id: body.id,
              error: { code: -32602, message: 'Missing message.parts' },
            });
            return;
          }

          // Extract text from parts
          const text = message.parts
            .filter((p: any) => p.text)
            .map((p: any) => p.text)
            .join('\n');

          if (!text) {
            res.json({
              jsonrpc: '2.0',
              id: body.id,
              error: { code: -32602, message: 'No text content in message parts' },
            });
            return;
          }

          console.log('[A2A] Task %s: %s', taskId, text.substring(0, 100));

          // Process through LangChain agent
          const response = await processMessage(text, `a2a-${taskId}`);

          const task: A2ATask = {
            id: taskId,
            status: {
              state: 'completed',
              message: {
                role: 'agent',
                parts: [{ text: response }],
              },
            },
            artifacts: [{ parts: [{ text: response }] }],
          };

          tasks.set(taskId, task);

          res.json({ jsonrpc: '2.0', id: body.id, result: task });
          break;
        }

        case 'tasks/get': {
          const taskId = body.params?.id;
          const task = taskId ? tasks.get(taskId) : undefined;

          if (!task) {
            res.json({
              jsonrpc: '2.0',
              id: body.id,
              error: { code: -32602, message: 'Task not found' },
            });
            return;
          }

          res.json({ jsonrpc: '2.0', id: body.id, result: task });
          break;
        }

        case 'tasks/cancel': {
          const taskId = body.params?.id;
          if (taskId) {
            tasks.delete(taskId);
            clearConversation(`a2a-${taskId}`);
          }
          res.json({ jsonrpc: '2.0', id: body.id, result: { id: taskId, status: { state: 'canceled' } } });
          break;
        }

        default:
          res.json({
            jsonrpc: '2.0',
            id: body.id,
            error: { code: -32601, message: `Method not found: ${body.method}` },
          });
      }
    } catch (error: any) {
      console.error('[A2A] Error:', error.message);
      res.json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32000, message: error.message },
      });
    }
  });

  return router;
}
