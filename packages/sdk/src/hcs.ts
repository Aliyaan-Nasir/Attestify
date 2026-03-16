/**
 * Attestify SDK — HCS Logger
 *
 * Publishes structured JSON audit messages to Hedera Consensus Service (HCS) topics
 * for all protocol events: schema registration, attestation creation/revocation,
 * and authority registration. Implements retry logic with exponential backoff.
 * Failures are logged but never fail the parent operation.
 */

import { Client, TopicId, TopicMessageSubmitTransaction } from '@hashgraph/sdk';
import type {
  AttestationRecord,
  SchemaRecord,
  AuthorityRecord,
  HCSMessage,
} from './types';

/** Maximum number of submission attempts before giving up. */
const MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential backoff (1s, 2s, 4s). */
const BASE_DELAY_MS = 1000;

export interface HCSTopicIds {
  schemas?: string;
  attestations?: string;
  authorities?: string;
}

/**
 * HCSLogger submits structured JSON messages to HCS topics as an
 * immutable, consensus-timestamped audit trail for protocol events.
 *
 * Supports a single topic (backward-compatible) or per-category topics.
 * Retry strategy: up to 3 attempts with exponential backoff (1s, 2s, 4s).
 * After all retries are exhausted the error is logged and the call resolves.
 */
export class HCSLogger {
  private readonly topicIds: HCSTopicIds;
  private readonly legacyTopicId: string | null;
  private readonly client: Client;

  /**
   * @param topicIdOrIds - A single topic ID string (legacy) or per-category topic IDs
   * @param client - Authenticated @hashgraph/sdk Client
   */
  constructor(topicIdOrIds: string | HCSTopicIds, client: Client) {
    if (typeof topicIdOrIds === 'string') {
      this.legacyTopicId = topicIdOrIds;
      this.topicIds = {
        schemas: topicIdOrIds,
        attestations: topicIdOrIds,
        authorities: topicIdOrIds,
      };
    } else {
      this.legacyTopicId = null;
      this.topicIds = topicIdOrIds;
    }
    this.client = client;
  }

  /** Log a schema registration event to HCS. */
  async logSchemaRegistered(schema: SchemaRecord): Promise<void> {
    const topicId = this.topicIds.schemas;
    if (!topicId) return;

    const message: HCSMessage = {
      version: '1.0',
      type: 'schema.registered',
      payload: {
        uid: schema.uid,
        authority: schema.authority,
        resolver: schema.resolver,
        definition: schema.definition,
        revocable: schema.revocable,
        timestamp: Date.now(),
      },
    };

    await this.submitMessage(topicId, message);
  }

  /** Log an attestation-created event to HCS. */
  async logAttestation(attestation: AttestationRecord): Promise<void> {
    const topicId = this.topicIds.attestations;
    if (!topicId) return;

    const message: HCSMessage = {
      version: '1.0',
      type: 'attestation.created',
      payload: {
        attestationUid: attestation.uid,
        schemaUid: attestation.schemaUid,
        attester: attestation.attester,
        subject: attestation.subject,
        timestamp: Date.now(),
      },
    };

    await this.submitMessage(topicId, message);
  }

  /** Log an attestation-revoked event to HCS. */
  async logRevocation(attestationUid: string, revocationTimestamp: number): Promise<void> {
    const topicId = this.topicIds.attestations;
    if (!topicId) return;

    const message: HCSMessage = {
      version: '1.0',
      type: 'attestation.revoked',
      payload: {
        attestationUid,
        revocationTimestamp,
      },
    };

    await this.submitMessage(topicId, message);
  }

  /** Log an authority registration event to HCS. */
  async logAuthorityRegistered(authority: AuthorityRecord): Promise<void> {
    const topicId = this.topicIds.authorities;
    if (!topicId) return;

    const message: HCSMessage = {
      version: '1.0',
      type: 'authority.registered',
      payload: {
        address: authority.addr,
        metadata: authority.metadata,
        timestamp: Date.now(),
      },
    };

    await this.submitMessage(topicId, message);
  }

  /** Get the configured topic IDs. */
  getTopicIds(): HCSTopicIds {
    return { ...this.topicIds };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async submitMessage(topicId: string, message: HCSMessage): Promise<void> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await new TopicMessageSubmitTransaction()
          .setTopicId(TopicId.fromString(topicId))
          .setMessage(JSON.stringify(message, null, 2))
          .execute(this.client);

        return;
      } catch (error: unknown) {
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(
            `[HCSLogger] Failed to submit HCS message after ${MAX_RETRIES} attempts: ${errorMessage}`,
          );
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
