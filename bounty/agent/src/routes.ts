/**
 * REST API routes for the Attestify Agent.
 *
 * Provides HTTP endpoints so the frontend chat UI can communicate
 * with the agent without needing HCS-10 directly.
 */

import { Router, type Request, type Response } from 'express';
import { processMessage, clearConversation } from './agent.js';

export function createRouter(): Router {
  const router = Router();

  /**
   * POST /api/chat
   * Send a message to the agent and get a response.
   *
   * Body: { message: string, conversationId?: string }
   * Response: { success: true, response: string, conversationId: string }
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, conversationId } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Missing or invalid "message" field',
        });
        return;
      }

      const convId = conversationId || `web-${Date.now()}`;
      console.log(`[API] Chat message (${convId}): ${message.substring(0, 100)}...`);

      const response = await processMessage(message, convId);

      res.json({
        success: true,
        response,
        conversationId: convId,
      });
    } catch (error: any) {
      console.error('[API] Chat error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/chat/clear
   * Clear conversation memory.
   *
   * Body: { conversationId: string }
   */
  router.post('/chat/clear', (req: Request, res: Response) => {
    const { conversationId } = req.body;
    if (conversationId) {
      clearConversation(conversationId);
    }
    res.json({ success: true });
  });

  /**
   * GET /api/agent/info
   * Get agent info and capabilities.
   */
  router.get('/agent/info', (_req: Request, res: Response) => {
    res.json({
      success: true,
      agent: {
        name: 'Attestify Agent',
        description:
          'AI agent for the Attestify attestation protocol on Hedera. Supports natural language interaction with schemas, attestations, authorities, resolvers, and Hedera-native features.',
        capabilities: [
          'register_schema',
          'create_attestation',
          'revoke_attestation',
          'get_attestation',
          'get_schema',
          'list_schemas',
          'list_attestations',
          'register_authority',
          'get_authority',
          'get_profile',
          'encode_attestation_data',
          'decode_attestation_data',
          'whitelist_check',
          'fee_get_fee',
          'fee_get_balance',
          'mint_nft_credential',
          'schedule_revocation',
        ],
        protocol: 'HCS-10 OpenConvAI',
        network: 'Hedera Testnet',
      },
    });
  });

  /**
   * GET /health
   * Health check.
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'attestify-agent' });
  });

  return router;
}
