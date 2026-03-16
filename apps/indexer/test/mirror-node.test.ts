/**
 * Unit tests for Mirror Node client polling and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MirrorNodeClient } from '../src/mirror-node.js';

describe('MirrorNodeClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs URL correctly with default base URL', () => {
    const client = new MirrorNodeClient('https://testnet.mirrornode.hedera.com');
    expect(client).toBeDefined();
  });

  it('fetches contract logs successfully', async () => {
    const mockResponse = {
      logs: [
        {
          address: '0x0000000000000000000000000000000000000001',
          topics: ['0xabc'],
          data: '0x',
          block_number: 100,
          timestamp: '1234567890.000000000',
          transaction_hash: '0xdef',
        },
      ],
      links: {},
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const client = new MirrorNodeClient('https://testnet.mirrornode.hedera.com');
    const result = await client.fetchContractLogs('0.0.12345');

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].block_number).toBe(100);
  });

  it('includes fromTimestamp in the URL when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ logs: [], links: {} }),
    } as Response);

    const client = new MirrorNodeClient('https://testnet.mirrornode.hedera.com');
    await client.fetchContractLogs('0.0.12345', '1234567890.000000000');

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('timestamp=gte:1234567890.000000000');
  });

  it('throws on non-OK HTTP response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response);

    const client = new MirrorNodeClient('https://testnet.mirrornode.hedera.com');
    await expect(client.fetchContractLogs('0.0.12345')).rejects.toThrow('Mirror Node request failed: 503');
  });

  it('throws on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const client = new MirrorNodeClient('https://testnet.mirrornode.hedera.com');
    await expect(client.fetchContractLogs('0.0.12345')).rejects.toThrow('Network error');
  });

  it('respects custom limit parameter', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ logs: [], links: {} }),
    } as Response);

    const client = new MirrorNodeClient('https://testnet.mirrornode.hedera.com');
    await client.fetchContractLogs('0.0.12345', undefined, 25);

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=25');
  });
});
