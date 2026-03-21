# @attestify/indexer

Backend indexer that polls Hedera Mirror Node for contract events, publishes to HCS audit topics, and exposes a REST API for querying schemas, attestations, and authorities.

## Setup

```bash
# From hedera/ root
pnpm install
```

Copy `.env.example` to `.env` and configure:

```bash
cp apps/indexer/.env.example apps/indexer/.env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `HEDERA_MIRROR_NODE_URL` | Mirror Node REST API | `https://testnet.mirrornode.hedera.com` |
| `SCHEMA_REGISTRY_ADDRESS` | Deployed SchemaRegistry contract address | — |
| `ATTESTATION_SERVICE_ADDRESS` | Deployed AttestationService contract address | — |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `PORT` | HTTP server port | `3001` |
| `POLLING_INTERVAL_MS` | Mirror Node polling interval (ms) | `5000` |
| `HEDERA_ACCOUNT_ID` | Hedera operator account (for HCS publishing) | — |
| `HEDERA_PRIVATE_KEY` | ECDSA private key (for HCS publishing) | — |
| `HCS_TOPIC_SCHEMAS` | HCS topic ID for schema audit log | `0.0.8221945` |
| `HCS_TOPIC_ATTESTATIONS` | HCS topic ID for attestation audit log | `0.0.8221946` |
| `HCS_TOPIC_AUTHORITIES` | HCS topic ID for authority audit log | `0.0.8221947` |

### Database

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate:dev

# Browse data
pnpm prisma:studio
```

## Usage

```bash
# Development (with hot reload)
pnpm dev

# Production
pnpm build
pnpm start

# Run tests
pnpm test
```

## REST API

All list endpoints support `?limit=N&offset=M` pagination.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/schemas` | List schemas (filter: `?authority=`) |
| GET | `/api/schemas/:uid` | Get schema by UID (auto-backfills definition from contract) |
| GET | `/api/attestations` | List attestations (filter: `?schemaUid=`, `?subject=`, `?attester=`, `?revoked=`) |
| GET | `/api/attestations/:uid` | Get attestation by UID (auto-backfills data from contract) |
| GET | `/api/authorities` | List authorities |
| GET | `/api/authorities/:address` | Get authority by address (syncs metadata from contract) |
| GET | `/api/indexer-status` | Indexer sync status (last processed block) |
| GET | `/api/hcs/topics` | List configured HCS audit topics with HashScan links |
| GET | `/api/hcs/messages/:topicId` | Fetch HCS messages for a topic (query: `?limit=`, `?order=asc\|desc`) |

Response shape:

```json
{
  "success": true,
  "data": [],
  "pagination": { "total": 100, "limit": 50, "offset": 0, "hasMore": true }
}
```

## Production

Deployed on Railway: [attestify-production.up.railway.app](https://attestify-production.up.railway.app)

## Architecture

- Polls Mirror Node REST API (`/api/v1/contracts/{id}/results/logs`) for `SchemaRegistered`, `AttestationCreated`, and `AttestationRevoked` events
- Decodes events using ethers.js ABI decoder
- Stores data in PostgreSQL via Prisma ORM
- Tracks `lastProcessedBlock` for resumable indexing
- Exponential backoff on Mirror Node failures
- HCS Publisher with retry logic and per-schema topic creation
- Auto-backfills missing data from on-chain contracts on read
- Graceful shutdown on SIGTERM/SIGINT
- Crash recovery: exits on DB connection failure so Railway can restart

## GitHub

[github.com/Aliyaan-Nasir/Attestify](https://github.com/Aliyaan-Nasir/Attestify)

## License

MIT
