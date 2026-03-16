/**
 * HCS Publisher — Publishes structured audit messages to Hedera Consensus Service topics.
 *
 * Two layers:
 *   1. Global topics (3) — protocol-wide audit log for schemas, attestations, authorities
 *   2. Per-schema topics — one topic per schema, contains ALL activity related to that schema
 *
 * Failures are logged but never block the indexer — HCS is best-effort audit logging.
 */

import {
  Client,
  AccountId,
  PrivateKey,
  TopicId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from '@hashgraph/sdk';

export interface HCSTopicConfig {
  schemas: string;
  attestations: string;
  authorities: string;
}

export interface HCSMessage {
  version: '1.0';
  type: string;
  payload: Record<string, unknown>;
}

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

export class HCSPublisher {
  private client: Client;
  private topics: HCSTopicConfig;
  private enabled: boolean;

  constructor(topics: HCSTopicConfig | null, accountId?: string, privateKey?: string) {
    this.enabled = !!(topics && accountId && privateKey);
    this.topics = topics || { schemas: '', attestations: '', authorities: '' };
    this.client = Client.forTestnet();
    if (this.enabled && accountId && privateKey) {
      this.client.setOperator(
        AccountId.fromString(accountId),
        PrivateKey.fromStringECDSA(privateKey),
      );
      console.log('[HCS] Publisher enabled');
    } else {
      console.log('[HCS] Publisher disabled — missing topic IDs or credentials');
    }
  }

  /** Create a new per-schema HCS topic. Returns the topic ID string. */
  async createSchemaTopic(schemaUid: string, definition: string, authority: string): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const memo = `attestify.schema.${schemaUid.slice(0, 18)} — Per-schema audit log`;
      const tx = new TopicCreateTransaction()
        .setTopicMemo(memo)
        .setSubmitKey(this.client.operatorPublicKey!);
      const response = await tx.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      const topicId = receipt.topicId!.toString();

      // Publish init message to the new topic
      const initMsg: HCSMessage = {
        version: '1.0',
        type: 'schema.topic.initialized',
        payload: {
          schemaUid,
          definition,
          authority,
          topicId,
          createdAt: new Date().toISOString(),
        },
      };
      await this.submit(topicId, initMsg);
      console.log(`[HCS] Created per-schema topic ${topicId} for ${schemaUid.slice(0, 18)}...`);
      return topicId;
    } catch (err: unknown) {
      console.warn('[HCS] Failed to create per-schema topic:', (err as Error).message);
      return null;
    }
  }

  // ── Global + Per-Schema Publishing ─────────────────────────

  async publishSchemaRegistered(data: {
    uid: string;
    authority: string;
    resolver: string | null;
    definition: string;
    revocable?: boolean;
    transactionHash: string;
    blockNumber: number;
    consensusTimestamp: string;
  }, perSchemaTopicId?: string | null): Promise<void> {
    if (!this.enabled) return;
    const msg: HCSMessage = {
      version: '1.0',
      type: 'schema.registered',
      payload: {
        uid: data.uid,
        authority: data.authority,
        resolver: data.resolver,
        definition: data.definition,
        revocable: data.revocable ?? true,
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber,
        consensusTimestamp: data.consensusTimestamp,
        indexedAt: new Date().toISOString(),
      },
    };
    await this.submit(this.topics.schemas, msg);
    if (perSchemaTopicId) await this.submit(perSchemaTopicId, msg);
  }

  async publishAttestationCreated(data: {
    uid: string;
    schemaUid: string;
    attester: string;
    subject: string;
    data: string;
    decodedData?: Record<string, unknown> | null;
    nonce: number;
    expirationTime: number | null;
    transactionHash: string;
    blockNumber: number;
    consensusTimestamp: string;
  }, perSchemaTopicId?: string | null): Promise<void> {
    if (!this.enabled) return;
    const msg: HCSMessage = {
      version: '1.0',
      type: 'attestation.created',
      payload: {
        uid: data.uid,
        schemaUid: data.schemaUid,
        attester: data.attester,
        subject: data.subject,
        data: data.data,
        ...(data.decodedData ? { decodedData: data.decodedData } : {}),
        nonce: data.nonce,
        expirationTime: data.expirationTime,
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber,
        consensusTimestamp: data.consensusTimestamp,
        indexedAt: new Date().toISOString(),
      },
    };
    await this.submit(this.topics.attestations, msg);
    if (perSchemaTopicId) await this.submit(perSchemaTopicId, msg);
  }

  async publishAttestationRevoked(data: {
    uid: string;
    schemaUid?: string;
    revoker: string;
    transactionHash: string;
    blockNumber: number;
    consensusTimestamp: string;
  }, perSchemaTopicId?: string | null): Promise<void> {
    if (!this.enabled) return;
    const msg: HCSMessage = {
      version: '1.0',
      type: 'attestation.revoked',
      payload: {
        uid: data.uid,
        schemaUid: data.schemaUid || null,
        revoker: data.revoker,
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber,
        consensusTimestamp: data.consensusTimestamp,
        revokedAt: new Date().toISOString(),
      },
    };
    await this.submit(this.topics.attestations, msg);
    if (perSchemaTopicId) await this.submit(perSchemaTopicId, msg);
  }

  async publishAuthorityRegistered(data: {
    address: string;
    metadata: string | null;
    transactionHash: string;
    blockNumber: number;
    consensusTimestamp: string;
  }): Promise<void> {
    if (!this.enabled) return;
    const msg: HCSMessage = {
      version: '1.0',
      type: 'authority.registered',
      payload: {
        address: data.address,
        metadata: data.metadata,
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber,
        consensusTimestamp: data.consensusTimestamp,
        indexedAt: new Date().toISOString(),
      },
    };
    await this.submit(this.topics.authorities, msg);
  }

  /** Publish a resolver event to all per-schema topics that use the given resolver. */
  async publishResolverEvent(
    resolverAddress: string,
    eventType: string,
    payload: Record<string, unknown>,
    schemaTopicIds: string[],
  ): Promise<void> {
    if (!this.enabled) return;
    const msg: HCSMessage = {
      version: '1.0',
      type: eventType,
      payload: {
        ...payload,
        resolverAddress,
        indexedAt: new Date().toISOString(),
      },
    };
    // Publish to global attestations topic
    await this.submit(this.topics.attestations, msg);
    // Publish to each per-schema topic that uses this resolver
    for (const topicId of schemaTopicIds) {
      await this.submit(topicId, msg);
    }
  }

  /** Publish authority verification to all per-schema topics owned by that authority. */
  async publishAuthorityVerified(
    data: { address: string; verified: boolean },
    schemaTopicIds: string[],
  ): Promise<void> {
    if (!this.enabled) return;
    const msg: HCSMessage = {
      version: '1.0',
      type: 'authority.verified',
      payload: {
        address: data.address,
        verified: data.verified,
        verifiedAt: new Date().toISOString(),
      },
    };
    await this.submit(this.topics.authorities, msg);
    for (const topicId of schemaTopicIds) {
      await this.submit(topicId, msg);
    }
  }

  getTopicIds(): HCSTopicConfig { return { ...this.topics }; }
  isEnabled(): boolean { return this.enabled; }
  close(): void { this.client.close(); }

  // ── Private ──────────────────────────────────────────────────

  private async submit(topicId: string, message: HCSMessage): Promise<void> {
    if (!topicId) return;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await new TopicMessageSubmitTransaction()
          .setTopicId(TopicId.fromString(topicId))
          .setMessage(JSON.stringify(message, null, 2))
          .execute(this.client);
        console.log(`[HCS] Published ${message.type} → ${topicId}`);
        return;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt - 1)));
        } else {
          console.warn(`[HCS] Failed ${message.type} → ${topicId}: ${msg}`);
        }
      }
    }
  }
}
