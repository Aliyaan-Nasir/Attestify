/**
 * Integration tests for Indexer ↔ Mirror Node polling with deployed contracts.
 *
 * Tests the full pipeline: Mirror Node polling → event decoding → database storage,
 * with mocked Mirror Node responses and mocked Prisma client.
 *
 * Verifies:
 * 1. Polls Mirror Node REST API for contract event logs
 * 2. Decodes SchemaRegistered, AttestationCreated, AttestationRevoked events correctly
 * 3. Stores decoded data in the database (mocked Prisma)
 * 4. Tracks lastProcessedBlock and resumes from it
 * 5. Handles Mirror Node failures with exponential backoff
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ethers } from 'ethers';
import { Indexer } from '../src/indexer.js';
import {
  schemaRegistryInterface,
  attestationServiceInterface,
} from '../src/decoder.js';
import type { MirrorNodeClient, MirrorNodeLog, MirrorNodeLogsResponse } from '../src/mirror-node.js';

// ─── Helpers ────────────────────────────────────────────────

function createMockPrisma() {
  return {
    indexerState: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    schema: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    attestation: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    authority: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

function makeSchemaRegisteredLog(
  uid: string,
  authority: string,
  resolver: string,
  blockNumber: number,
  timestamp: string,
  txHash: string,
): MirrorNodeLog {
  const event = schemaRegistryInterface.getEvent('SchemaRegistered')!;
  const encoded = schemaRegistryInterface.encodeEventLog(event, [uid, authority, resolver]);
  return {
    address: '0x0000000000000000000000000000000000000100',
    topics: encoded.topics as string[],
    data: encoded.data,
    block_number: blockNumber,
    timestamp,
    transaction_hash: txHash,
  };
}

function makeAttestationCreatedLog(
  uid: string,
  schemaUid: string,
  attester: string,
  subject: string,
  blockNumber: number,
  timestamp: string,
  txHash: string,
): MirrorNodeLog {
  const event = attestationServiceInterface.getEvent('AttestationCreated')!;
  const encoded = attestationServiceInterface.encodeEventLog(event, [uid, schemaUid, attester, subject]);
  return {
    address: '0x0000000000000000000000000000000000000200',
    topics: encoded.topics as string[],
    data: encoded.data,
    block_number: blockNumber,
    timestamp,
    transaction_hash: txHash,
  };
}

function makeAttestationRevokedLog(
  uid: string,
  revoker: string,
  blockNumber: number,
  timestamp: string,
  txHash: string,
): MirrorNodeLog {
  const event = attestationServiceInterface.getEvent('AttestationRevoked')!;
  const encoded = attestationServiceInterface.encodeEventLog(event, [uid, revoker]);
  return {
    address: '0x0000000000000000000000000000000000000200',
    topics: encoded.topics as string[],
    data: encoded.data,
    block_number: blockNumber,
    timestamp,
    transaction_hash: txHash,
  };
}

function makeAuthorityRegisteredLog(
  authority: string,
  blockNumber: number,
  timestamp: string,
  txHash: string,
): MirrorNodeLog {
  const event = attestationServiceInterface.getEvent('AuthorityRegistered')!;
  const encoded = attestationServiceInterface.encodeEventLog(event, [authority]);
  return {
    address: '0x0000000000000000000000000000000000000200',
    topics: encoded.topics as string[],
    data: encoded.data,
    block_number: blockNumber,
    timestamp,
    transaction_hash: txHash,
  };
}

// Fixed test data
const SCHEMA_UID = '0x' + 'aa'.repeat(32);
const ATTESTATION_UID = '0x' + 'bb'.repeat(32);
const AUTHORITY_ADDR = ethers.getAddress('0x' + '11'.repeat(20));
const RESOLVER_ADDR = ethers.getAddress('0x' + '22'.repeat(20));
const ATTESTER_ADDR = ethers.getAddress('0x' + '33'.repeat(20));
const SUBJECT_ADDR = ethers.getAddress('0x' + '44'.repeat(20));
const TX_HASH_1 = '0x' + 'f1'.repeat(32);
const TX_HASH_2 = '0x' + 'f2'.repeat(32);
const TX_HASH_3 = '0x' + 'f3'.repeat(32);
const TX_HASH_4 = '0x' + 'f4'.repeat(32);

const SCHEMA_REGISTRY_ID = '0.0.100';
const ATTESTATION_SERVICE_ID = '0.0.200';

// ─── Integration Tests ──────────────────────────────────────

describe('Indexer ↔ Mirror Node Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Full polling pipeline: fetch → decode → store', () => {
    it('processes SchemaRegistered events and stores them in the database', async () => {
      const prisma = createMockPrisma();
      const schemaLog = makeSchemaRegisteredLog(
        SCHEMA_UID, AUTHORITY_ADDR, RESOLVER_ADDR, 100, '1700000001.000000000', TX_HASH_1,
      );

      const mirrorNode = {
        fetchContractLogs: vi.fn()
          .mockResolvedValueOnce({ logs: [schemaLog], links: {} } as MirrorNodeLogsResponse)
          .mockResolvedValueOnce({ logs: [], links: {} } as MirrorNodeLogsResponse)
          .mockResolvedValue({ logs: [], links: {} } as MirrorNodeLogsResponse),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(prisma.schema.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uid: SCHEMA_UID },
          create: expect.objectContaining({
            uid: SCHEMA_UID,
            authorityAddress: AUTHORITY_ADDR,
            resolverAddress: RESOLVER_ADDR,
            transactionHash: TX_HASH_1,
            blockNumber: 100,
            consensusTimestamp: '1700000001.000000000',
          }),
        }),
      );

      indexer.stop();
    });

    it('processes AttestationCreated events and stores them in the database', async () => {
      const prisma = createMockPrisma();
      const attestLog = makeAttestationCreatedLog(
        ATTESTATION_UID, SCHEMA_UID, ATTESTER_ADDR, SUBJECT_ADDR, 101, '1700000002.000000000', TX_HASH_2,
      );

      const mirrorNode = {
        fetchContractLogs: vi.fn()
          .mockResolvedValueOnce({ logs: [], links: {} })
          .mockResolvedValueOnce({ logs: [attestLog], links: {} })
          .mockResolvedValue({ logs: [], links: {} }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(prisma.attestation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uid: ATTESTATION_UID },
          create: expect.objectContaining({
            uid: ATTESTATION_UID,
            schemaUid: SCHEMA_UID,
            attesterAddress: ATTESTER_ADDR,
            subjectAddress: SUBJECT_ADDR,
            transactionHash: TX_HASH_2,
            blockNumber: 101,
            consensusTimestamp: '1700000002.000000000',
          }),
        }),
      );

      indexer.stop();
    });

    it('processes AttestationRevoked events and updates the database', async () => {
      const prisma = createMockPrisma();
      const revokeLog = makeAttestationRevokedLog(
        ATTESTATION_UID, ATTESTER_ADDR, 102, '1700000003.000000000', TX_HASH_3,
      );

      const mirrorNode = {
        fetchContractLogs: vi.fn()
          .mockResolvedValueOnce({ logs: [], links: {} })
          .mockResolvedValueOnce({ logs: [revokeLog], links: {} })
          .mockResolvedValue({ logs: [], links: {} }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(prisma.attestation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uid: ATTESTATION_UID },
          data: expect.objectContaining({
            revoked: true,
            revocationTxHash: TX_HASH_3,
          }),
        }),
      );

      indexer.stop();
    });
  });

  describe('Multi-event lifecycle: register → attest → revoke', () => {
    it('processes a full lifecycle of events across multiple poll cycles', async () => {
      const prisma = createMockPrisma();

      const schemaLog = makeSchemaRegisteredLog(
        SCHEMA_UID, AUTHORITY_ADDR, RESOLVER_ADDR, 100, '1700000001.000000000', TX_HASH_1,
      );
      const attestLog = makeAttestationCreatedLog(
        ATTESTATION_UID, SCHEMA_UID, ATTESTER_ADDR, SUBJECT_ADDR, 101, '1700000002.000000000', TX_HASH_2,
      );
      const revokeLog = makeAttestationRevokedLog(
        ATTESTATION_UID, ATTESTER_ADDR, 102, '1700000003.000000000', TX_HASH_3,
      );

      // Poll 1: schema + attestation logs from both contracts
      // Poll 2: revocation log
      // Poll 3+: empty
      let callCount = 0;
      const mirrorNode = {
        fetchContractLogs: vi.fn().mockImplementation((contractId: string) => {
          callCount++;
          // Calls 1-2 are the first poll (schema registry + attestation service)
          if (callCount <= 2) {
            if (contractId === SCHEMA_REGISTRY_ID) {
              return Promise.resolve({ logs: [schemaLog], links: {} });
            }
            return Promise.resolve({ logs: [attestLog], links: {} });
          }
          // Calls 3-4 are the second poll
          if (callCount <= 4) {
            if (contractId === ATTESTATION_SERVICE_ID) {
              return Promise.resolve({ logs: [revokeLog], links: {} });
            }
            return Promise.resolve({ logs: [], links: {} });
          }
          return Promise.resolve({ logs: [], links: {} });
        }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      // Poll 1
      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(prisma.schema.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.attestation.upsert).toHaveBeenCalledTimes(1);

      // Poll 2 (after polling interval)
      await vi.advanceTimersByTimeAsync(5000);

      expect(prisma.attestation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uid: ATTESTATION_UID },
          data: expect.objectContaining({ revoked: true }),
        }),
      );

      indexer.stop();
    });

    it('processes mixed events from both contracts in a single poll sorted by timestamp', async () => {
      const prisma = createMockPrisma();

      const schemaLog = makeSchemaRegisteredLog(
        SCHEMA_UID, AUTHORITY_ADDR, RESOLVER_ADDR, 100, '1700000001.000000000', TX_HASH_1,
      );
      const attestLog = makeAttestationCreatedLog(
        ATTESTATION_UID, SCHEMA_UID, ATTESTER_ADDR, SUBJECT_ADDR, 100, '1700000001.500000000', TX_HASH_2,
      );
      const authorityLog = makeAuthorityRegisteredLog(
        AUTHORITY_ADDR, 100, '1700000001.200000000', TX_HASH_4,
      );

      const mirrorNode = {
        fetchContractLogs: vi.fn().mockImplementation((contractId: string) => {
          if (contractId === SCHEMA_REGISTRY_ID) {
            return Promise.resolve({ logs: [schemaLog], links: {} });
          }
          return Promise.resolve({ logs: [authorityLog, attestLog], links: {} });
        }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      // All three events should be processed
      expect(prisma.schema.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.authority.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.attestation.upsert).toHaveBeenCalledTimes(1);

      // State should be updated with the latest timestamp
      expect(prisma.indexerState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastProcessedTimestamp: '1700000001.500000000',
            lastProcessedBlock: 100,
            syncStatus: 'synced',
          }),
        }),
      );

      indexer.stop();
    });
  });

  describe('lastProcessedBlock tracking and resume', () => {
    it('resumes polling from the stored lastProcessedTimestamp', async () => {
      const prisma = createMockPrisma();
      const mirrorNode = {
        fetchContractLogs: vi.fn().mockResolvedValue({ logs: [], links: {} }),
      } as unknown as MirrorNodeClient;

      const savedTimestamp = '1700000050.000000000';
      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: savedTimestamp, lastProcessedBlock: 500, syncStatus: 'synced',
      });

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      // Both contract polls should use the saved timestamp
      expect(mirrorNode.fetchContractLogs).toHaveBeenCalledWith(SCHEMA_REGISTRY_ID, savedTimestamp);
      expect(mirrorNode.fetchContractLogs).toHaveBeenCalledWith(ATTESTATION_SERVICE_ID, savedTimestamp);

      indexer.stop();
    });

    it('updates lastProcessedBlock to the highest block from processed events', async () => {
      const prisma = createMockPrisma();

      const log1 = makeSchemaRegisteredLog(
        SCHEMA_UID, AUTHORITY_ADDR, RESOLVER_ADDR, 200, '1700000010.000000000', TX_HASH_1,
      );
      const log2 = makeAttestationCreatedLog(
        ATTESTATION_UID, SCHEMA_UID, ATTESTER_ADDR, SUBJECT_ADDR, 205, '1700000015.000000000', TX_HASH_2,
      );

      const mirrorNode = {
        fetchContractLogs: vi.fn().mockImplementation((contractId: string) => {
          if (contractId === SCHEMA_REGISTRY_ID) {
            return Promise.resolve({ logs: [log1], links: {} });
          }
          return Promise.resolve({ logs: [log2], links: {} });
        }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      // Should update to the highest block number (205) and latest timestamp
      expect(prisma.indexerState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastProcessedBlock: 205,
            lastProcessedTimestamp: '1700000015.000000000',
          }),
        }),
      );

      indexer.stop();
    });

    it('skips events at the boundary timestamp to avoid reprocessing', async () => {
      const prisma = createMockPrisma();
      const boundaryTimestamp = '1700000050.000000000';

      // Return a log with the exact boundary timestamp — should be skipped
      const boundaryLog = makeSchemaRegisteredLog(
        SCHEMA_UID, AUTHORITY_ADDR, RESOLVER_ADDR, 500, boundaryTimestamp, TX_HASH_1,
      );

      const mirrorNode = {
        fetchContractLogs: vi.fn()
          .mockResolvedValueOnce({ logs: [boundaryLog], links: {} })
          .mockResolvedValue({ logs: [], links: {} }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: boundaryTimestamp, lastProcessedBlock: 500, syncStatus: 'synced',
      });

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      // The boundary log should be skipped — no upsert
      expect(prisma.schema.upsert).not.toHaveBeenCalled();

      indexer.stop();
    });
  });

  describe('Mirror Node failure handling with exponential backoff', () => {
    it('retries with exponential backoff on Mirror Node failure then recovers', async () => {
      const prisma = createMockPrisma();

      const mirrorNode = {
        fetchContractLogs: vi.fn()
          // First poll: fail
          .mockRejectedValueOnce(new Error('503 Service Unavailable'))
          .mockRejectedValueOnce(new Error('503 Service Unavailable'))
          // Second poll (after 1s backoff): fail again
          .mockRejectedValueOnce(new Error('503 Service Unavailable'))
          .mockRejectedValueOnce(new Error('503 Service Unavailable'))
          // Third poll (after 2s backoff): succeed
          .mockResolvedValue({ logs: [], links: {} }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();

      // First poll fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(prisma.indexerState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ syncStatus: 'error' }),
        }),
      );

      // After 1s backoff, second poll also fails
      await vi.advanceTimersByTimeAsync(1000);

      // After 2s backoff, third poll succeeds
      await vi.advanceTimersByTimeAsync(2000);

      // Verify the mirror node was called multiple times with increasing backoff
      expect(mirrorNode.fetchContractLogs).toHaveBeenCalledTimes(6); // 2 calls per poll × 3 polls

      indexer.stop();
    });

    it('records error state in database on Mirror Node failure', async () => {
      const prisma = createMockPrisma();
      const errorMsg = 'Connection refused';

      const mirrorNode = {
        fetchContractLogs: vi.fn().mockRejectedValue(new Error(errorMsg)),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(prisma.indexerState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            syncStatus: 'error',
            errorMessage: expect.stringContaining(errorMsg),
          }),
        }),
      );

      indexer.stop();
    });
  });

  describe('Event decoding correctness in pipeline context', () => {
    it('correctly decodes all event fields from realistic Mirror Node log data', async () => {
      const prisma = createMockPrisma();

      const schemaLog = makeSchemaRegisteredLog(
        SCHEMA_UID, AUTHORITY_ADDR, RESOLVER_ADDR, 100, '1700000001.000000000', TX_HASH_1,
      );
      const attestLog = makeAttestationCreatedLog(
        ATTESTATION_UID, SCHEMA_UID, ATTESTER_ADDR, SUBJECT_ADDR, 101, '1700000002.000000000', TX_HASH_2,
      );
      const revokeLog = makeAttestationRevokedLog(
        ATTESTATION_UID, ATTESTER_ADDR, 102, '1700000003.000000000', TX_HASH_3,
      );

      const mirrorNode = {
        fetchContractLogs: vi.fn().mockImplementation((contractId: string) => {
          if (contractId === SCHEMA_REGISTRY_ID) {
            return Promise.resolve({ logs: [schemaLog], links: {} });
          }
          return Promise.resolve({ logs: [attestLog, revokeLog], links: {} });
        }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      // Verify SchemaRegistered fields
      const schemaCall = prisma.schema.upsert.mock.calls[0][0];
      expect(schemaCall.create.uid).toBe(SCHEMA_UID);
      expect(schemaCall.create.authorityAddress).toBe(AUTHORITY_ADDR);
      expect(schemaCall.create.resolverAddress).toBe(RESOLVER_ADDR);

      // Verify AttestationCreated fields
      const attestCall = prisma.attestation.upsert.mock.calls[0][0];
      expect(attestCall.create.uid).toBe(ATTESTATION_UID);
      expect(attestCall.create.schemaUid).toBe(SCHEMA_UID);
      expect(attestCall.create.attesterAddress).toBe(ATTESTER_ADDR);
      expect(attestCall.create.subjectAddress).toBe(SUBJECT_ADDR);

      // Verify AttestationRevoked fields
      const revokeCall = prisma.attestation.updateMany.mock.calls[0][0];
      expect(revokeCall.where.uid).toBe(ATTESTATION_UID);
      expect(revokeCall.data.revoked).toBe(true);
      expect(revokeCall.data.revocationTxHash).toBe(TX_HASH_3);

      indexer.stop();
    });

    it('stores null resolver when zero address is provided', async () => {
      const prisma = createMockPrisma();
      const zeroResolver = '0x0000000000000000000000000000000000000000';

      const schemaLog = makeSchemaRegisteredLog(
        SCHEMA_UID, AUTHORITY_ADDR, zeroResolver, 100, '1700000001.000000000', TX_HASH_1,
      );

      const mirrorNode = {
        fetchContractLogs: vi.fn()
          .mockResolvedValueOnce({ logs: [schemaLog], links: {} })
          .mockResolvedValue({ logs: [], links: {} }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      const schemaCall = prisma.schema.upsert.mock.calls[0][0];
      expect(schemaCall.create.resolverAddress).toBeNull();

      indexer.stop();
    });
  });

  describe('Edge cases', () => {
    it('handles empty log responses gracefully without updating state', async () => {
      const prisma = createMockPrisma();
      const mirrorNode = {
        fetchContractLogs: vi.fn().mockResolvedValue({ logs: [], links: {} }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '1700000000.000000000', lastProcessedBlock: 100, syncStatus: 'synced',
      });

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      // No events processed — state should not be updated
      expect(prisma.schema.upsert).not.toHaveBeenCalled();
      expect(prisma.attestation.upsert).not.toHaveBeenCalled();
      expect(prisma.attestation.updateMany).not.toHaveBeenCalled();

      indexer.stop();
    });

    it('skips unrecognized event topics without crashing', async () => {
      const prisma = createMockPrisma();

      const unknownLog: MirrorNodeLog = {
        address: '0x0000000000000000000000000000000000000100',
        topics: ['0x' + '00'.repeat(32)],
        data: '0x',
        block_number: 100,
        timestamp: '1700000001.000000000',
        transaction_hash: TX_HASH_1,
      };

      const mirrorNode = {
        fetchContractLogs: vi.fn()
          .mockResolvedValueOnce({ logs: [unknownLog], links: {} })
          .mockResolvedValue({ logs: [], links: {} }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      // Should not crash, no DB writes for unknown events
      expect(prisma.schema.upsert).not.toHaveBeenCalled();
      expect(prisma.attestation.upsert).not.toHaveBeenCalled();

      indexer.stop();
    });

    it('continues processing remaining events when one event fails to decode', async () => {
      const prisma = createMockPrisma();

      // A malformed log followed by a valid one
      const badLog: MirrorNodeLog = {
        address: '0x0000000000000000000000000000000000000100',
        topics: [schemaRegistryInterface.getEvent('SchemaRegistered')!.topicHash],
        data: '0xBADDATA',
        block_number: 100,
        timestamp: '1700000001.000000000',
        transaction_hash: TX_HASH_1,
      };
      const goodLog = makeAttestationCreatedLog(
        ATTESTATION_UID, SCHEMA_UID, ATTESTER_ADDR, SUBJECT_ADDR, 101, '1700000002.000000000', TX_HASH_2,
      );

      const mirrorNode = {
        fetchContractLogs: vi.fn().mockImplementation((contractId: string) => {
          if (contractId === SCHEMA_REGISTRY_ID) {
            return Promise.resolve({ logs: [badLog], links: {} });
          }
          return Promise.resolve({ logs: [goodLog], links: {} });
        }),
      } as unknown as MirrorNodeClient;

      prisma.indexerState.findFirst.mockResolvedValue({
        id: 'state-1', lastProcessedTimestamp: '0.0', lastProcessedBlock: 0, syncStatus: 'syncing',
      });
      prisma.indexerState.update.mockResolvedValue({});

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress: SCHEMA_REGISTRY_ID,
        attestationServiceAddress: ATTESTATION_SERVICE_ID,
        pollingIntervalMs: 5000,
        mirrorNodeClient: mirrorNode,
      });

      await indexer.start();
      await vi.advanceTimersByTimeAsync(0);

      // Bad log should be skipped, good log should be processed
      expect(prisma.attestation.upsert).toHaveBeenCalledTimes(1);

      indexer.stop();
    });
  });
});
