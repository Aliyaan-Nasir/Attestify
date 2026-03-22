/**
 * Express REST API with all endpoints for schemas, attestations, and authorities.
 * Follows the reference project's response shape: { success, data, pagination }.
 */

import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import type { PrismaClient } from '@prisma/client';

const SCHEMA_REGISTRY_ABI = [
  'function getSchema(bytes32 uid) external view returns (tuple(bytes32 uid, string definition, address authority, address resolver, bool revocable, uint64 timestamp))',
];
const ATTESTATION_SERVICE_ABI_READ = [
  'function getAuthority(address addr) external view returns (tuple(address addr, string metadata, bool isVerified, uint64 registeredAt))',
  'function getAttestation(bytes32 uid) external view returns (tuple(bytes32 uid, bytes32 schemaUid, address attester, address subject, bytes data, uint64 timestamp, uint64 expirationTime, bool revoked, uint64 revocationTime, uint256 nonce))',
];
const HEDERA_RPC_URL = 'https://testnet.hashio.io/api';

export function createApiRouter(prisma: PrismaClient): Router {
  const router = Router();

  // ─── Schemas ───────────────────────────────────────────────

  router.get('/schemas', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const where: Record<string, unknown> = {};
      if (req.query.authority) where.authorityAddress = { equals: req.query.authority as string, mode: 'insensitive' };

      const [data, total] = await Promise.all([
        prisma.schema.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.schema.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      });
    } catch (error: any) {
      console.error('Error fetching schemas:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch schemas' });
    }
  });

  router.get('/schemas/:uid', async (req: Request, res: Response) => {
    try {
      const schema = await prisma.schema.findUnique({ where: { uid: req.params.uid } });
      if (!schema) {
        return res.status(404).json({ success: false, error: 'Schema not found' });
      }

      // Backfill definition from contract if empty
      if (!schema.definition) {
        try {
          const schemaRegistryAddress = process.env.SCHEMA_REGISTRY_ADDRESS;
          if (schemaRegistryAddress) {
            const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
            const registry = new ethers.Contract(schemaRegistryAddress, SCHEMA_REGISTRY_ABI, provider);
            const record = await registry.getSchema(schema.uid);
            const definition = record.definition || record[1] || '';
            if (definition) {
              await prisma.schema.update({ where: { uid: schema.uid }, data: { definition } });
              schema.definition = definition;
            }
          }
        } catch (err) {
          console.warn('Failed to backfill schema definition:', err);
        }
      }

      res.json({ success: true, data: schema });
    } catch (error: any) {
      console.error('Error fetching schema:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch schema' });
    }
  });

  // ─── Attestations ─────────────────────────────────────────

  router.get('/attestations', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const where: Record<string, unknown> = {};
      if (req.query.schemaUid) where.schemaUid = req.query.schemaUid as string;
      if (req.query.subject) where.subjectAddress = { equals: req.query.subject as string, mode: 'insensitive' };
      if (req.query.attester) where.attesterAddress = { equals: req.query.attester as string, mode: 'insensitive' };
      if (req.query.revoked !== undefined) where.revoked = String(req.query.revoked) === 'true';

      const [data, total] = await Promise.all([
        prisma.attestation.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.attestation.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      });
    } catch (error: any) {
      console.error('Error fetching attestations:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch attestations' });
    }
  });

  router.get('/attestations/:uid', async (req: Request, res: Response) => {
    try {
      const attestation = await prisma.attestation.findUnique({ where: { uid: req.params.uid } });
      if (!attestation) {
        return res.status(404).json({ success: false, error: 'Attestation not found' });
      }

      // Backfill data from contract if empty
      if (!attestation.data) {
        try {
          const attestationServiceAddress = process.env.ATTESTATION_SERVICE_ADDRESS;
          if (attestationServiceAddress) {
            const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
            const service = new ethers.Contract(attestationServiceAddress, ATTESTATION_SERVICE_ABI_READ, provider);
            const record = await service.getAttestation(attestation.uid);
            const data = record.data || record[4] || '';
            const nonce = Number(record.nonce || record[9] || 0);
            const expTime = Number(record.expirationTime || record[6] || 0);
            const updates: Record<string, unknown> = { data, nonce };
            if (expTime > 0) updates.expirationTime = new Date(expTime * 1000);
            if (data) {
              await prisma.attestation.update({ where: { uid: attestation.uid }, data: updates });
              attestation.data = data;
              attestation.nonce = nonce;
              if (expTime > 0) attestation.expirationTime = new Date(expTime * 1000);
            }
          }
        } catch (err) {
          console.warn('Failed to backfill attestation data:', err);
        }
      }

      res.json({ success: true, data: attestation });
    } catch (error: any) {
      console.error('Error fetching attestation:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch attestation' });
    }
  });

  // ─── Authorities ──────────────────────────────────────────

  router.get('/authorities', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const [data, total] = await Promise.all([
        prisma.authority.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.authority.count(),
      ]);

      res.json({
        success: true,
        data,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      });
    } catch (error: any) {
      console.error('Error fetching authorities:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch authorities' });
    }
  });

  router.get('/authorities/:address', async (req: Request, res: Response) => {
    try {
      const authority = await prisma.authority.findFirst({ where: { address: { equals: req.params.address, mode: 'insensitive' } } });
      if (!authority) {
        return res.status(404).json({ success: false, error: 'Authority not found' });
      }

      // Always sync metadata and isVerified from contract
      try {
        const attestationServiceAddress = process.env.ATTESTATION_SERVICE_ADDRESS;
        if (attestationServiceAddress) {
          const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
          const service = new ethers.Contract(attestationServiceAddress, ATTESTATION_SERVICE_ABI_READ, provider);
          const record = await service.getAuthority(authority.address);
          const metadata = record.metadata || record[1] || null;
          const isVerified = record.isVerified ?? record[2] ?? false;
          const updates: Record<string, unknown> = { isVerified };
          if (metadata && !authority.metadata) updates.metadata = metadata;
          await prisma.authority.update({ where: { address: authority.address }, data: updates });
          authority.isVerified = isVerified;
          if (metadata && !authority.metadata) authority.metadata = metadata;
        }
      } catch (err) {
        console.warn('Failed to sync authority from contract:', err);
      }

      res.json({ success: true, data: authority });
    } catch (error: any) {
      console.error('Error fetching authority:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch authority' });
    }
  });

  // ─── Indexer Status ─────────────────────────────────────────

  router.get('/indexer-status', async (_req: Request, res: Response) => {
    try {
      const state = await prisma.indexerState.findFirst();
      if (!state) {
        return res.json({ success: true, data: { syncStatus: 'not_started', lastProcessedBlock: 0 } });
      }
      res.json({ success: true, data: state });
    } catch (error: any) {
      console.error('Error fetching indexer status:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch indexer status' });
    }
  });

  // ─── HCS Audit Log ────────────────────────────────────────

  const HCS_TOPICS = {
    schemas: process.env.HCS_TOPIC_SCHEMAS,
    attestations: process.env.HCS_TOPIC_ATTESTATIONS,
    authorities: process.env.HCS_TOPIC_AUTHORITIES,
  };

  router.get('/hcs/topics', (_req: Request, res: Response) => {
    const topics = Object.entries(HCS_TOPICS)
      .filter(([, id]) => id)
      .map(([name, topicId]) => ({
        name,
        topicId,
        hashscanUrl: `https://hashscan.io/testnet/topic/${topicId}`,
      }));

    res.json({ success: true, data: { enabled: topics.length > 0, topics } });
  });

  router.get('/hcs/messages/:topicId', async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
      const order = req.query.order === 'asc' ? 'asc' : 'desc';

      const mirrorUrl = process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com';
      const url = `${mirrorUrl}/api/v1/topics/${topicId}/messages?limit=${limit}&order=${order}`;

      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: `Mirror node returned ${response.status}`,
        });
      }

      const raw = await response.json() as { messages?: Array<{ consensus_timestamp: string; sequence_number: number; message: string; payer_account_id: string }> };
      const messages = (raw.messages || []).map((msg) => {
        let decoded: unknown = null;
        try {
          const buf = Buffer.from(msg.message, 'base64');
          decoded = JSON.parse(buf.toString('utf-8'));
        } catch {
          decoded = msg.message; // raw base64 if not JSON
        }

        return {
          sequenceNumber: msg.sequence_number,
          consensusTimestamp: msg.consensus_timestamp,
          payer: msg.payer_account_id,
          content: decoded,
        };
      });

      res.json({
        success: true,
        data: {
          topicId,
          hashscanUrl: `https://hashscan.io/testnet/topic/${topicId}`,
          messageCount: messages.length,
          messages,
        },
      });
    } catch (error: any) {
      console.error('Error fetching HCS messages:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch HCS messages' });
    }
  });

  return router;
}
