# @attestify/sdk

TypeScript SDK for the Attestify protocol on Hedera — register schemas, create and verify on-chain attestations, manage authorities, delegate trust, interact with resolvers, mint NFT credentials, and build AI agents.

[![npm](https://img.shields.io/npm/v/@attestify/sdk)](https://www.npmjs.com/package/@attestify/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Installation

```bash
npm install @attestify/sdk
# or
pnpm add @attestify/sdk
```

## Quick Start

```typescript
import { HederaAttestService, SchemaEncoder } from '@attestify/sdk';

const service = new HederaAttestService({
  network: 'testnet',
  operatorAccountId: '0.0.XXXXX',
  operatorPrivateKey: 'your-ecdsa-key-hex',
  contractAddresses: {
    schemaRegistry: '0x8320Ae819556C449825F8255e92E7e1bc06c2e80',
    attestationService: '0xce573F82e73F49721255088C7b4D849ad0F64331',
  },
  // Optional
  rpcUrl: 'https://testnet.hashio.io/api',
  indexerUrl: 'http://localhost:3001/api',
  hcsTopicIds: {
    schemas: '0.0.8221945',
    attestations: '0.0.8221946',
    authorities: '0.0.8221947',
  },
  resolverAddresses: {
    whitelistResolver: '0x461349A8aEfB220A48b61923095DfF237465c27A',
    feeResolver: '0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C',
    tokenGatedResolver: '0x7d04a83cF73CD4853dB4E378DD127440d444718c',
  },
});
```

Or use the built-in defaults:

```typescript
import { HederaAttestService, DEFAULT_CONFIG } from '@attestify/sdk';

const service = new HederaAttestService({
  ...DEFAULT_CONFIG,
  operatorAccountId: '0.0.XXXXX',
  operatorPrivateKey: 'your-ecdsa-key-hex',
});
```

## API Reference

All methods return `Promise<ServiceResponse<T>>` and never throw. Check `response.success` before accessing `response.data`.

---

### Schema Operations

#### `registerSchema(params)`

Register a new schema on-chain.

```typescript
const result = await service.registerSchema({
  definition: 'string name, uint256 age, bool verified',
  revocable: true,
  resolver: '0x461349...', // optional resolver address
});

if (result.success) {
  console.log('Schema UID:', result.data.schemaUid);
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `definition` | `string` | Yes | ABI-style field definition |
| `revocable` | `boolean` | Yes | Whether attestations can be revoked |
| `resolver` | `string` | No | Resolver contract address |

#### `getSchema(uid)`

```typescript
const result = await service.getSchema('0x7408a93f...');

if (result.success) {
  const { uid, definition, authority, resolver, revocable, timestamp } = result.data;
}
```

#### `listSchemas(params)`

```typescript
const result = await service.listSchemas({
  authority: '0x9Bf9a686...',  // optional filter
  limit: 25,                    // optional
  offset: 0,                    // optional
});

if (result.success) {
  for (const schema of result.data) {
    console.log(schema.uid, schema.definition, schema.hcsTopicId);
  }
}
```

---

### Attestation Operations

#### `createAttestation(params)`

```typescript
import { SchemaEncoder } from '@attestify/sdk';

const encoder = new SchemaEncoder('string name, uint256 age, bool verified');
const data = encoder.encodeData([
  { name: 'name', type: 'string', value: 'John Doe' },
  { name: 'age', type: 'uint256', value: 25 },
  { name: 'verified', type: 'bool', value: true },
]);

const result = await service.createAttestation({
  schemaUid: '0x7408a93f...',
  subject: '0x0F1A0cb4...',
  data,
  expirationTime: 0, // 0 = no expiration
});

if (result.success) {
  console.log('Attestation UID:', result.data.attestationUid);
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `schemaUid` | `string` | Yes | Schema to attest against |
| `subject` | `string` | Yes | Address the attestation is about |
| `data` | `string` | Yes | ABI-encoded attestation data (hex) |
| `expirationTime` | `number` | No | Unix timestamp; 0 = no expiration |

#### `getAttestation(uid)`

```typescript
const result = await service.getAttestation('0xbc72d396...');

if (result.success) {
  const {
    uid, schemaUid, attester, subject, data,
    timestamp, expirationTime, revoked, revocationTime, nonce,
  } = result.data;
}
```

#### `listAttestations(params)`

```typescript
const result = await service.listAttestations({
  attester: '0x9Bf9a686...',   // optional
  subject: '0x0F1A0cb4...',    // optional
  schemaUid: '0x7408a93f...',  // optional
  revoked: false,               // optional
  limit: 25,
});
```

#### `revokeAttestation(uid)`

```typescript
const result = await service.revokeAttestation('0xbc72d396...');
// result.success = true
```

---

### Authority Operations

#### `registerAuthority(metadata)`

```typescript
const result = await service.registerAuthority('Acme KYC Services');
// result.success = true
```

#### `getAuthority(address)`

```typescript
const result = await service.getAuthority('0x9Bf9a686...');

if (result.success) {
  const { addr, metadata, isVerified, registeredAt } = result.data;
}
```

#### `setAuthorityVerification(address, verified)`

```typescript
// Admin only — contract owner
const result = await service.setAuthorityVerification('0x9Bf9a686...', true);
```

#### `getProfile(address)`

```typescript
const result = await service.getProfile('0x9Bf9a686...');

if (result.success) {
  const { address, authority, schemas, attestationsIssued, attestationsReceived } = result.data;
}
```

---

### Delegation

#### `addDelegate(address)` / `removeDelegate(address)`

```typescript
const result = await service.addDelegate('0xDelegateAddress...');
// result.success = true

const result = await service.removeDelegate('0xDelegateAddress...');
// result.success = true
```

#### `isDelegate(authority, delegate)` / `getDelegates(authority)`

```typescript
const result = await service.isDelegate('0xAuthority...', '0xDelegate...');
if (result.success) {
  console.log('Is delegate:', result.data.isDelegate);
}

const result = await service.getDelegates('0xAuthority...');
if (result.success) {
  console.log('Delegates:', result.data.delegates);
}
```

#### `attestOnBehalf(params)` / `revokeOnBehalf(uid)`

```typescript
const result = await service.attestOnBehalf({
  authority: '0xAuthorityAddress...',
  schemaUid: '0x7408a93f...',
  subject: '0x0F1A0cb4...',
  data: '0x...',
  expirationTime: 0,
});
// result.data = { attestationUid: '0x...' }

const result = await service.revokeOnBehalf('0xbc72d396...');
// result.success = true
```

---

### Resolver Operations

#### Whitelist Resolver

```typescript
await service.whitelistAdd('0x0F1A0cb4...');
await service.whitelistRemove('0x0F1A0cb4...');

const check = await service.whitelistCheck('0x0F1A0cb4...');
// check.data.whitelisted = true/false

const owner = await service.whitelistOwner();
// owner.data.owner = '0x...'
```

#### Fee Resolver

```typescript
await service.feeDeposit('10');           // 10 HBAR
await service.feeSetFee('1000000000');    // wei/tinybar
await service.feeWithdraw();

const fee = await service.feeGetFee();
// fee.data.fee = '1000000000'

const balance = await service.feeGetBalance('0x9Bf9a686...');
// balance.data.balance = '...'
```

#### Token-Gated Resolver

```typescript
await service.tokenGatedSetConfig('0xTokenAddress...', '1');

const config = await service.tokenGatedGetConfig();
// config.data = { tokenAddress: '0x...', minimumBalance: '1' }
```

#### Token Reward Resolver

```typescript
await service.tokenRewardSetConfig('0xResolverAddr...', '0xTokenAddr...', '100');

const config = await service.tokenRewardGetConfig('0xResolverAddr...');
// config.data = { rewardToken: '0x...', rewardAmount: '100' }

const distributed = await service.tokenRewardGetDistributed('0xResolverAddr...', '0xSubject...');
// distributed.data = { distributed: '500' }
```

#### Cross-Contract Resolver (Pipeline)

```typescript
await service.crossContractSetPipeline('0xResolverAddr...', [
  '0xWhitelistResolver...',
  '0xFeeResolver...',
  '0xTokenGatedResolver...',
]);

const pipeline = await service.crossContractGetPipeline('0xResolverAddr...');
// pipeline.data.pipeline = ['0x...', '0x...', '0x...']
```

---

### NFT Minting

```typescript
const result = await service.mintNFT({
  subject: '0x0F1A0cb4...',
  attestationUid: '0xbc72d396...',
  tokenId: '0.0.12345',
});

if (result.success) {
  console.log('NFT serial:', result.data.serialNumber);
}
```

---

### Hedera Native Features

#### Scheduled Revocation

```typescript
const result = await service.scheduleRevocation({
  attestationUid: '0xbc72d396...',
  executeAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
});
// result.data = { scheduleId: '0.0.12345', transactionId: '...' }

const status = await service.getScheduledRevocation('0.0.12345');
// status.data = { executed: false, deleted: false, expirationTime: '...' }
```

#### Multi-Sig Authority

```typescript
const result = await service.createMultiSigAuthority({
  publicKeys: ['302a300506...', '302a300506...', '302a300506...'],
  threshold: 2,
  initialBalance: '10',
});
// result.data = { accountId: '0.0.12345', threshold: 2, totalKeys: 3 }

const info = await service.getAccountKeyInfo('0.0.12345');
// info.data = { accountId: '0.0.12345', keyType: 'threshold', threshold: 2, keyCount: 3 }
```

#### Token Staking

```typescript
await service.stakeTokens('0xTokenAddr...', '1000');
await service.unstakeTokens('0xTokenAddr...', '500');

const stake = await service.getStake('0xTokenAddr...', '0.0.12345');
// stake.data = { stakedAmount: '500', tokenAddress: '0x...' }
```

#### File Service Schema

```typescript
const upload = await service.uploadSchemaFile(
  'string name, uint256 age, bool verified, address wallet',
  'Complex KYC schema v2',
);
// upload.data = { fileId: '0.0.12345', definition: '...' }

const read = await service.readSchemaFile('0.0.12345');
// read.data = { fileId: '0.0.12345', definition: 'string name, uint256 age...' }

const result = await service.registerSchemaFromFile({
  fileId: '0.0.12345',
  revocable: true,
  resolver: '0x461349...',
});
// result.data = { schemaUid: '0x...' }
```

---

### Schema Encoder

```typescript
import { SchemaEncoder, parseSchema } from '@attestify/sdk';

// Parse a definition string
const fields = parseSchema('string name, uint256 age, bool verified');
// [{ name: 'name', type: 'string' }, { name: 'age', type: 'uint256' }, ...]

// Encode data
const encoder = new SchemaEncoder('string name, uint256 age, bool verified');
const encoded = encoder.encodeData([
  { name: 'name', type: 'string', value: 'John Doe' },
  { name: 'age', type: 'uint256', value: 25 },
  { name: 'verified', type: 'bool', value: true },
]);

// Decode data
const decoded = encoder.decodeData(encoded);
```

---

### Indexer Client

Standalone client for querying the Attestify indexer — no private key needed.

```typescript
import { IndexerClient } from '@attestify/sdk';

const client = new IndexerClient('http://localhost:3001');

const schemas = await client.listSchemas({ authority: '0x...', limit: 10 });
const attestations = await client.listAttestations({ attester: '0x...' });
const profile = await client.getProfile('0x...');
```

---

### Utilities & UID Computation

```typescript
import { computeSchemaUid, computeAttestationUid } from '@attestify/sdk';

const schemaUid = computeSchemaUid('string name, uint256 age', '0x0000...0000', true);
const attestUid = computeAttestationUid('0x7408...', '0x9Bf9...', '0x0F1A...', 0);
```

### Exported Constants

```typescript
import {
  DEFAULT_RPC_URL,           // 'https://testnet.hashio.io/api'
  DEFAULT_INDEXER_URL,        // 'http://localhost:3001/api'
  HEDERA_TESTNET_CHAIN_ID,   // 296
  HEDERA_TESTNET_CHAIN,       // EIP-3085 chain params for MetaMask
  TESTNET_CONTRACT_ADDRESSES, // { schemaRegistry, attestationService }
  TESTNET_RESOLVER_ADDRESSES, // { whitelistResolver, feeResolver, tokenGatedResolver }
  TESTNET_HCS_TOPICS,         // { schemas, attestations, authorities }
  DEFAULT_CONFIG,              // Sensible defaults (minus operator credentials)
} from '@attestify/sdk';
```

---

## AI Integration (`@attestify/sdk/ai`)

Build your own AI agent with 17 LangChain-compatible tools wrapping the full Attestify SDK.

```bash
npm install @attestify/sdk langchain @langchain/core @langchain/openai zod
```

### `getAttestifyTools(config)`

Returns 17 LangChain-compatible tools for use in any agent framework.

```typescript
import { getAttestifyTools } from '@attestify/sdk/ai';

const tools = getAttestifyTools({
  accountId: '0.0.XXXXX',
  privateKey: 'your-ecdsa-key-hex',
  indexerUrl: 'http://localhost:3001/api', // optional
});

console.log(tools.map(t => t.name));
// → register_schema, get_schema, list_schemas, create_attestation,
//   get_attestation, revoke_attestation, list_attestations,
//   register_authority, get_authority, get_profile,
//   encode_attestation_data, decode_attestation_data,
//   whitelist_check, fee_get_fee, fee_get_balance,
//   mint_nft_credential, schedule_revocation
```

### `createAttestifyAgent(config)`

Returns a ready-to-use agent with conversation memory.

```typescript
import { createAttestifyAgent } from '@attestify/sdk/ai';

const { processMessage, clearConversation } = await createAttestifyAgent({
  accountId: '0.0.XXXXX',
  privateKey: 'your-ecdsa-key-hex',
  openAIApiKey: 'sk-...',
  modelName: 'gpt-4o-mini',     // optional (default)
  temperature: 0,                 // optional (default)
  indexerUrl: 'http://localhost:3001/api', // optional
});

// Chat with the agent — it has conversation memory
const response = await processMessage('Register a KYC schema with name, documentType, verified');
console.log(response);
// → "Schema registered! UID: 0x7408a93f..."

// Multi-turn conversation
const follow = await processMessage('Now create an attestation for 0x0F1A...');
console.log(follow);

// Clear conversation memory
clearConversation('default');
```

### Available AI Tools

| Tool | Description |
|------|-------------|
| `register_schema` | Register a new schema on-chain |
| `get_schema` | Fetch a schema by UID |
| `list_schemas` | List schemas with optional filters |
| `create_attestation` | Create an attestation (auto-encodes data) |
| `get_attestation` | Fetch an attestation by UID |
| `revoke_attestation` | Revoke an attestation |
| `list_attestations` | List attestations with filters |
| `register_authority` | Register as an authority |
| `get_authority` | Fetch authority info |
| `get_profile` | Get address profile (schemas, attestations) |
| `encode_attestation_data` | ABI-encode data for a schema |
| `decode_attestation_data` | Decode attestation data |
| `whitelist_check` | Check if address is whitelisted |
| `fee_get_fee` | Get current fee amount |
| `fee_get_balance` | Get deposited balance |
| `mint_nft_credential` | Mint an HTS NFT credential |
| `schedule_revocation` | Schedule a future revocation |

---

## Error Handling

Every method returns a `ServiceResponse<T>`:

```typescript
interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    type: AttestifyErrorType;
    message: string;
  };
}
```

The SDK never throws from public methods (the constructor is the only exception for invalid config). Check `success` and handle errors by `type`:

```typescript
const res = await service.createAttestation(params);

if (!res.success) {
  switch (res.error!.type) {
    case 'ALREADY_EXISTS':     break; // Duplicate
    case 'RESOLVER_REJECTED':  break; // Resolver denied
    case 'NETWORK_ERROR':      break; // RPC issue
    default: console.error(res.error!.message);
  }
}
```

### Error Types

| Type | Description |
|------|-------------|
| `ALREADY_EXISTS` | Schema or attestation with the same UID already exists |
| `NOT_FOUND` | Schema, attestation, or authority not found |
| `UNAUTHORIZED` | Caller is not authorized for the operation |
| `VALIDATION_ERROR` | Invalid input (non-revocable schema, invalid resolver, insufficient fee) |
| `ALREADY_REVOKED` | Attestation has already been revoked |
| `RESOLVER_REJECTED` | Resolver contract rejected the operation |
| `EXPIRED` | Attestation has expired |
| `NETWORK_ERROR` | RPC or connectivity failure |
| `CONFIGURATION_ERROR` | Invalid SDK configuration |
| `TRANSACTION_ERROR` | On-chain transaction failed |
| `UNKNOWN_ERROR` | Unrecognized error |

## Deployed Contracts (Hedera Testnet)

| Contract | Address | HashScan |
|----------|---------|----------|
| SchemaRegistry | `0x8320Ae819556C449825F8255e92E7e1bc06c2e80` | [View](https://hashscan.io/testnet/contract/0x8320Ae819556C449825F8255e92E7e1bc06c2e80) |
| AttestationService | `0xce573F82e73F49721255088C7b4D849ad0F64331` | [View](https://hashscan.io/testnet/contract/0xce573F82e73F49721255088C7b4D849ad0F64331) |
| WhitelistResolver | `0x461349A8aEfB220A48b61923095DfF237465c27A` | [View](https://hashscan.io/testnet/contract/0x461349A8aEfB220A48b61923095DfF237465c27A) |
| FeeResolver | `0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C` | [View](https://hashscan.io/testnet/contract/0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C) |
| TokenGatedResolver | `0x7d04a83cF73CD4853dB4E378DD127440d444718c` | [View](https://hashscan.io/testnet/contract/0x7d04a83cF73CD4853dB4E378DD127440d444718c) |

## HCS Audit Topics (Hedera Testnet)

| Topic | ID | HashScan |
|-------|-----|----------|
| Schemas | `0.0.8221945` | [View](https://hashscan.io/testnet/topic/0.0.8221945) |
| Attestations | `0.0.8221946` | [View](https://hashscan.io/testnet/topic/0.0.8221946) |
| Authorities | `0.0.8221947` | [View](https://hashscan.io/testnet/topic/0.0.8221947) |

## Published on npm

- SDK: [@attestify/sdk](https://www.npmjs.com/package/@attestify/sdk)
- CLI: [@attestify/cli](https://www.npmjs.com/package/@attestify/cli)

## GitHub

[github.com/Aliyaan-Nasir/Attestify](https://github.com/Aliyaan-Nasir/Attestify)

## License

MIT
