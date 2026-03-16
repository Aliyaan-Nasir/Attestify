/**
 * Unit tests for API endpoints with mocked Prisma client.
 */

import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApiRouter } from '../src/api.js';

function createMockPrisma() {
  return {
    schema: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    attestation: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    authority: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    indexerState: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  } as any;
}

function createApp(prisma: any) {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(prisma));
  return app;
}

describe('GET /api/schemas', () => {
  it('returns paginated schemas with default limit/offset', async () => {
    const prisma = createMockPrisma();
    const schemas = [{ id: '1', uid: '0xabc', definition: 'test', authorityAddress: '0x1' }];
    prisma.schema.findMany.mockResolvedValue(schemas);
    prisma.schema.count.mockResolvedValue(1);

    const app = createApp(prisma);
    const res = await request(app).get('/api/schemas');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({ total: 1, limit: 50, offset: 0, hasMore: false });
  });

  it('respects custom limit and offset', async () => {
    const prisma = createMockPrisma();
    prisma.schema.findMany.mockResolvedValue([]);
    prisma.schema.count.mockResolvedValue(100);

    const app = createApp(prisma);
    const res = await request(app).get('/api/schemas?limit=10&offset=20');

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.offset).toBe(20);
    expect(res.body.pagination.hasMore).toBe(true);
  });

  it('caps limit at 200', async () => {
    const prisma = createMockPrisma();
    prisma.schema.findMany.mockResolvedValue([]);
    prisma.schema.count.mockResolvedValue(0);

    const app = createApp(prisma);
    const res = await request(app).get('/api/schemas?limit=500');

    expect(res.body.pagination.limit).toBe(200);
  });

  it('filters by authority', async () => {
    const prisma = createMockPrisma();
    prisma.schema.findMany.mockResolvedValue([]);
    prisma.schema.count.mockResolvedValue(0);

    const app = createApp(prisma);
    await request(app).get('/api/schemas?authority=0xABC');

    expect(prisma.schema.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorityAddress: '0xABC' },
      }),
    );
  });
});

describe('GET /api/schemas/:uid', () => {
  it('returns 404 for non-existent schema', async () => {
    const prisma = createMockPrisma();
    const app = createApp(prisma);
    const res = await request(app).get('/api/schemas/0xnonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Schema not found');
  });

  it('returns schema by UID', async () => {
    const prisma = createMockPrisma();
    const schema = { id: '1', uid: '0xabc', definition: 'test' };
    prisma.schema.findUnique.mockResolvedValue(schema);

    const app = createApp(prisma);
    const res = await request(app).get('/api/schemas/0xabc');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uid).toBe('0xabc');
  });
});

describe('GET /api/attestations', () => {
  it('returns paginated attestations', async () => {
    const prisma = createMockPrisma();
    prisma.attestation.findMany.mockResolvedValue([]);
    prisma.attestation.count.mockResolvedValue(0);

    const app = createApp(prisma);
    const res = await request(app).get('/api/attestations');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('filters by schemaUid, subject, attester', async () => {
    const prisma = createMockPrisma();
    prisma.attestation.findMany.mockResolvedValue([]);
    prisma.attestation.count.mockResolvedValue(0);

    const app = createApp(prisma);
    await request(app).get('/api/attestations?schemaUid=0x1&subject=0x2&attester=0x3');

    expect(prisma.attestation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schemaUid: '0x1', subjectAddress: '0x2', attesterAddress: '0x3' },
      }),
    );
  });

  it('filters by revoked status', async () => {
    const prisma = createMockPrisma();
    prisma.attestation.findMany.mockResolvedValue([]);
    prisma.attestation.count.mockResolvedValue(0);

    const app = createApp(prisma);
    await request(app).get('/api/attestations?revoked=true');

    expect(prisma.attestation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { revoked: true },
      }),
    );
  });
});

describe('GET /api/attestations/:uid', () => {
  it('returns 404 for non-existent attestation', async () => {
    const prisma = createMockPrisma();
    const app = createApp(prisma);
    const res = await request(app).get('/api/attestations/0xnonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/authorities', () => {
  it('returns paginated authorities', async () => {
    const prisma = createMockPrisma();
    prisma.authority.findMany.mockResolvedValue([]);
    prisma.authority.count.mockResolvedValue(0);

    const app = createApp(prisma);
    const res = await request(app).get('/api/authorities');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });
});

describe('GET /api/authorities/:address', () => {
  it('returns 404 for non-existent authority', async () => {
    const prisma = createMockPrisma();
    const app = createApp(prisma);
    const res = await request(app).get('/api/authorities/0xnonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns authority by address', async () => {
    const prisma = createMockPrisma();
    const authority = { id: '1', address: '0xABC', metadata: 'test', isVerified: false };
    prisma.authority.findUnique.mockResolvedValue(authority);

    const app = createApp(prisma);
    const res = await request(app).get('/api/authorities/0xABC');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.address).toBe('0xABC');
  });
});

describe('GET /api/indexer-status', () => {
  it('returns not_started when no state exists', async () => {
    const prisma = createMockPrisma();
    const app = createApp(prisma);
    const res = await request(app).get('/api/indexer-status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.syncStatus).toBe('not_started');
  });

  it('returns current indexer state', async () => {
    const prisma = createMockPrisma();
    prisma.indexerState.findFirst.mockResolvedValue({
      id: '1',
      lastProcessedTimestamp: '1700000000.000000000',
      lastProcessedBlock: 500,
      syncStatus: 'synced',
    });

    const app = createApp(prisma);
    const res = await request(app).get('/api/indexer-status');

    expect(res.status).toBe(200);
    expect(res.body.data.syncStatus).toBe('synced');
    expect(res.body.data.lastProcessedBlock).toBe(500);
  });
});
