import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { indexerApi } from '@/lib/api';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as Response);
}

function failedResponse(status: number, statusText: string) {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({ error: statusText }),
  } as Response);
}

const sampleSchema = {
  uid: '0xabc123',
  definition: 'string name, uint256 age',
  authorityAddress: '0x1111111111111111111111111111111111111111',
  resolverAddress: null,
  revocable: true,
  transactionHash: '0xtx1',
  blockNumber: 100,
  consensusTimestamp: '1700000000.000000000',
  createdAt: '2024-01-01T00:00:00Z',
};

const sampleAttestation = {
  uid: '0xdef456',
  schemaUid: '0xabc123',
  attesterAddress: '0x2222222222222222222222222222222222222222',
  subjectAddress: '0x3333333333333333333333333333333333333333',
  data: '0xdata',
  nonce: 0,
  transactionHash: '0xtx2',
  blockNumber: 101,
  consensusTimestamp: '1700000001.000000000',
  expirationTime: null,
  revoked: false,
  revocationTime: null,
  revocationTxHash: null,
  createdAt: '2024-01-02T00:00:00Z',
};

const sampleAuthority = {
  address: '0x4444444444444444444444444444444444444444',
  metadata: 'Test Authority',
  isVerified: true,
  transactionHash: '0xtx3',
  blockNumber: 102,
  consensusTimestamp: '1700000002.000000000',
  createdAt: '2024-01-03T00:00:00Z',
};

describe('Frontend ↔ Indexer API Integration', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Schema endpoints ---

  describe('getSchemas', () => {
    it('returns paginated schema list with correct shape', async () => {
      const body = {
        success: true,
        data: [sampleSchema],
        pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
      };
      mockFetch.mockReturnValueOnce(jsonResponse(body));

      const result = await indexerApi.getSchemas();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        uid: sampleSchema.uid,
        definition: sampleSchema.definition,
        authorityAddress: sampleSchema.authorityAddress,
        revocable: true,
      });
      expect(result.pagination).toBeDefined();
      expect(result.pagination!.total).toBe(1);
    });

    it('passes pagination parameters', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 5, offset: 10, hasMore: false } }),
      );

      await indexerApi.getSchemas({ limit: 5, offset: 10 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=5');
      expect(calledUrl).toContain('offset=10');
    });

    it('passes authority filter parameter', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getSchemas({ authority: '0x1111' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('authority=0x1111');
    });

    it('passes search parameter', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getSchemas({ search: 'name' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('search=name');
    });
  });

  describe('getSchema', () => {
    it('returns single schema by UID', async () => {
      const body = { success: true, data: sampleSchema };
      mockFetch.mockReturnValueOnce(jsonResponse(body));

      const result = await indexerApi.getSchema('0xabc123');

      expect(result.success).toBe(true);
      expect(result.data.uid).toBe('0xabc123');
      expect(result.data.definition).toBe('string name, uint256 age');
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/schemas/0xabc123');
    });

    it('throws on 404 for unknown schema', async () => {
      mockFetch.mockReturnValueOnce(failedResponse(404, 'Not Found'));

      await expect(indexerApi.getSchema('0xnonexistent')).rejects.toThrow('API error: 404 Not Found');
    });
  });

  // --- Attestation endpoints ---

  describe('getAttestations', () => {
    it('returns paginated attestation list with correct shape', async () => {
      const body = {
        success: true,
        data: [sampleAttestation],
        pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
      };
      mockFetch.mockReturnValueOnce(jsonResponse(body));

      const result = await indexerApi.getAttestations();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        uid: sampleAttestation.uid,
        schemaUid: sampleAttestation.schemaUid,
        attesterAddress: sampleAttestation.attesterAddress,
        subjectAddress: sampleAttestation.subjectAddress,
        revoked: false,
      });
    });

    it('passes schemaUid filter', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getAttestations({ schemaUid: '0xabc123' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('schemaUid=0xabc123');
    });

    it('passes subject filter', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getAttestations({ subject: '0x3333' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('subject=0x3333');
    });

    it('passes attester filter', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getAttestations({ attester: '0x2222' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('attester=0x2222');
    });

    it('passes multiple filters and pagination together', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 5, offset: 20, hasMore: false } }),
      );

      await indexerApi.getAttestations({
        schemaUid: '0xabc',
        attester: '0x2222',
        limit: 5,
        offset: 20,
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('schemaUid=0xabc');
      expect(calledUrl).toContain('attester=0x2222');
      expect(calledUrl).toContain('limit=5');
      expect(calledUrl).toContain('offset=20');
    });

    it('passes revoked filter as string', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getAttestations({ revoked: true });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('revoked=true');
    });
  });

  describe('getAttestation', () => {
    it('returns single attestation by UID', async () => {
      const body = { success: true, data: sampleAttestation };
      mockFetch.mockReturnValueOnce(jsonResponse(body));

      const result = await indexerApi.getAttestation('0xdef456');

      expect(result.success).toBe(true);
      expect(result.data.uid).toBe('0xdef456');
      expect(result.data.schemaUid).toBe('0xabc123');
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/attestations/0xdef456');
    });

    it('throws on 404 for unknown attestation', async () => {
      mockFetch.mockReturnValueOnce(failedResponse(404, 'Not Found'));

      await expect(indexerApi.getAttestation('0xbad')).rejects.toThrow('API error: 404 Not Found');
    });
  });

  // --- Authority endpoints ---

  describe('getAuthorities', () => {
    it('returns paginated authority list', async () => {
      const body = {
        success: true,
        data: [sampleAuthority],
        pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
      };
      mockFetch.mockReturnValueOnce(jsonResponse(body));

      const result = await indexerApi.getAuthorities();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        address: sampleAuthority.address,
        metadata: 'Test Authority',
        isVerified: true,
      });
    });

    it('passes pagination parameters', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 3, offset: 6, hasMore: false } }),
      );

      await indexerApi.getAuthorities({ limit: 3, offset: 6 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=3');
      expect(calledUrl).toContain('offset=6');
    });
  });

  describe('getAuthority', () => {
    it('returns single authority by address', async () => {
      const body = { success: true, data: sampleAuthority };
      mockFetch.mockReturnValueOnce(jsonResponse(body));

      const result = await indexerApi.getAuthority('0x4444444444444444444444444444444444444444');

      expect(result.success).toBe(true);
      expect(result.data.address).toBe('0x4444444444444444444444444444444444444444');
      expect(result.data.isVerified).toBe(true);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/authorities/0x4444444444444444444444444444444444444444');
    });

    it('throws on 404 for unknown authority', async () => {
      mockFetch.mockReturnValueOnce(failedResponse(404, 'Not Found'));

      await expect(indexerApi.getAuthority('0xunknown')).rejects.toThrow('API error: 404 Not Found');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('throws on 500 server error', async () => {
      mockFetch.mockReturnValueOnce(failedResponse(500, 'Internal Server Error'));

      await expect(indexerApi.getSchemas()).rejects.toThrow('API error: 500 Internal Server Error');
    });

    it('throws on network error', async () => {
      mockFetch.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));

      await expect(indexerApi.getAttestations()).rejects.toThrow('Failed to fetch');
    });

    it('throws on 503 service unavailable', async () => {
      mockFetch.mockReturnValueOnce(failedResponse(503, 'Service Unavailable'));

      await expect(indexerApi.getAuthorities()).rejects.toThrow('API error: 503 Service Unavailable');
    });
  });

  // --- URL construction ---

  describe('URL construction', () => {
    it('omits undefined optional parameters from URL', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getAttestations({ schemaUid: '0xabc' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('schemaUid=0xabc');
      expect(calledUrl).not.toContain('subject=');
      expect(calledUrl).not.toContain('attester=');
      expect(calledUrl).not.toContain('limit=');
      expect(calledUrl).not.toContain('offset=');
    });

    it('constructs correct base URL for schemas endpoint', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getSchemas();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/schemas');
    });

    it('constructs correct base URL for attestations endpoint', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getAttestations();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/attestations');
    });

    it('constructs correct base URL for authorities endpoint', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, data: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }),
      );

      await indexerApi.getAuthorities();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/authorities');
    });
  });
});
