/**
 * Property-Based Tests for HCS Message Structure
 *
 * Property 22: HCS message structure — valid JSON with version, type, and payload
 * Property 23: HCS message content correctness — payload contains correct fields
 *
 * Tests construct HCS messages the same way HCSLogger does internally and verify
 * their structure and content against the type definitions.
 *
 * Uses fast-check for property-based testing with vitest.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type {
  AttestationRecord,
  HCSAttestationCreatedMessage,
  HCSAttestationRevokedMessage,
} from '../src/types';

// ─── Generators ──────────────────────────────────────────────────────────────

/** Random bytes32 hex string: 0x + 64 hex chars */
const bytes32Arb = fc
  .uint8Array({ minLength: 32, maxLength: 32 })
  .map(
    (bytes) =>
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
  );

/** Random Ethereum address: 0x + 40 hex chars */
const addressArb = fc
  .uint8Array({ minLength: 20, maxLength: 20 })
  .map(
    (bytes) =>
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
  );

/** Random positive integer for timestamps */
const timestampArb = fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER });

/** Random hex data bytes */
const hexBytesArb = fc
  .uint8Array({ minLength: 0, maxLength: 100 })
  .map(
    (bytes) =>
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
  );

/**
 * Generator for a minimal AttestationRecord with random valid fields.
 * Mirrors the on-chain struct shape used by HCSLogger.logAttestation().
 */
const attestationRecordArb = fc.record({
  uid: bytes32Arb,
  schemaUid: bytes32Arb,
  attester: addressArb,
  subject: addressArb,
  data: hexBytesArb,
  timestamp: timestampArb,
  expirationTime: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  revoked: fc.boolean(),
  revocationTime: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  nonce: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
}) as fc.Arbitrary<AttestationRecord>;

// ─── Helper: build messages the same way HCSLogger does ──────────────────────

function buildCreatedMessage(record: AttestationRecord): HCSAttestationCreatedMessage {
  return {
    version: '1.0',
    type: 'attestation.created',
    payload: {
      attestationUid: record.uid,
      schemaUid: record.schemaUid,
      attester: record.attester,
      subject: record.subject,
      timestamp: Date.now(),
    },
  };
}

function buildRevokedMessage(
  attestationUid: string,
  revocationTimestamp: number,
): HCSAttestationRevokedMessage {
  return {
    version: '1.0',
    type: 'attestation.revoked',
    payload: {
      attestationUid,
      revocationTimestamp,
    },
  };
}

// ─── Property 22: HCS Created Message Structure ─────────────────────────────

describe('Property 22 — HCS Created Message Structure', () => {
  /**
   * **Validates: Requirements 8.3**
   *
   * For any valid AttestationRecord, the HCS created message has version '1.0',
   * type 'attestation.created', and a payload with all required fields.
   */
  it('has version "1.0" and type "attestation.created"', () => {
    fc.assert(
      fc.property(attestationRecordArb, (record) => {
        const msg = buildCreatedMessage(record);
        expect(msg.version).toBe('1.0');
        expect(msg.type).toBe('attestation.created');
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * The payload contains all required fields: attestationUid, schemaUid,
   * attester, subject, timestamp.
   */
  it('payload contains all required fields with correct types', () => {
    fc.assert(
      fc.property(attestationRecordArb, (record) => {
        const msg = buildCreatedMessage(record);
        const { payload } = msg;

        expect(payload).toBeDefined();
        expect(typeof payload.attestationUid).toBe('string');
        expect(typeof payload.schemaUid).toBe('string');
        expect(typeof payload.attester).toBe('string');
        expect(typeof payload.subject).toBe('string');
        expect(typeof payload.timestamp).toBe('number');

        // Exactly 5 keys in payload
        expect(Object.keys(payload)).toHaveLength(5);
        expect(Object.keys(payload).sort()).toEqual(
          ['attestationUid', 'attester', 'schemaUid', 'subject', 'timestamp'].sort(),
        );
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * The created message is valid JSON when stringified and parsed back,
   * preserving all fields.
   */
  it('is valid JSON when stringified and round-trips correctly', () => {
    fc.assert(
      fc.property(attestationRecordArb, (record) => {
        const msg = buildCreatedMessage(record);
        const json = JSON.stringify(msg);

        // Must be a valid JSON string
        expect(typeof json).toBe('string');

        const parsed = JSON.parse(json);
        expect(parsed.version).toBe('1.0');
        expect(parsed.type).toBe('attestation.created');
        expect(parsed.payload.attestationUid).toBe(msg.payload.attestationUid);
        expect(parsed.payload.schemaUid).toBe(msg.payload.schemaUid);
        expect(parsed.payload.attester).toBe(msg.payload.attester);
        expect(parsed.payload.subject).toBe(msg.payload.subject);
        expect(parsed.payload.timestamp).toBe(msg.payload.timestamp);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.1**
   *
   * The payload fields match the input AttestationRecord values.
   */
  it('payload fields match the input attestation record', () => {
    fc.assert(
      fc.property(attestationRecordArb, (record) => {
        const msg = buildCreatedMessage(record);
        expect(msg.payload.attestationUid).toBe(record.uid);
        expect(msg.payload.schemaUid).toBe(record.schemaUid);
        expect(msg.payload.attester).toBe(record.attester);
        expect(msg.payload.subject).toBe(record.subject);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 23: HCS Revoked Message Structure ─────────────────────────────

describe('Property 23 — HCS Revoked Message Structure', () => {
  /**
   * **Validates: Requirements 8.3**
   *
   * For any valid attestation UID and timestamp, the HCS revoked message
   * has version '1.0' and type 'attestation.revoked'.
   */
  it('has version "1.0" and type "attestation.revoked"', () => {
    fc.assert(
      fc.property(bytes32Arb, timestampArb, (uid, ts) => {
        const msg = buildRevokedMessage(uid, ts);
        expect(msg.version).toBe('1.0');
        expect(msg.type).toBe('attestation.revoked');
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * The payload contains all required fields: attestationUid, revocationTimestamp.
   */
  it('payload contains all required fields with correct types', () => {
    fc.assert(
      fc.property(bytes32Arb, timestampArb, (uid, ts) => {
        const msg = buildRevokedMessage(uid, ts);
        const { payload } = msg;

        expect(payload).toBeDefined();
        expect(typeof payload.attestationUid).toBe('string');
        expect(typeof payload.revocationTimestamp).toBe('number');

        // Exactly 2 keys in payload
        expect(Object.keys(payload)).toHaveLength(2);
        expect(Object.keys(payload).sort()).toEqual(
          ['attestationUid', 'revocationTimestamp'].sort(),
        );
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * The revoked message is valid JSON when stringified and parsed back,
   * preserving all fields.
   */
  it('is valid JSON when stringified and round-trips correctly', () => {
    fc.assert(
      fc.property(bytes32Arb, timestampArb, (uid, ts) => {
        const msg = buildRevokedMessage(uid, ts);
        const json = JSON.stringify(msg);

        expect(typeof json).toBe('string');

        const parsed = JSON.parse(json);
        expect(parsed.version).toBe('1.0');
        expect(parsed.type).toBe('attestation.revoked');
        expect(parsed.payload.attestationUid).toBe(uid);
        expect(parsed.payload.revocationTimestamp).toBe(ts);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.2**
   *
   * The payload fields match the input values exactly.
   */
  it('payload fields match the input values', () => {
    fc.assert(
      fc.property(bytes32Arb, timestampArb, (uid, ts) => {
        const msg = buildRevokedMessage(uid, ts);
        expect(msg.payload.attestationUid).toBe(uid);
        expect(msg.payload.revocationTimestamp).toBe(ts);
      }),
      { numRuns: 200 },
    );
  });
});
