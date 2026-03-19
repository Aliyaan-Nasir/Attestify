/**
 * HCS-10 Server
 *
 * Handles agent-to-agent communication via the HCS-10 OpenConvAI protocol.
 * Monitors the agent's inbound topic for connection requests, creates
 * connection topics, and routes messages to the LangChain agent.
 */

import { HCS10Client } from '@hashgraphonline/standards-sdk';
import { processMessage } from './agent.js';

let hcs10Client: HCS10Client | null = null;
let monitoring = false;
let operatorId: string | null = null;

interface ConnectionInfo {
  topicId: string;
  remoteAccountId: string;
  conversationId: string;
}

const activeConnections = new Map<string, ConnectionInfo>();

/**
 * Initialize the HCS-10 client and start monitoring for connections.
 */
export async function startHCS10Server(config: {
  accountId: string;
  privateKey: string;
  inboundTopicId: string;
  outboundTopicId: string;
}) {
  if (!config.inboundTopicId || !config.outboundTopicId) {
    console.log('[HCS-10] No topic IDs configured — skipping HCS-10 server.');
    console.log('[HCS-10] Run "pnpm register" to register the agent and get topic IDs.');
    return;
  }

  try {
    hcs10Client = new HCS10Client({
      network: 'testnet',
      operatorId: config.accountId,
      operatorPrivateKey: config.privateKey,
      logLevel: 'error',
    });

    try {
      operatorId = await hcs10Client.getOperatorId();
    } catch {
      // Fallback: use account ID directly if profile lookup fails
      operatorId = config.accountId;
    }

    console.log('[HCS-10] Client initialized (operator: %s)', operatorId);
    console.log('[HCS-10] Inbound topic: %s', config.inboundTopicId);
    console.log('[HCS-10] Outbound topic: %s', config.outboundTopicId);

    // Start monitoring inbound topic for connection requests
    await monitorInbound(config.inboundTopicId);
  } catch (error: any) {
    console.error('[HCS-10] Failed to initialize:', error.message);
  }
}

/**
 * Monitor the inbound topic for connection requests.
 * When a request comes in, accept it and start listening on the connection topic.
 */
async function monitorInbound(inboundTopicId: string) {
  if (!hcs10Client || monitoring) return;
  monitoring = true;

  console.log('[HCS-10] Monitoring inbound topic for connection requests...');

  // Track the latest sequence number so we only process NEW requests (not old ones from before boot)
  let lastSeenSequence = 0;

  // On first poll, just record the latest sequence number without processing
  let firstPoll = true;

  // Poll for new connection requests periodically
  setInterval(async () => {
    try {
      const { messages } = await hcs10Client!.getMessages(inboundTopicId, {
        limit: 10,
        order: 'desc',
      });

      if (!messages || !Array.isArray(messages)) return;

      // On first poll, just record the highest sequence number
      if (firstPoll) {
        for (const msg of messages) {
          const parsed = msg as any;
          if (parsed.sequence_number > lastSeenSequence) {
            lastSeenSequence = parsed.sequence_number;
          }
        }
        firstPoll = false;
        console.log('[HCS-10] Skipped %d existing messages (will only process new ones)', lastSeenSequence);
        return;
      }

      for (const msg of messages) {
        if (!msg || typeof msg !== 'object') continue;

        const parsed = msg as any;

        // Skip already-seen messages
        if (parsed.sequence_number <= lastSeenSequence) continue;
        lastSeenSequence = parsed.sequence_number;

        if (parsed.op === 'connection_request' && parsed.operator_id) {
          // Extract account ID from operator_id (e.g. "0.0.8238145@0.0.6362296" → "0.0.6362296")
          const operatorIdStr = parsed.operator_id as string;
          const requesterId = operatorIdStr.includes('@')
            ? operatorIdStr.split('@')[1]
            : operatorIdStr;
          const connectionRequestId = parsed.sequence_number as number;

          // Skip if we already have this connection
          if (activeConnections.has(requesterId)) continue;

          console.log('[HCS-10] Connection request from: %s', requesterId);

          try {
            const connectionResult = await hcs10Client!.handleConnectionRequest(
              inboundTopicId,
              requesterId,
              connectionRequestId,
            );

            if (connectionResult && connectionResult.connectionTopicId) {
              const connInfo: ConnectionInfo = {
                topicId: connectionResult.connectionTopicId,
                remoteAccountId: requesterId,
                conversationId: `hcs10-${requesterId}`,
              };
              activeConnections.set(requesterId, connInfo);
              console.log(
                '[HCS-10] Connection established with %s on topic %s',
                requesterId,
                connectionResult.connectionTopicId,
              );

              // Start monitoring this connection for messages
              monitorConnection(connInfo);
            }
          } catch (err: any) {
            console.error('[HCS-10] Failed to accept connection:', err.message);
          }
        }
      }
    } catch (_err: any) {
      // Silently ignore polling errors
    }
  }, 5000);
}

/**
 * Monitor a connection topic for incoming messages.
 * Routes messages to the LangChain agent and sends responses back.
 */
function monitorConnection(conn: ConnectionInfo) {
  let lastSequence = 0;

  console.log('[HCS-10] Monitoring connection topic %s for messages...', conn.topicId);

  setInterval(async () => {
    try {
      const { messages } = await hcs10Client!.getMessages(conn.topicId, {
        limit: 10,
        order: 'asc',
      });

      if (!messages || !Array.isArray(messages)) return;

      for (const msg of messages) {
        if (!msg || typeof msg !== 'object') continue;
        const parsed = msg as any;

        // Skip already-processed messages
        if (parsed.sequence_number <= lastSequence) continue;
        // Skip our own messages
        if (operatorId && parsed.operator_id?.includes(operatorId)) continue;

        lastSequence = parsed.sequence_number || lastSequence;

        if (parsed.op === 'message' && parsed.data) {
          const preview = typeof parsed.data === 'string' ? parsed.data.substring(0, 80) : '';
          console.log('[HCS-10] Message from %s: %s', conn.remoteAccountId, preview);

          // Process through LangChain agent
          const response = await processMessage(parsed.data, conn.conversationId);

          // Send response back on the connection topic
          try {
            await hcs10Client!.sendMessage(conn.topicId, response);
            console.log('[HCS-10] Response sent to %s', conn.remoteAccountId);
          } catch (sendErr: any) {
            console.error('[HCS-10] Failed to send response:', sendErr.message);
          }
        }
      }
    } catch (_err: any) {
      // Silently ignore polling errors
    }
  }, 3000);
}

/**
 * Get the list of active HCS-10 connections.
 */
export function getActiveConnections(): Array<{ remoteAccountId: string; topicId: string }> {
  return Array.from(activeConnections.values()).map((c) => ({
    remoteAccountId: c.remoteAccountId,
    topicId: c.topicId,
  }));
}
