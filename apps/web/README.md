# @attestify/web

Next.js frontend for Attestify — marketing site, protocol explorer, interactive sandbox with 25 wallet-connected tools, AI agent chat, and user profile dashboard.

## Setup

```bash
# From hedera/ root
pnpm install
```

Copy `.env.example` to `.env`:

```bash
cp apps/web/.env.example apps/web/.env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_INDEXER_URL` | Indexer REST API URL | `http://localhost:3001/api` |
| `NEXT_PUBLIC_AGENT_URL` | AI Agent REST API URL | `http://localhost:3002` |

## Usage

```bash
# Development server (http://localhost:3000)
pnpm --filter @attestify/web dev

# Production build
pnpm --filter @attestify/web build
pnpm --filter @attestify/web start

# Run tests
pnpm --filter @attestify/web test
```

## Pages

### Marketing Site

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, feature highlights, code examples, CTAs |
| `/products/schema` | Schema product page with interactive code examples |
| `/products/attestation` | Attestation product page with JSON examples |
| `/about` | Mission, protocol stats, roadmap |
| `/sandbox` | Sandbox overview with feature descriptions |
| `/docs` | Full SDK and CLI reference with interactive code examples |

### Protocol Explorer

| Route | Description |
|-------|-------------|
| `/schemas` | Paginated schema list with search and filter |
| `/schemas/[uid]` | Schema detail with definition, linked attestations, HCS audit trail |
| `/attestations` | Paginated attestation list with search and filter |
| `/attestations/[uid]` | Attestation detail with decoded data, status badge, HCS audit trail |
| `/authorities` | Authority list with verification badges |
| `/authorities/[address]` | Authority detail with schemas and attestations |
| `/audit-log` | Global HCS audit trail with topic messages |

### Profile (wallet-gated)

| Route | Description |
|-------|-------------|
| `/profile` | Dashboard showing authority status, schemas, attestations, HCS topic links |

### Sandbox (25 tools, requires MetaMask)

| Category | Tools |
|----------|-------|
| Core Workflows (5) | Schema Builder, Create Attestation, Revoke, Register Authority, Verify Authority |
| Delegation (2) | Delegated Attestation, Delegated Revocation |
| Resolver Tools (5) | Whitelist Manager, Fee Resolver, Token Gated, Token Reward, Cross-Contract |
| Data Tools (4) | Schema Encoder, Wallet Attestations, Wallet Schemas, Schema Attestations |
| Retrieval (2) | Lookup Attestation, Universal Search |
| Hedera Native (6) | Verify HCS Proof, NFT Credential, Scheduled Revocation, Multi-Sig Authority, Token Staking, File Service Schema |
| AI (1) | Agent Chat — natural language interface to the protocol |

## Wallet

MetaMask is the sole wallet provider. The app connects to Hedera testnet (chain ID `296`) and prompts network switching if needed. Transaction forms are disabled when no wallet is connected.

## Production

Deployed on Vercel: [attestify-web.vercel.app](https://attestify-web.vercel.app/)

## Tech Stack

- Next.js 15 (App Router)
- React 19
- Tailwind CSS
- ethers.js (MetaMask + contract interaction)
- Lucide React (icons)

## GitHub

[github.com/Aliyaan-Nasir/Attestify](https://github.com/Aliyaan-Nasir/Attestify)

## License

MIT
