/**
 * Attestify Indexer
 * Hedera Mirror Node event indexer and REST API
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

import { connectToPostgreSQL, getPrismaClient, disconnectPostgreSQL } from './prisma.js';
import { createApiRouter } from './api.js';
import { MirrorNodeClient } from './mirror-node.js';
import { Indexer } from './indexer.js';
import { HCSPublisher } from './hcs-publisher.js';

const app: ReturnType<typeof express> = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'attestify-indexer' });
});

// 404 handler for unmatched routes
function notFound(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Global error handler
function errorHandler(err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
}

async function bootstrap(): Promise<void> {
  const connected = await connectToPostgreSQL();
  const prisma = getPrismaClient();

  if (connected && prisma) {
    // Mount API routes
    app.use('/api', createApiRouter(prisma));

    // Start indexer polling loop
    const schemaRegistryAddress = process.env.SCHEMA_REGISTRY_ADDRESS;
    const attestationServiceAddress = process.env.ATTESTATION_SERVICE_ADDRESS;

    if (schemaRegistryAddress && attestationServiceAddress) {
      const mirrorNodeClient = new MirrorNodeClient();

      // Initialize HCS publisher (optional — only if topic IDs are configured)
      const hcsTopicSchemas = process.env.HCS_TOPIC_SCHEMAS;
      const hcsTopicAttestations = process.env.HCS_TOPIC_ATTESTATIONS;
      const hcsTopicAuthorities = process.env.HCS_TOPIC_AUTHORITIES;
      const hcsAccountId = process.env.HEDERA_ACCOUNT_ID;
      const hcsPrivateKey = process.env.HEDERA_PRIVATE_KEY;

      let hcsPublisher: HCSPublisher | undefined;
      if (hcsTopicSchemas && hcsTopicAttestations && hcsTopicAuthorities) {
        hcsPublisher = new HCSPublisher(
          { schemas: hcsTopicSchemas, attestations: hcsTopicAttestations, authorities: hcsTopicAuthorities },
          hcsAccountId,
          hcsPrivateKey,
        );
      }

      const indexer = new Indexer(prisma, {
        schemaRegistryAddress,
        attestationServiceAddress,
        pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '5000', 10),
        mirrorNodeClient,
        hcsPublisher,
      });

      await indexer.start();

      // Graceful shutdown
      const shutdown = async () => {
        console.log('Shutting down...');
        indexer.stop();
        await disconnectPostgreSQL();
        process.exit(0);
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    } else {
      console.warn('Contract addresses not configured. Indexer polling disabled.');
    }
  } else {
    console.warn('Database not connected. API routes not mounted.');
  }

  // Mount error handling middleware after all routes
  app.use(notFound);
  app.use(errorHandler as express.ErrorRequestHandler);

  app.listen(PORT, () => {
    console.log(`Attestify Indexer running on port ${PORT}`);
  });
}

// Catch unhandled errors so the process doesn't silently die
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Don't exit — let pm2 or the process manager decide
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

bootstrap().catch(console.error);

export default app;
