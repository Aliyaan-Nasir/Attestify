/**
 * Attestify Agent — HCS-10 End-to-End Demo
 *
 * Demonstrates agent-to-agent communication over the HCS-10 OpenConvAI protocol.
 * A demo client connects to the Attestify Agent's inbound topic on Hedera,
 * establishes a connection, and sends natural language messages through
 * Hedera Consensus Service topics.
 *
 * This is separate from the REST/A2A demo (demo.ts) — this one goes through
 * Hedera's consensus layer, not HTTP.
 *
 * Prerequisites:
 *   - Attestify Agent running (`pnpm start`)
 *   - Agent registered with HCS-10 topics (`pnpm register`)
 *   - .env configured with AGENT_INBOUND_TOPIC_ID
 *
 * Run: pnpm demo-hcs10
 */

import 'dotenv/config';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

const ATTESTIFY_INBOUND_TOPIC = process.env.ATTESTIFY_AGENT_INBOUND_TOPIC_ID || process.env.AGENT_INBOUND_TOPIC_ID;
// Use the Verification Agent's account to connect — this is a different agent connecting to the Attestify Agent
const ACCOUNT_ID = process.env.VERIFY_AGENT_ACCOUNT_ID;
const PRIVATE_KEY = process.env.VERIFY_AGENT_PRIVATE_KEY;

// ─── Demo messages to send over HCS-10 ──────────────────────────────────────

const DEMO_MESSAGES = [
  {
    label: 'Step 1: Ask the agent what it can do',
    message: 'What operations can you perform? Give me a brief summary.',
  },
  {
    label: 'Step 2: List schemas on-chain',
    message: 'How many schemas are registered? Just give me the count and their UIDs, nothing else.',
  },
  {
    label: 'Step 3: Check attestations for a subject',
    message: 'List all attestations for subject 0x0000000000000000000000000000000000001234',
  },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!ACCOUNT_ID || !PRIVATE_KEY) {
    console.error('Missing VERIFY_AGENT_ACCOUNT_ID or VERIFY_AGENT_PRIVATE_KEY in .env');
    process.exit(1);
  }
  if (!ATTESTIFY_INBOUND_TOPIC) {
    console.error('Missing ATTESTIFY_AGENT_INBOUND_TOPIC_ID (or AGENT_INBOUND_TOPIC_ID) in .env');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Attestify Agent — HCS-10 End-to-End Demo             ║');
  console.log('║   Agent-to-agent communication on Hedera               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log('[HCS-10 Demo] Operator:       %s', ACCOUNT_ID);
  console.log('[HCS-10 Demo] Target inbound: %s', ATTESTIFY_INBOUND_TOPIC);
  console.log();

  // ─── Create HCS-10 client ──────────────────────────────────────────────
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Phase 1: Initialize HCS-10 Client');
  console.log('└──────────────────────────────────────────────────────');

  const client = new HCS10Client({
    network: 'testnet',
    operatorId: ACCOUNT_ID,
    operatorPrivateKey: PRIVATE_KEY,
    logLevel: 'error',
  });

  let operatorId: string;
  try {
    operatorId = await client.getOperatorId();
    console.log('[HCS-10 Demo] Operator ID resolved: %s', operatorId);
  } catch {
    operatorId = ACCOUNT_ID;
    console.log('[HCS-10 Demo] Using account ID as operator: %s', operatorId);
  }

  // ─── Submit connection request ─────────────────────────────────────────
  console.log();
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Phase 2: Submit Connection Request');
  console.log('│ → Sending connection_request to topic %s', ATTESTIFY_INBOUND_TOPIC);
  console.log('└──────────────────────────────────────────────────────');

  const receipt = await client.submitConnectionRequest(
    ATTESTIFY_INBOUND_TOPIC,
    'HCS-10 Demo Client requesting connection to Attestify Agent',
  );

  const seqNum = receipt.topicSequenceNumber?.toNumber() ?? 0;
  console.log('[HCS-10 Demo] Connection request submitted (seq: %d)', seqNum);
  console.log('[HCS-10 Demo] Waiting for Attestify Agent to accept...');
  console.log('[HCS-10 Demo] (The agent polls every 5s — this may take up to 30s)');

  // ─── Wait for connection confirmation ──────────────────────────────────
  const confirmation = await client.waitForConnectionConfirmation(
    ATTESTIFY_INBOUND_TOPIC,
    seqNum,
    20, // max attempts
    5000, // delay ms
  );

  const connectionTopicId = confirmation.connectionTopicId;
  console.log();
  console.log('  ✓ Connection established!');
  console.log('  Connection topic: %s', connectionTopicId);
  console.log('  HashScan: https://hashscan.io/testnet/topic/%s', connectionTopicId);
  console.log();

  await sleep(2000);

  // ─── Send demo messages ────────────────────────────────────────────────
  let lastSequence = 0;

  for (const step of DEMO_MESSAGES) {
    console.log('┌──────────────────────────────────────────────────────');
    console.log('│ %s', step.label);
    console.log('├──────────────────────────────────────────────────────');
    console.log('│ → "%s"', step.message.substring(0, 90) + (step.message.length > 90 ? '...' : ''));
    console.log('└──────────────────────────────────────────────────────');

    // Send message on the connection topic
    await client.sendMessage(connectionTopicId, step.message);
    console.log('[HCS-10 Demo] Message sent on topic %s', connectionTopicId);

    // Poll for the agent's response
    console.log('[HCS-10 Demo] Waiting for response...');
    const response = await waitForResponse(client, connectionTopicId, operatorId, lastSequence, 120000);

    if (response) {
      lastSequence = response.sequence;
      console.log();
      console.log('  ◀ Agent response (via HCS-10):');
      console.log('  ─────────────────');
      for (const line of response.data.split('\n')) {
        console.log('  %s', line);
      }
    } else {
      console.log('  ⚠ No response received (timeout)');
    }

    console.log();
    await sleep(3000);
  }

  // ─── Done ──────────────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   HCS-10 Demo complete!                                 ║');
  console.log('║                                                         ║');
  console.log('║   All messages went through Hedera Consensus Service    ║');
  console.log('║   topics — decentralized, consensus-timestamped,        ║');
  console.log('║   and auditable on HashScan.                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  process.exit(0);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Poll the connection topic for a response from the Attestify Agent.
 * Skips our own messages and already-seen messages.
 *
 * The demo client (Verification Agent account 0.0.6362296) and the Attestify Agent
 * (account 0.0.7284771) use separate Hedera accounts, so their operator_id values
 * are different. We use exact operator ID matching to filter out our own messages.
 */
async function waitForResponse(
  client: HCS10Client,
  topicId: string,
  ourOperatorId: string,
  afterSequence: number,
  timeoutMs: number,
): Promise<{ data: string; sequence: number } | null> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const { messages } = await client.getMessages(topicId, {
        limit: 20,
        order: 'asc',
      });

      if (messages && Array.isArray(messages)) {
        for (const msg of messages) {
          const parsed = msg as any;
          if (!parsed || parsed.sequence_number <= afterSequence) continue;
          // Skip our own messages — compare exact operator_id match
          // (both agents share the same Hedera account but have different profile prefixes)
          if (parsed.operator_id === ourOperatorId) continue;

          if (parsed.op === 'message' && parsed.data) {
            return {
              data: typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data),
              sequence: parsed.sequence_number,
            };
          }
        }
      }
    } catch {
      // Ignore polling errors
    }

    await sleep(3000);
  }

  return null;
}

main().catch((err) => {
  console.error('[HCS-10 Demo] Fatal error:', err);
  process.exit(1);
});
