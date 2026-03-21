/**
 * XMTP Protocol Server
 *
 * Exposes the Attestify Agent over the XMTP messaging protocol.
 * Any XMTP client (Converse, web3 wallets with XMTP support) can
 * send messages to the agent's XMTP address and receive responses.
 *
 * This is a lightweight adapter that bridges XMTP messages to the
 * LangChain agent's processMessage() function.
 *
 * Note: Requires @xmtp/node-sdk for full implementation. This module
 * provides the integration layer — install the XMTP SDK and set
 * XMTP_PRIVATE_KEY to enable.
 *
 * Run: pnpm xmtp
 */

import 'dotenv/config';
import { initializeSDK } from './attestify-tools.js';
import { initializeAgent, processMessage } from './agent.js';

// ─── XMTP Message Handler ───────────────────────────────────────────────────

interface XMTPMessage {
  senderAddress: string;
  content: string;
  conversationId: string;
}

type SendReplyFn = (conversationId: string, text: string) => Promise<void>;

/**
 * Process an incoming XMTP message through the LangChain agent.
 * This function is protocol-agnostic — it takes a message and a reply function.
 */
async function handleXMTPMessage(msg: XMTPMessage, sendReply: SendReplyFn) {
  console.log('[XMTP] Message from %s: %s', msg.senderAddress, msg.content.substring(0, 100));

  try {
    const response = await processMessage(msg.content, `xmtp-${msg.senderAddress}`);
    await sendReply(msg.conversationId, response);
    console.log('[XMTP] Reply sent to %s', msg.senderAddress);
  } catch (error: any) {
    console.error('[XMTP] Error processing message:', error.message);
    await sendReply(msg.conversationId, `Error: ${error.message}`);
  }
}

// ─── XMTP Client Setup ──────────────────────────────────────────────────────

/**
 * Start the XMTP listener.
 *
 * Uses dynamic import for @xmtp/node-sdk since it's an optional dependency.
 * If the SDK is not installed, logs a message and returns gracefully.
 */
export async function startXMTPServer() {
  const xmtpKey = process.env.XMTP_PRIVATE_KEY;

  if (!xmtpKey) {
    console.log('[XMTP] No XMTP_PRIVATE_KEY configured — skipping XMTP server.');
    console.log('[XMTP] Set XMTP_PRIVATE_KEY in .env to enable XMTP messaging.');
    return;
  }

  try {
    // Dynamic import — @xmtp/node-sdk is optional
    // @ts-ignore — optional dependency, may not be installed
    const xmtp = await import('@xmtp/node-sdk').catch(() => null);

    if (!xmtp) {
      console.log('[XMTP] @xmtp/node-sdk not installed — skipping XMTP server.');
      console.log('[XMTP] Install with: pnpm add @xmtp/node-sdk');
      return;
    }

    // Create XMTP client
    const keyBytes = hexToBytes(xmtpKey);
    const client = await xmtp.Client.create(keyBytes, { env: 'dev' });

    console.log('[XMTP] Client initialized (address: %s)', client.accountAddress);
    console.log('[XMTP] Listening for messages...');

    // Stream incoming conversations and messages
    const stream = await client.conversations.stream();

    for await (const conversation of stream) {
      // Listen for messages in each conversation
      void (async () => {
        const msgStream = await conversation.stream();
        for await (const message of msgStream) {
          // Skip our own messages
          if (message.senderInboxId === client.inboxId) continue;

          const content = typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content);

          if (!content) continue;

          await handleXMTPMessage(
            {
              senderAddress: message.senderInboxId,
              content,
              conversationId: conversation.id,
            },
            async (convId, text) => {
              await conversation.send(text);
            },
          );
        }
      })();
    }
  } catch (error: any) {
    console.error('[XMTP] Failed to start:', error.message);
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ─── Standalone entry point ──────────────────────────────────────────────────

async function main() {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;
  const indexerUrl = process.env.INDEXER_URL || 'http://localhost:3001/api';

  if (!accountId || !privateKey || !openAIKey) {
    console.error('Missing HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, or OPENAI_API_KEY');
    process.exit(1);
  }

  initializeSDK({ accountId, privateKey, indexerUrl });
  await initializeAgent(openAIKey);
  await startXMTPServer();
}

// Only run main if this is the entry point
const isMain = process.argv[1]?.includes('xmtp-server');
if (isMain) {
  main().catch((err) => {
    console.error('[XMTP] Fatal:', err);
    process.exit(1);
  });
}
