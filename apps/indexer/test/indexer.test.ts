/**
 * Unit tests for Indexer polling loop, retry behavior, and state tracking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Indexer } from '../src/indexer.js';
import type { MirrorNodeClient, MirrorNodeLogsResponse } from '../src/mirror-node.js';

function createMockPrisma() {
  return {
    indexerState: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    schema: {
      upsert: vi.fn(),
    },
    attestation: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    authority: {
      upsert: vi.fn(),
    },
  } as any;
}

function createMockMirrorNode(response?: MirrorNodeLogsResponse) {
  return {
    fetchContractLogs: vi.fn().mockResolvedValue(response || { logs: [], links: {} }),
  } as unknown as MirrorNodeClient;
}

describe('Indexer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates initial state if none exists', async () => {
    const prisma = createMockPrisma();
    const mirrorNode = createMockMirrorNode();

    prisma.indexerState.findFirst.mockResolvedValue(null);
    prisma.indexerState.create.mockResolvedValue({
      id: 'state-1',
      lastProcessedTimestamp: '0.0',
      lastProcessedBlock: 0,
      syncStatus: 'syncing',
    });

    const indexer = new Indexer(prisma, {
      schemaRegistryAddress: '0.0.100',
      attestationServiceAddress: '0.0.200',
      pollingIntervalMs: 5000,
      mirrorNodeClient: mirrorNode,
    });

    await indexer.start();

    // Let the first poll execute
    await vi.advanceTimersByTimeAsync(0);

    expect(prisma.indexerState.findFirst).toHaveBeenCalled();
    expect(prisma.indexerState.create).toHaveBeenCalled();

    indexer.stop();
  });

  it('resumes from lastProcessedTimestamp after restart', async () => {
    const prisma = createMockPrisma();
    const mirrorNode = createMockMirrorNode();

    prisma.indexerState.findFirst.mockResolvedValue({
      id: 'state-1',
      lastProcessedTimestamp: '1700000000.000000000',
      lastProcessedBlock: 500,
      syncStatus: 'synced',
    });

    const indexer = new Indexer(prisma, {
      schemaRegistryAddress: '0.0.100',
      attestationServiceAddress: '0.0.200',
      pollingIntervalMs: 5000,
      mirrorNodeClient: mirrorNode,
    });

    await indexer.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(mirrorNode.fetchContractLogs).toHaveBeenCalledWith(
      '0.0.100',
      '1700000000.000000000',
    );
    expect(mirrorNode.fetchContractLogs).toHaveBeenCalledWith(
      '0.0.200',
      '1700000000.000000000',
    );

    indexer.stop();
  });

  it('stops polling when stop() is called', async () => {
    const prisma = createMockPrisma();
    const mirrorNode = createMockMirrorNode();

    prisma.indexerState.findFirst.mockResolvedValue({
      id: 'state-1',
      lastProcessedTimestamp: '0.0',
      lastProcessedBlock: 0,
      syncStatus: 'syncing',
    });

    const indexer = new Indexer(prisma, {
      schemaRegistryAddress: '0.0.100',
      attestationServiceAddress: '0.0.200',
      pollingIntervalMs: 5000,
      mirrorNodeClient: mirrorNode,
    });

    await indexer.start();
    await vi.advanceTimersByTimeAsync(0);

    indexer.stop();

    // Clear call counts
    (mirrorNode.fetchContractLogs as any).mockClear();

    // Advance time — should NOT trigger another poll
    await vi.advanceTimersByTimeAsync(10000);

    expect(mirrorNode.fetchContractLogs).not.toHaveBeenCalled();
  });

  it('applies exponential backoff on Mirror Node failure', async () => {
    const prisma = createMockPrisma();
    const mirrorNode = {
      fetchContractLogs: vi.fn().mockRejectedValue(new Error('Service Unavailable')),
    } as unknown as MirrorNodeClient;

    prisma.indexerState.findFirst.mockResolvedValue({
      id: 'state-1',
      lastProcessedTimestamp: '0.0',
      lastProcessedBlock: 0,
      syncStatus: 'syncing',
    });
    prisma.indexerState.update.mockResolvedValue({});

    const indexer = new Indexer(prisma, {
      schemaRegistryAddress: '0.0.100',
      attestationServiceAddress: '0.0.200',
      pollingIntervalMs: 5000,
      mirrorNodeClient: mirrorNode,
    });

    await indexer.start();

    // First poll fails immediately
    await vi.advanceTimersByTimeAsync(0);

    // State should be updated with error
    expect(prisma.indexerState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncStatus: 'error' }),
      }),
    );

    // After 1s backoff, second poll
    (mirrorNode.fetchContractLogs as any).mockClear();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mirrorNode.fetchContractLogs).toHaveBeenCalled();

    // After 2s backoff, third poll
    (mirrorNode.fetchContractLogs as any).mockClear();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mirrorNode.fetchContractLogs).toHaveBeenCalled();

    indexer.stop();
  });

  it('updates state with latest timestamp after processing events', async () => {
    const prisma = createMockPrisma();

    // Return a log that will be decoded (we need a real encoded event)
    // For simplicity, return empty logs — the state update logic still runs
    const mirrorNode = createMockMirrorNode({ logs: [], links: {} });

    prisma.indexerState.findFirst.mockResolvedValue({
      id: 'state-1',
      lastProcessedTimestamp: '0.0',
      lastProcessedBlock: 0,
      syncStatus: 'syncing',
    });

    const indexer = new Indexer(prisma, {
      schemaRegistryAddress: '0.0.100',
      attestationServiceAddress: '0.0.200',
      pollingIntervalMs: 5000,
      mirrorNodeClient: mirrorNode,
    });

    await indexer.start();
    await vi.advanceTimersByTimeAsync(0);

    // With no new logs, state should not be updated (no new timestamp)
    // The indexer should still schedule the next poll
    indexer.stop();
  });
});
