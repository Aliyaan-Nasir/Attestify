/**
 * Verification Agent
 *
 * A second AI agent that demonstrates agent-to-agent (A2A) communication
 * via HCS-10. This agent connects to the main Attestify Agent and sends
 * verification requests on behalf of users.
 *
 * Flow:
 * 1. User asks the Verification Agent to verify an attestation or check a schema
 * 2. Verification Agent connects to the Attestify Agent via HCS-10
 * 3. Attestify Agent processes the request and responds
 * 4. Verification Agent interprets the result and returns it to the user
 *
 * Run: pnpm verify-agent
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

// ─── State ───────────────────────────────────────────────────────────────────

let hcs10Client: HCS10Client | null = null;
let connectionTopicId: string | null = null;
let operatorId: string | null = null;
let connected = false;

// Pending responses: we send a message and wait for the reply
const pendingRequests = new Map<
  string,
  { resolve: (value: string) => void; timer: ReturnType<typeof setTimeout> }
>();
let lastSequence = 0;

// ─── HCS-10 Connection ──────────────────────────────────────────────────────

async function connectToAttestifyAgent(config: {
  accountId: string;
  privateKey: string;
  targetInboundTopicId: string;
}) {
  hcs10Client = new HCS10Client({
    network: 'testnet',
    operatorId: config.accountId,
    operatorPrivateKey: config.privateKey,
    logLevel: 'error',
  });

  operatorId = await hcs10Client.getOperatorId();

  console.log('[VerifyAgent] Connecting to Attestify Agent at topic %s...', config.targetInboundTopicId);

  // Submit a connection request to the Attestify Agent's inbound topic
  const receipt = await hcs10Client.submitConnectionRequest(
    config.targetInboundTopicId,
    'Verification Agent requesting connection',
  );

  console.log('[VerifyAgent] Connection request submitted, waiting for confirmation...');

  // Wait for the Attestify Agent to accept and create a connection topic
  const confirmation = await hcs10Client.waitForConnectionConfirmation(
    config.targetInboundTopicId,
    receipt.topicSequenceNumber?.toNumber() ?? 0,
    30, // max attempts
    3000, // delay ms
  );

  connectionTopicId = confirmation.connectionTopicId;
  connected = true;

  console.log('[VerifyAgent] Connected on topic: %s', connectionTopicId);

  // Start polling for responses
  pollForResponses();
}

/**
 * Poll the connection topic for responses from the Attestify Agent.
 */
function pollForResponses() {
  if (!hcs10Client || !connectionTopicId) return;

  setInterval(async () => {
    try {
      const { messages } = await hcs10Client!.getMessages(connectionTopicId!, {
        limit: 20,
        order: 'asc',
      });

      if (!messages?.length) return;

      for (const msg of messages) {
        const parsed = msg as any;
        if (parsed.sequence_number <= lastSequence) continue;
        // Skip our own messages
        if (operatorId && parsed.operator_id?.includes(operatorId)) continue;

        lastSequence = parsed.sequence_number || lastSequence;

        if (parsed.op === 'message' && parsed.data) {
          const data = typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data);
          console.log('[VerifyAgent] Response received: %s', data.substring(0, 100));

          // Resolve any pending request
          // Since HCS-10 is sequential, resolve the oldest pending request
          const oldest = pendingRequests.entries().next().value;
          if (oldest) {
            const [key, { resolve, timer }] = oldest;
            clearTimeout(timer);
            pendingRequests.delete(key);
            resolve(data);
          }
        }
      }
    } catch (_err) {
      // Silently ignore polling errors
    }
  }, 2000);
}

/**
 * Send a message to the Attestify Agent and wait for a response.
 */
async function sendAndWait(message: string, timeoutMs = 60000): Promise<string> {
  if (!hcs10Client || !connectionTopicId || !connected) {
    throw new Error('Not connected to Attestify Agent');
  }

  const requestId = `req-${Date.now()}`;

  // Send the message
  await hcs10Client.sendMessage(connectionTopicId, message);
  console.log('[VerifyAgent] Sent: %s', message.substring(0, 100));

  // Wait for response
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Timeout waiting for response from Attestify Agent'));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, timer });
  });
}

// ─── Express Server ──────────────────────────────────────────────────────────

function startServer(port: number) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  /**
   * POST /api/verify
   * Send a verification request through the Attestify Agent.
   * Body: { message: string }
   */
  app.post('/api/verify', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        res.status(400).json({ success: false, error: 'Missing message' });
        return;
      }

      if (!connected) {
        res.status(503).json({ success: false, error: 'Not connected to Attestify Agent' });
        return;
      }

      const response = await sendAndWait(message);
      res.json({ success: true, response });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/status
   * Check connection status.
   */
  app.get('/api/status', (_req, res) => {
    res.json({
      success: true,
      connected,
      connectionTopicId,
      agent: 'Verification Agent',
      description: 'Connects to the Attestify Agent via HCS-10 to verify attestations and schemas.',
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'verification-agent', connected });
  });

  app.listen(port, () => {
    console.log('[VerifyAgent] HTTP server on port %d', port);
    console.log('[VerifyAgent] Verify API: POST http://localhost:%d/api/verify', port);
    console.log('[VerifyAgent] Status: GET http://localhost:%d/api/status', port);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const accountId = process.env.VERIFY_AGENT_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.VERIFY_AGENT_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  const targetInbound = process.env.ATTESTIFY_AGENT_INBOUND_TOPIC_ID;
  const port = parseInt(process.env.VERIFY_AGENT_PORT || '3003', 10);

  if (!accountId || !privateKey) {
    console.error('Missing account credentials. Set VERIFY_AGENT_ACCOUNT_ID/VERIFY_AGENT_PRIVATE_KEY or HEDERA_ACCOUNT_ID/HEDERA_PRIVATE_KEY');
    process.exit(1);
  }

  if (!targetInbound) {
    console.error('Missing ATTESTIFY_AGENT_INBOUND_TOPIC_ID — set it to the Attestify Agent\'s inbound topic');
    process.exit(1);
  }

  // Start HTTP server first so it's available while connecting
  startServer(port);

  // Connect to the Attestify Agent via HCS-10
  await connectToAttestifyAgent({ accountId, privateKey, targetInboundTopicId: targetInbound });
}

main().catch((err) => {
  console.error('[VerifyAgent] Fatal error:', err);
  process.exit(1);
});
