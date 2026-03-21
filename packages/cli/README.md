# @attestify/cli

Command-line tool for the Attestify protocol on Hedera — 40+ commands covering schemas, attestations, authorities, delegation, resolvers, HCS audit log, scheduled revocations, multi-sig, staking, file service, and AI-powered natural language mode.

[![npm](https://img.shields.io/npm/v/@attestify/cli)](https://www.npmjs.com/package/@attestify/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Installation

```bash
npm install -g @attestify/cli
# or
pnpm add -g @attestify/cli
```

## Configuration

Set credentials via environment variables or a `.env` file:

```bash
# Required
export HEDERA_ACCOUNT_ID="0.0.XXXXX"
export HEDERA_PRIVATE_KEY="your-ecdsa-private-key-hex"

# Optional
export INDEXER_URL="http://localhost:3001/api"
export HCS_TOPIC_SCHEMAS="0.0.8221945"
export HCS_TOPIC_ATTESTATIONS="0.0.8221946"
export HCS_TOPIC_AUTHORITIES="0.0.8221947"
```

All commands target Hedera testnet. Append `--json` to any command for machine-readable JSON output.

---

## Schema Commands

```bash
# Register a schema (inline)
attestify schema create \
  --definition "string name, uint256 age, bool verified" \
  --revocable \
  --resolver 0x461349A8aEfB220A48b61923095DfF237465c27A

# Register from JSON file
attestify schema create --file schema.json

# Fetch a schema by UID
attestify schema fetch --uid 0x7408a93fa658b219...

# List all schemas
attestify schema list

# Filter by authority
attestify schema list --authority 0x9Bf9a686... --limit 10
```

---

## Attestation Commands

```bash
# Create an attestation
attestify attestation create \
  --schema-uid 0x7408a93f... \
  --subject 0x0F1A0cb4... \
  --data 0x00000000... \
  --expiration 1735689600

# Create from file
attestify attestation create --file attestation.json

# Fetch an attestation
attestify attestation fetch --uid 0xbc72d396...

# List by attester
attestify attestation list --attester 0x9Bf9a686...

# List by subject
attestify attestation list --subject 0x0F1A0cb4...

# List by schema + limit
attestify attestation list --schema-uid 0x7408a93f... --limit 10

# Revoke an attestation
attestify attestation revoke --uid 0xbc72d396...
```

---

## Authority Commands

```bash
# Register as an authority
attestify authority register --metadata "Acme KYC Services"

# Fetch authority info
attestify authority fetch --address 0x9Bf9a686...

# Verify an authority (admin only)
attestify authority verify --address 0x9Bf9a686...

# Unverify an authority
attestify authority verify --address 0x9Bf9a686... --revoke
```

---

## Profile

```bash
attestify profile --address 0x9Bf9a686...

# JSON output
attestify --json profile --address 0x9Bf9a686...
```

---

## Delegation Commands

```bash
# Add a delegate
attestify delegate add --address 0xDelegateAddress...

# Remove a delegate
attestify delegate remove --address 0xDelegateAddress...

# Check delegation status
attestify delegate check --authority 0xAuthority... --delegate 0xDelegate...

# List all delegates for an authority
attestify delegate list --authority 0xAuthority...

# Attest on behalf of an authority
attestify delegate attest \
  --authority 0xAuthorityAddress... \
  --schema-uid 0x7408a93f... \
  --subject 0x0F1A0cb4... \
  --data 0x...

# Revoke on behalf
attestify delegate revoke --uid 0xbc72d396...
```

---

## Resolver Commands

### Whitelist Resolver

```bash
attestify whitelist add --account 0x0F1A0cb4...
attestify whitelist remove --account 0x0F1A0cb4...
attestify whitelist check --account 0x0F1A0cb4...
attestify whitelist owner
```

### Fee Resolver

```bash
attestify fee deposit --amount 10
attestify fee set-fee --amount 1000000000
attestify fee withdraw
attestify fee get-fee
attestify fee balance --account 0x9Bf9a686...
attestify fee owner
```

### Token-Gated Resolver

```bash
attestify token-gated set-config \
  --token 0xTokenAddress... \
  --min-balance 1
attestify token-gated get-config
attestify token-gated owner
```

---

## Token Reward Commands

```bash
attestify token-reward set-config \
  --resolver 0xResolverAddress... \
  --token 0xTokenAddress... \
  --amount 100

attestify token-reward get-config --resolver 0xResolverAddress...

attestify token-reward distributed \
  --resolver 0xResolverAddress... \
  --subject 0xSubjectAddress...
```

---

## Cross-Contract Resolver Commands

```bash
attestify cross-contract set-pipeline \
  --resolver 0xResolverAddress... \
  --resolvers 0xWhitelist...,0xFee...,0xTokenGated...

attestify cross-contract get-pipeline --resolver 0xResolverAddress...
```

---

## NFT Minting

```bash
attestify nft-mint \
  --subject 0x0F1A0cb4... \
  --attestation-uid 0xbc72d396... \
  --token-id 0.0.12345
```

---

## HCS Audit Trail

```bash
# List HCS topic IDs
attestify hcs topics

# Latest 25 messages from a topic
attestify hcs messages --topic 0.0.8221946

# Oldest first, limit 10
attestify hcs messages --topic 0.0.8221946 --limit 10 --order asc

# Per-schema topic
attestify hcs messages --topic 0.0.8225001 --limit 50
```

---

## Hedera Native Features

### Scheduled Revocation

```bash
attestify schedule revoke \
  --uid 0xbc72d396... \
  --execute-at 1735689600

attestify schedule status --schedule-id 0.0.12345
```

### Multi-Sig Authority

```bash
attestify multisig create \
  --keys 302a300506...,302a300506...,302a300506... \
  --threshold 2 \
  --initial-balance 10

attestify multisig info --account 0.0.12345
```

### Token Staking

```bash
attestify staking stake --token 0xTokenAddr... --amount 1000
attestify staking unstake --token 0xTokenAddr... --amount 500
attestify staking balance --token 0xTokenAddr... --authority 0.0.12345
```

### File Service Schema

```bash
# Upload a schema definition to Hedera File Service
attestify file-schema upload \
  --definition "string name, uint256 age, bool verified" \
  --memo "KYC schema v2"

# Read a schema from File Service
attestify file-schema read --file-id 0.0.12345

# Register a schema from a File Service file
attestify file-schema register \
  --file-id 0.0.12345 \
  --revocable \
  --resolver 0x461349...
```

---

## AI Mode (`attestify ai`)

Natural language interface to the protocol — same 17 tools as `@attestify/sdk/ai`, powered by OpenAI.

Requires `OPENAI_API_KEY` environment variable.

### One-Shot Mode

```bash
attestify ai "List all schemas"
attestify ai "Register a schema with fields: string name, uint256 age, bool verified"
attestify ai "Create an attestation for 0x0F1A... using schema 0x7408..."
```

### Interactive REPL Mode

```bash
# Omit the message argument to enter interactive mode
attestify ai

# [Attestify AI] Agent initialized with 17 tools
# Interactive mode — type your message and press Enter. Type "exit" to quit.
#
# You: What schemas are registered?
# Agent: Found 3 schema(s):
#   0x7408a93f... — string name, uint256 age, bool verified
#   0xbc72d396... — string documentType, address issuer
#   ...
#
# You: exit
# Goodbye!
```

### AI Options

```bash
# Use a different model
attestify ai --model gpt-4o "Explain the attestation with UID 0xbc72d396..."

# JSON output (one-shot only)
attestify --json ai "List all authorities"
```

---

## JSON Output

Use `--json` for machine-readable output on any command:

```bash
attestify schema fetch --uid 0xabc123... --json
```

Success responses return the data object. Error responses include `type` and `message` fields.

## Published on npm

[@attestify/cli](https://www.npmjs.com/package/@attestify/cli)

## GitHub

[github.com/Aliyaan-Nasir/Attestify](https://github.com/Aliyaan-Nasir/Attestify)

## License

MIT
