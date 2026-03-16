/**
 * Property tests for event decoding correctness (Property 28).
 *
 * **Validates: Requirements 19.2**
 *
 * For any valid Mirror Node event log matching SchemaRegistered, AttestationCreated,
 * or AttestationRevoked ABI signatures, the indexer's decoder should produce a
 * database record whose fields match the original event parameters.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ethers } from 'ethers';
import {
  decodeSchemaRegistered,
  decodeAttestationCreated,
  decodeAttestationRevoked,
  decodeAuthorityRegistered,
  decodeLog,
  schemaRegistryInterface,
  attestationServiceInterface,
  EVENT_TOPICS,
} from '../src/decoder.js';
import type { MirrorNodeLog } from '../src/mirror-node.js';

// Arbitraries
const arbBytes32 = fc.hexaString({ minLength: 64, maxLength: 64 }).map((h) => '0x' + h);
const arbAddress = fc.hexaString({ minLength: 40, maxLength: 40 }).map((h) => ethers.getAddress('0x' + h));
const arbBlockNumber = fc.integer({ min: 1, max: 999999 });
const arbTimestamp = fc.tuple(fc.integer({ min: 1000000000, max: 1999999999 }), fc.integer({ min: 0, max: 999999999 }))
  .map(([s, ns]) => `${s}.${String(ns).padStart(9, '0')}`);
const arbTxHash = fc.hexaString({ minLength: 64, maxLength: 64 }).map((h) => '0x' + h);

function encodeSchemaRegisteredLog(uid: string, authority: string, resolver: string): Pick<MirrorNodeLog, 'topics' | 'data'> {
  const event = schemaRegistryInterface.getEvent('SchemaRegistered')!;
  const encoded = schemaRegistryInterface.encodeEventLog(event, [uid, authority, resolver]);
  return { topics: encoded.topics as string[], data: encoded.data };
}

function encodeAttestationCreatedLog(uid: string, schemaUid: string, attester: string, subject: string): Pick<MirrorNodeLog, 'topics' | 'data'> {
  const event = attestationServiceInterface.getEvent('AttestationCreated')!;
  const encoded = attestationServiceInterface.encodeEventLog(event, [uid, schemaUid, attester, subject]);
  return { topics: encoded.topics as string[], data: encoded.data };
}

function encodeAttestationRevokedLog(uid: string, revoker: string): Pick<MirrorNodeLog, 'topics' | 'data'> {
  const event = attestationServiceInterface.getEvent('AttestationRevoked')!;
  const encoded = attestationServiceInterface.encodeEventLog(event, [uid, revoker]);
  return { topics: encoded.topics as string[], data: encoded.data };
}

function encodeAuthorityRegisteredLog(authority: string): Pick<MirrorNodeLog, 'topics' | 'data'> {
  const event = attestationServiceInterface.getEvent('AuthorityRegistered')!;
  const encoded = attestationServiceInterface.encodeEventLog(event, [authority]);
  return { topics: encoded.topics as string[], data: encoded.data };
}

describe('Property 28: Indexer event decoding correctness', () => {
  it('decodes SchemaRegistered events correctly for any valid inputs', () => {
    fc.assert(
      fc.property(
        arbBytes32, arbAddress, arbAddress, arbBlockNumber, arbTimestamp, arbTxHash,
        (uid, authority, resolver, blockNumber, timestamp, txHash) => {
          const { topics, data } = encodeSchemaRegisteredLog(uid, authority, resolver);
          const log: MirrorNodeLog = {
            address: '0x0000000000000000000000000000000000000001',
            topics,
            data,
            block_number: blockNumber,
            timestamp,
            transaction_hash: txHash,
          };

          const decoded = decodeSchemaRegistered(log);

          expect(decoded.uid).toBe(uid);
          expect(decoded.authorityAddress.toLowerCase()).toBe(authority.toLowerCase());
          expect(decoded.resolverAddress.toLowerCase()).toBe(resolver.toLowerCase());
          expect(decoded.blockNumber).toBe(blockNumber);
          expect(decoded.consensusTimestamp).toBe(timestamp);
          expect(decoded.transactionHash).toBe(txHash);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('decodes AttestationCreated events correctly for any valid inputs', () => {
    fc.assert(
      fc.property(
        arbBytes32, arbBytes32, arbAddress, arbAddress, arbBlockNumber, arbTimestamp, arbTxHash,
        (uid, schemaUid, attester, subject, blockNumber, timestamp, txHash) => {
          const { topics, data } = encodeAttestationCreatedLog(uid, schemaUid, attester, subject);
          const log: MirrorNodeLog = {
            address: '0x0000000000000000000000000000000000000002',
            topics,
            data,
            block_number: blockNumber,
            timestamp,
            transaction_hash: txHash,
          };

          const decoded = decodeAttestationCreated(log);

          expect(decoded.uid).toBe(uid);
          expect(decoded.schemaUid).toBe(schemaUid);
          expect(decoded.attesterAddress.toLowerCase()).toBe(attester.toLowerCase());
          expect(decoded.subjectAddress.toLowerCase()).toBe(subject.toLowerCase());
          expect(decoded.blockNumber).toBe(blockNumber);
          expect(decoded.consensusTimestamp).toBe(timestamp);
          expect(decoded.transactionHash).toBe(txHash);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('decodes AttestationRevoked events correctly for any valid inputs', () => {
    fc.assert(
      fc.property(
        arbBytes32, arbAddress, arbBlockNumber, arbTimestamp, arbTxHash,
        (uid, revoker, blockNumber, timestamp, txHash) => {
          const { topics, data } = encodeAttestationRevokedLog(uid, revoker);
          const log: MirrorNodeLog = {
            address: '0x0000000000000000000000000000000000000002',
            topics,
            data,
            block_number: blockNumber,
            timestamp,
            transaction_hash: txHash,
          };

          const decoded = decodeAttestationRevoked(log);

          expect(decoded.uid).toBe(uid);
          expect(decoded.revokerAddress.toLowerCase()).toBe(revoker.toLowerCase());
          expect(decoded.blockNumber).toBe(blockNumber);
          expect(decoded.consensusTimestamp).toBe(timestamp);
          expect(decoded.transactionHash).toBe(txHash);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('decodeLog dispatches to the correct decoder based on topic[0]', () => {
    fc.assert(
      fc.property(
        arbBytes32, arbAddress, arbAddress, arbBlockNumber, arbTimestamp, arbTxHash,
        (uid, authority, resolver, blockNumber, timestamp, txHash) => {
          const { topics, data } = encodeSchemaRegisteredLog(uid, authority, resolver);
          const log: MirrorNodeLog = {
            address: '0x0000000000000000000000000000000000000001',
            topics,
            data,
            block_number: blockNumber,
            timestamp,
            transaction_hash: txHash,
          };

          const result = decodeLog(log);
          expect(result).not.toBeNull();
          expect(result!.type).toBe('SchemaRegistered');
          expect(result!.data).toHaveProperty('uid', uid);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('decodeLog returns null for unknown event signatures', () => {
    const log: MirrorNodeLog = {
      address: '0x0000000000000000000000000000000000000001',
      topics: ['0x' + '00'.repeat(32)],
      data: '0x',
      block_number: 1,
      timestamp: '1234567890.000000000',
      transaction_hash: '0x' + 'ab'.repeat(32),
    };

    expect(decodeLog(log)).toBeNull();
  });
});
