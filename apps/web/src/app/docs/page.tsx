'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { CodeExample } from '@/components/marketing/CodeExample';
import {
  BookOpen, Box, Terminal, Server, Shield, FileCode2, Fingerprint,
  UserCheck, ScrollText, Cpu, Hash, Globe, ChevronRight, ChevronDown, Coins, Key, Sparkles,
} from 'lucide-react';

// ─── Sidebar Navigation (grouped with collapsible dropdowns) ─────────────────

const NAV_GROUPS = [
  {
    label: 'Overview',
    icon: BookOpen,
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'contracts', label: 'Smart Contracts' },
    ],
  },
  {
    label: 'SDK Reference',
    icon: Cpu,
    items: [
      { id: 'sdk-setup', label: 'Setup' },
      { id: 'sdk-schemas', label: 'Schemas' },
      { id: 'sdk-attestations', label: 'Attestations' },
      { id: 'sdk-authorities', label: 'Authorities' },
      { id: 'sdk-delegation', label: 'Delegation' },
      { id: 'sdk-queries', label: 'Queries' },
      { id: 'sdk-resolvers', label: 'Resolvers' },
      { id: 'sdk-token-reward', label: 'Token Reward' },
      { id: 'sdk-cross-contract', label: 'Cross-Contract' },
      { id: 'sdk-nft', label: 'NFT Minting' },
      { id: 'sdk-utilities', label: 'Utilities' },
    ],
  },
  {
    label: 'CLI Reference',
    icon: Terminal,
    items: [
      { id: 'cli', label: 'Setup & Options' },
      { id: 'cli-schema', label: 'Schema' },
      { id: 'cli-attestation', label: 'Attestation' },
      { id: 'cli-authority', label: 'Authority' },
      { id: 'cli-delegation', label: 'Delegation' },
      { id: 'cli-profile', label: 'Profile' },
      { id: 'cli-resolvers', label: 'Resolvers' },
      { id: 'cli-token-reward', label: 'Token Reward' },
      { id: 'cli-cross-contract', label: 'Cross-Contract' },
      { id: 'cli-nft', label: 'NFT Mint' },
      { id: 'cli-hcs', label: 'HCS' },
    ],
  },
  {
    label: 'Infrastructure',
    icon: Server,
    items: [
      { id: 'hcs', label: 'HCS Audit Trail' },
      { id: 'indexer', label: 'Indexer API' },
      { id: 'resolvers', label: 'Resolvers' },
      { id: 'schema-types', label: 'Schema Types' },
    ],
  },
  {
    label: 'Hedera Native',
    icon: Key,
    items: [
      { id: 'hedera-hcs-proof', label: 'HCS Proof' },
      { id: 'hedera-nft', label: 'HTS NFT Credential' },
      { id: 'hedera-scheduled', label: 'Scheduled Revocation' },
      { id: 'hedera-multisig', label: 'Multi-Sig Authority' },
      { id: 'hedera-staking', label: 'Token Staking' },
      { id: 'hedera-file-schema', label: 'File Service Schema' },
    ],
  },
  {
    label: 'AI Integration',
    icon: Sparkles,
    items: [
      { id: 'sdk-ai', label: 'SDK AI Tools' },
      { id: 'cli-ai', label: 'CLI AI Mode' },
    ],
  },
];

// Flat list of all section IDs for the IntersectionObserver
const ALL_SECTION_IDS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

// ─── Contract Data ───────────────────────────────────────────────────────────

const CONTRACTS = [
  { name: 'SchemaRegistry', address: '0x8320Ae819556C449825F8255e92E7e1bc06c2e80', description: 'Registers and stores attestation schema definitions.' },
  { name: 'AttestationService', address: '0xce573F82e73F49721255088C7b4D849ad0F64331', description: 'Creates, revokes, and retrieves attestations. Manages authorities.' },
  { name: 'WhitelistResolver', address: '0x461349A8aEfB220A48b61923095DfF237465c27A', description: 'Only whitelisted addresses can create attestations under this schema. Admin manages the whitelist.' },
  { name: 'FeeResolver', address: '0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C', description: 'Requires HBAR deposit to create an attestation. Fee amount is configurable by the admin.' },
  { name: 'TokenGatedResolver', address: '0x7d04a83cF73CD4853dB4E378DD127440d444718c', description: 'Requires the attester to hold a specific HTS token with a minimum balance. Admin configures token ID and threshold.' },
  { name: 'TokenRewardResolver', address: 'Deploy your own instance', description: 'Automatically rewards attestation subjects with HTS tokens. Configurable reward token and amount per attestation.' },
  { name: 'CrossContractResolver', address: 'Deploy your own instance', description: 'Pipeline resolver that chains multiple resolvers in sequence. All must approve for the attestation to proceed.' },
];

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/schemas', description: 'List all schemas', params: '?authority=, ?search=, ?limit=, ?offset=' },
  { method: 'GET', path: '/api/schemas/:uid', description: 'Get schema by UID', params: '' },
  { method: 'GET', path: '/api/attestations', description: 'List attestations', params: '?attester=, ?subject=, ?schemaUid=, ?revoked=, ?limit=, ?offset=' },
  { method: 'GET', path: '/api/attestations/:uid', description: 'Get attestation by UID', params: '' },
  { method: 'GET', path: '/api/authorities', description: 'List registered authorities', params: '?search=, ?limit=, ?offset=' },
  { method: 'GET', path: '/api/authorities/:address', description: 'Get authority by address', params: '' },
  { method: 'GET', path: '/api/indexer-status', description: 'Indexer sync status and last processed block', params: '' },
  { method: 'GET', path: '/api/hcs/topics', description: 'List HCS topic IDs', params: '' },
  { method: 'GET', path: '/api/hcs/messages/:topicId', description: 'Fetch HCS messages from a topic', params: '?limit=, ?order=' },
];

const HCS_TOPICS = [
  { name: 'Schemas', id: '0.0.8221945', description: 'All schema registrations' },
  { name: 'Attestations', id: '0.0.8221946', description: 'All attestation creates/revokes' },
  { name: 'Authorities', id: '0.0.8221947', description: 'All authority registrations/verifications' },
];

// ─── Code Snippets ───────────────────────────────────────────────────────────

const SDK_INSTALL = `npm install @attestify/sdk`;

const SDK_SETUP = `import { HederaAttestService } from '@attestify/sdk';

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
});`;

const SDK_REGISTER_SCHEMA = `const result = await service.registerSchema({
  definition: 'string name, uint256 age, bool verified',
  revocable: true,
  resolver: '0x461349...', // optional resolver address
});

if (result.success) {
  console.log('Schema UID:', result.data.schemaUid);
}`;

const SDK_GET_SCHEMA = `const result = await service.getSchema('0x7408a93f...');

if (result.success) {
  const { uid, definition, authority, resolver, revocable, timestamp } = result.data;
}`;

const SDK_CREATE_ATTESTATION = `import { SchemaEncoder } from '@attestify/sdk';

// Encode data according to schema
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
}`;

const SDK_GET_ATTESTATION = `const result = await service.getAttestation('0xbc72d396...');

if (result.success) {
  const {
    uid, schemaUid, attester, subject, data,
    timestamp, expirationTime, revoked, revocationTime, nonce,
  } = result.data;
}`;

const SDK_REVOKE = `const result = await service.revokeAttestation('0xbc72d396...');
// result.success = true`;

const SDK_REGISTER_AUTHORITY = `const result = await service.registerAuthority('Acme KYC Services');
// result.success = true`;

const SDK_GET_AUTHORITY = `const result = await service.getAuthority('0x9Bf9a686...');

if (result.success) {
  const { addr, metadata, isVerified, registeredAt } = result.data;
}`;

const SDK_VERIFY_AUTHORITY = `// Admin only — contract owner
const result = await service.setAuthorityVerification('0x9Bf9a686...', true);`;

const SDK_LIST_SCHEMAS = `const result = await service.listSchemas({
  authority: '0x9Bf9a686...',  // optional filter
  limit: 25,                    // optional
  offset: 0,                    // optional
});

if (result.success) {
  for (const schema of result.data) {
    console.log(schema.uid, schema.definition, schema.hcsTopicId);
  }
}`;

const SDK_LIST_ATTESTATIONS = `const result = await service.listAttestations({
  attester: '0x9Bf9a686...',   // optional
  subject: '0x0F1A0cb4...',    // optional
  schemaUid: '0x7408a93f...',  // optional
  revoked: false,               // optional
  limit: 25,
});`;

const SDK_GET_PROFILE = `const result = await service.getProfile('0x9Bf9a686...');

if (result.success) {
  const { address, authority, schemas, attestationsIssued, attestationsReceived } = result.data;
}`;

const SDK_SCHEMA_ENCODER = `import { SchemaEncoder, parseSchema } from '@attestify/sdk';

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
const decoded = encoder.decodeData(encoded);`;

const SDK_UID_COMPUTE = `import { computeSchemaUid, computeAttestationUid } from '@attestify/sdk';

const schemaUid = computeSchemaUid('string name, uint256 age', '0x0000...0000', true);
const attestUid = computeAttestationUid('0x7408...', '0x9Bf9...', '0x0F1A...', 0);`;

const SDK_INDEXER_CLIENT = `import { IndexerClient } from '@attestify/sdk';

// Standalone client — no private key needed
const client = new IndexerClient('http://localhost:3001');

const schemas = await client.listSchemas({ authority: '0x...', limit: 10 });
const attestations = await client.listAttestations({ attester: '0x...' });
const profile = await client.getProfile('0x...');`;

const SDK_CONSTANTS = `import {
  DEFAULT_RPC_URL,           // 'https://testnet.hashio.io/api'
  DEFAULT_INDEXER_URL,        // 'http://localhost:3001/api'
  HEDERA_TESTNET_CHAIN_ID,   // 296
  HEDERA_TESTNET_CHAIN,       // EIP-3085 chain params for MetaMask
  TESTNET_CONTRACT_ADDRESSES, // { schemaRegistry, attestationService }
  TESTNET_RESOLVER_ADDRESSES, // { whitelistResolver, feeResolver, tokenGatedResolver }
  TESTNET_HCS_TOPICS,         // { schemas, attestations, authorities }
  DEFAULT_CONFIG,              // Sensible defaults (minus operator credentials)
} from '@attestify/sdk';`;

const CLI_SETUP = `# Install
npm install -g @attestify/cli

# Required environment variables
export HEDERA_ACCOUNT_ID="0.0.7284771"
export HEDERA_PRIVATE_KEY="your-ecdsa-private-key-hex"

# Optional
export INDEXER_URL="http://localhost:3001/api"
export HCS_TOPIC_SCHEMAS="0.0.8221945"
export HCS_TOPIC_ATTESTATIONS="0.0.8221946"
export HCS_TOPIC_AUTHORITIES="0.0.8221947"`;

const CLI_SCHEMA_CREATE = `# Inline
attestify schema create \\
  --definition "string name, uint256 age, bool verified" \\
  --revocable \\
  --resolver 0x461349A8aEfB220A48b61923095DfF237465c27A

# From JSON file
attestify schema create --file schema.json`;

const CLI_SCHEMA_FETCH = `attestify schema fetch --uid 0x7408a93fa658b219...`;

const CLI_SCHEMA_LIST = `# All schemas
attestify schema list

# Filter by authority
attestify schema list --authority 0x9Bf9a686... --limit 10`;

const CLI_ATT_CREATE = `attestify attestation create \\
  --schema-uid 0x7408a93f... \\
  --subject 0x0F1A0cb4... \\
  --data 0x00000000... \\
  --expiration 1735689600

# Or from file
attestify attestation create --file attestation.json`;

const CLI_ATT_FETCH = `attestify attestation fetch --uid 0xbc72d396...`;

const CLI_ATT_LIST = `# By attester
attestify attestation list --attester 0x9Bf9a686...

# By subject
attestify attestation list --subject 0x0F1A0cb4...

# By schema + limit
attestify attestation list --schema-uid 0x7408a93f... --limit 10`;

const CLI_ATT_REVOKE = `attestify attestation revoke --uid 0xbc72d396...`;

const CLI_AUTH_REGISTER = `attestify authority register --metadata "Acme KYC Services"`;

const CLI_AUTH_FETCH = `attestify authority fetch --address 0x9Bf9a686...`;

const CLI_PROFILE = `attestify profile --address 0x9Bf9a686...

# JSON output
attestify --json profile --address 0x9Bf9a686...`;

const CLI_HCS_TOPICS = `attestify hcs topics`;

const CLI_HCS_MESSAGES = `# Latest 25 messages
attestify hcs messages --topic 0.0.8221946

# Oldest first, limit 10
attestify hcs messages --topic 0.0.8221946 --limit 10 --order asc

# Per-schema topic
attestify hcs messages --topic 0.0.8225001 --limit 50`;

// ─── SDK Resolver Snippets ───────────────────────────────────────────────────

const SDK_WHITELIST_ADD = `const result = await service.whitelistAdd('0x0F1A0cb4...');
// result.success = true`;

const SDK_WHITELIST_REMOVE = `const result = await service.whitelistRemove('0x0F1A0cb4...');
// result.success = true`;

const SDK_WHITELIST_CHECK = `const result = await service.whitelistCheck('0x0F1A0cb4...');
if (result.success) {
  console.log('Whitelisted:', result.data.whitelisted);
}`;

const SDK_WHITELIST_OWNER = `const result = await service.whitelistOwner();
if (result.success) {
  console.log('Owner:', result.data.owner);
}`;

const SDK_FEE_DEPOSIT = `const result = await service.feeDeposit('10'); // 10 HBAR
// result.success = true`;

const SDK_FEE_SET = `const result = await service.feeSetFee('1000000000'); // wei/tinybar
// result.success = true`;

const SDK_FEE_WITHDRAW = `const result = await service.feeWithdraw();
// result.success = true`;

const SDK_FEE_GET = `const result = await service.feeGetFee();
if (result.success) {
  console.log('Fee (wei):', result.data.fee);
}`;

const SDK_FEE_BALANCE = `const result = await service.feeGetBalance('0x9Bf9a686...');
if (result.success) {
  console.log('Balance (wei):', result.data.balance);
}`;

const SDK_TOKEN_SET = `const result = await service.tokenGatedSetConfig(
  '0xTokenAddress...',  // HTS token address
  '1',                   // minimum balance
);`;

const SDK_TOKEN_GET = `const result = await service.tokenGatedGetConfig();
if (result.success) {
  console.log('Token:', result.data.tokenAddress);
  console.log('Min balance:', result.data.minimumBalance);
}`;

const SDK_MINT_NFT = `const result = await service.mintNFT({
  subject: '0x0F1A0cb4...',
  attestationUid: '0xbc72d396...',
  tokenId: '0.0.12345',
});

if (result.success) {
  console.log('NFT serial:', result.data.serialNumber);
}`;

// ─── SDK Delegation Snippets ─────────────────────────────────────────────────

const SDK_ADD_DELEGATE = `// Authority adds a delegate
const result = await service.addDelegate('0xDelegateAddress...');
// result.success = true`;

const SDK_REMOVE_DELEGATE = `const result = await service.removeDelegate('0xDelegateAddress...');
// result.success = true`;

const SDK_IS_DELEGATE = `const result = await service.isDelegate('0xAuthority...', '0xDelegate...');
if (result.success) {
  console.log('Is delegate:', result.data.isDelegate);
}`;

const SDK_GET_DELEGATES = `const result = await service.getDelegates('0xAuthority...');
if (result.success) {
  console.log('Delegates:', result.data.delegates);
}`;

const SDK_ATTEST_ON_BEHALF = `// Delegate creates attestation on behalf of authority
const result = await service.attestOnBehalf({
  authority: '0xAuthorityAddress...',
  schemaUid: '0x7408a93f...',
  subject: '0x0F1A0cb4...',
  data: '0x...',  // ABI-encoded
  expirationTime: 0,
});
// result.data = { attestationUid: '0x...' }`;

const SDK_REVOKE_ON_BEHALF = `// Delegate revokes attestation on behalf of original attester
const result = await service.revokeOnBehalf('0xbc72d396...');
// result.success = true`;

// ─── SDK Token Reward Snippets ───────────────────────────────────────────────

const SDK_TOKEN_REWARD_SET = `const result = await service.tokenRewardSetConfig(
  '0xResolverAddress...',  // TokenRewardResolver address
  '0xTokenAddress...',      // HTS reward token
  '100',                     // amount per attestation
);`;

const SDK_TOKEN_REWARD_GET = `const result = await service.tokenRewardGetConfig('0xResolverAddress...');
if (result.success) {
  console.log('Token:', result.data.rewardToken);
  console.log('Amount:', result.data.rewardAmount);
}`;

const SDK_TOKEN_REWARD_DISTRIBUTED = `const result = await service.tokenRewardGetDistributed(
  '0xResolverAddress...',
  '0xSubjectAddress...',
);
// result.data = { distributed: '500' }`;

// ─── SDK Cross-Contract Snippets ─────────────────────────────────────────────

const SDK_CROSS_SET_PIPELINE = `const result = await service.crossContractSetPipeline(
  '0xResolverAddress...',
  ['0xWhitelistResolver...', '0xFeeResolver...', '0xTokenGatedResolver...'],
);`;

const SDK_CROSS_GET_PIPELINE = `const result = await service.crossContractGetPipeline('0xResolverAddress...');
if (result.success) {
  console.log('Pipeline:', result.data.pipeline);
}`;

// ─── CLI Delegation Snippets ─────────────────────────────────────────────────

const CLI_DELEGATE_ADD = `attestify delegate add --address 0xDelegateAddress...`;
const CLI_DELEGATE_REMOVE = `attestify delegate remove --address 0xDelegateAddress...`;
const CLI_DELEGATE_CHECK = `attestify delegate check --authority 0xAuthority... --delegate 0xDelegate...`;
const CLI_DELEGATE_LIST = `attestify delegate list --authority 0xAuthority...`;
const CLI_DELEGATE_ATTEST = `attestify delegate attest \\
  --authority 0xAuthorityAddress... \\
  --schema-uid 0x7408a93f... \\
  --subject 0x0F1A0cb4... \\
  --data 0x...`;
const CLI_DELEGATE_REVOKE = `attestify delegate revoke --uid 0xbc72d396...`;

// ─── CLI Token Reward Snippets ───────────────────────────────────────────────

const CLI_TOKEN_REWARD_SET = `attestify token-reward set-config \\
  --resolver 0xResolverAddress... \\
  --token 0xTokenAddress... \\
  --amount 100`;
const CLI_TOKEN_REWARD_GET = `attestify token-reward get-config --resolver 0xResolverAddress...`;
const CLI_TOKEN_REWARD_DISTRIBUTED = `attestify token-reward distributed \\
  --resolver 0xResolverAddress... \\
  --subject 0xSubjectAddress...`;

// ─── CLI Cross-Contract Snippets ─────────────────────────────────────────────

const CLI_CROSS_SET = `attestify cross-contract set-pipeline \\
  --resolver 0xResolverAddress... \\
  --resolvers 0xWhitelist...,0xFee...,0xTokenGated...`;
const CLI_CROSS_GET = `attestify cross-contract get-pipeline --resolver 0xResolverAddress...`;

// ─── CLI Resolver Snippets ───────────────────────────────────────────────────

const CLI_AUTH_VERIFY = `# Verify an authority
attestify authority verify --address 0x9Bf9a686...

# Unverify an authority
attestify authority verify --address 0x9Bf9a686... --revoke`;

const CLI_WHITELIST_ADD = `attestify whitelist add --account 0x0F1A0cb4...`;
const CLI_WHITELIST_REMOVE = `attestify whitelist remove --account 0x0F1A0cb4...`;
const CLI_WHITELIST_CHECK = `attestify whitelist check --account 0x0F1A0cb4...`;
const CLI_WHITELIST_OWNER = `attestify whitelist owner`;

const CLI_FEE_DEPOSIT = `attestify fee deposit --amount 10`;
const CLI_FEE_SET = `attestify fee set-fee --amount 1000000000`;
const CLI_FEE_WITHDRAW = `attestify fee withdraw`;
const CLI_FEE_GET = `attestify fee get-fee`;
const CLI_FEE_BALANCE = `attestify fee balance --account 0x9Bf9a686...`;
const CLI_FEE_OWNER = `attestify fee owner`;

const CLI_TOKEN_SET = `attestify token-gated set-config \\
  --token 0xTokenAddress... \\
  --min-balance 1`;
const CLI_TOKEN_GET = `attestify token-gated get-config`;
const CLI_TOKEN_OWNER = `attestify token-gated owner`;

const CLI_NFT_MINT = `attestify nft-mint \\
  --subject 0x0F1A0cb4... \\
  --attestation-uid 0xbc72d396... \\
  --token-id 0.0.12345`;

// ─── Hedera Native Snippets ──────────────────────────────────────────────────

const SDK_SCHEDULE_REVOKE = `const result = await service.scheduleRevocation({
  attestationUid: '0xbc72d396...',
  executeAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
});
// result.data = { scheduleId: '0.0.12345', transactionId: '...' }`;

const SDK_SCHEDULE_STATUS = `const status = await service.getScheduledRevocation('0.0.12345');
// status.data = { executed: false, deleted: false, expirationTime: '...' }`;

const CLI_SCHEDULE_REVOKE = `attestify schedule revoke \\
  --uid 0xbc72d396... \\
  --execute-at 1735689600`;

const CLI_SCHEDULE_STATUS = `attestify schedule status --schedule-id 0.0.12345`;

// ─── Feature 5: Multi-Sig Authority Snippets ────────────────────────────────

const SDK_MULTISIG_CREATE = `const result = await service.createMultiSigAuthority({
  publicKeys: ['302a300506...', '302a300506...', '302a300506...'],
  threshold: 2,
  initialBalance: '10',
});
// result.data = { accountId: '0.0.12345', threshold: 2, totalKeys: 3 }`;

const SDK_MULTISIG_INFO = `const info = await service.getAccountKeyInfo('0.0.12345');
// info.data = { accountId: '0.0.12345', keyType: 'threshold', threshold: 2, keyCount: 3 }`;

const CLI_MULTISIG_CREATE = `attestify multisig create \\
  --keys 302a300506...,302a300506...,302a300506... \\
  --threshold 2 \\
  --initial-balance 10`;

const CLI_MULTISIG_INFO = `attestify multisig info --account 0.0.12345`;

// ─── Feature 6: Token Staking Snippets ───────────────────────────────────────

const SDK_STAKE = `const result = await service.stakeTokens('0xTokenAddr...', '1000');
// result.success = true`;

const SDK_UNSTAKE = `const result = await service.unstakeTokens('0xTokenAddr...', '500');
// result.success = true`;

const SDK_GET_STAKE = `const result = await service.getStake('0xTokenAddr...', '0.0.12345');
// result.data = { stakedAmount: '500', tokenAddress: '0x...' }`;

const CLI_STAKE = `attestify staking stake --token 0xTokenAddr... --amount 1000`;
const CLI_UNSTAKE = `attestify staking unstake --token 0xTokenAddr... --amount 500`;
const CLI_STAKE_BALANCE = `attestify staking balance --token 0xTokenAddr... --authority 0.0.12345`;

// ─── Feature 7: File Service Schema Snippets ─────────────────────────────────

const SDK_FILE_UPLOAD = `const result = await service.uploadSchemaFile(
  'string name, uint256 age, bool verified, address wallet',
  'Complex KYC schema v2',  // optional memo
);
// result.data = { fileId: '0.0.12345', definition: '...' }`;

const SDK_FILE_READ = `const result = await service.readSchemaFile('0.0.12345');
// result.data = { fileId: '0.0.12345', definition: 'string name, uint256 age...' }`;

const SDK_FILE_REGISTER = `const result = await service.registerSchemaFromFile({
  fileId: '0.0.12345',
  revocable: true,
  resolver: '0x461349...', // optional
});
// result.data = { schemaUid: '0x...' }`;

const CLI_FILE_UPLOAD = `attestify file-schema upload \\
  --definition "string name, uint256 age, bool verified" \\
  --memo "KYC schema v2"`;

const CLI_FILE_READ = `attestify file-schema read --file-id 0.0.12345`;

const CLI_FILE_REGISTER = `attestify file-schema register \\
  --file-id 0.0.12345 \\
  --revocable \\
  --resolver 0x461349...`;

// ─── SDK AI Snippets ─────────────────────────────────────────────────────────

const SDK_AI_INSTALL = `npm install @attestify/sdk langchain @langchain/core @langchain/openai zod`;

const SDK_AI_TOOLS = `import { getAttestifyTools } from '@attestify/sdk/ai';

// Returns 17 LangChain-compatible tools wrapping @attestify/sdk
const tools = getAttestifyTools({
  accountId: '0.0.XXXXX',
  privateKey: 'your-ecdsa-key-hex',
  indexerUrl: 'http://localhost:3001/api', // optional
});

// Plug into any LangChain, CrewAI, or custom agent
console.log(tools.map(t => t.name));
// → register_schema, get_schema, list_schemas, create_attestation,
//   get_attestation, revoke_attestation, list_attestations,
//   register_authority, get_authority, get_profile,
//   encode_attestation_data, decode_attestation_data,
//   whitelist_check, fee_get_fee, fee_get_balance,
//   mint_nft_credential, schedule_revocation`;

const SDK_AI_AGENT = `import { createAttestifyAgent } from '@attestify/sdk/ai';

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
clearConversation('default');`;

// ─── CLI AI Snippets ─────────────────────────────────────────────────────────

const CLI_AI_ONESHOT = `# One-shot mode — send a single message
attestify ai "List all schemas"
attestify ai "Register a schema with fields: string name, uint256 age, bool verified"
attestify ai "Create an attestation for 0x0F1A... using schema 0x7408..."`;

const CLI_AI_REPL = `# Interactive REPL mode — omit the message argument
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
# Goodbye!`;

const CLI_AI_OPTIONS = `# Use a different model
attestify ai --model gpt-4o "Explain the attestation with UID 0xbc72d396..."

# JSON output (one-shot only)
attestify --json ai "List all authorities"`;


const HCS_MESSAGE_FORMAT = `{
  "version": "1.0",
  "type": "attestation.created",
  "payload": {
    "uid": "0xbc72d396...",
    "schemaUid": "0x7408a93f...",
    "attester": "0x9Bf9a686...",
    "subject": "0x0F1A0cb4...",
    "data": "0x...",
    "decodedData": {
      "name": "John Doe",
      "age": "25",
      "verified": "true"
    },
    "nonce": 0,
    "transactionHash": "0x...",
    "blockNumber": 32731636,
    "consensusTimestamp": "1773510928.180086275"
  }
}`;

const RESOLVER_WHITELIST = `// WhitelistResolver — only whitelisted addresses can attest
// Admin adds addresses to the whitelist
// Contract: 0x461349A8aEfB220A48b61923095DfF237465c27A

// When creating a schema with whitelist resolver:
attestify schema create \\
  --definition "string name" \\
  --revocable \\
  --resolver 0x461349A8aEfB220A48b61923095DfF237465c27A`;

const RESOLVER_FEE = `// FeeResolver — requires HBAR deposit to attest
// Contract: 0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C
// Attester must send HBAR with the attestation transaction`;

const RESOLVER_TOKEN = `// TokenGatedResolver — requires HTS token balance
// Contract: 0x7d04a83cF73CD4853dB4E378DD127440d444718c
// Admin configures which token and minimum balance required`;

// ─── Helper Components ───────────────────────────────────────────────────────

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="scroll-mt-28" />;
}

function SectionLabel({ text }: { text: string }) {
  return <p className="mb-2 font-mono text-sm text-brand-500">{text}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-2xl font-bold tracking-tight text-surface-900">{children}</h2>;
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p className="mb-6 text-sm leading-relaxed text-surface-500">{children}</p>;
}

function ParamTable({ params }: { params: { name: string; type: string; required: boolean; description: string }[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-surface-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50">
            <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Parameter</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Type</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Required</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-b border-surface-100 last:border-0">
              <td className="px-4 py-2 font-mono text-xs text-surface-700">{p.name}</td>
              <td className="px-4 py-2 font-mono text-xs text-brand-500">{p.type}</td>
              <td className="px-4 py-2 text-xs">{p.required ? <span className="text-red-500">Yes</span> : <span className="text-surface-400">No</span>}</td>
              <td className="px-4 py-2 text-xs text-surface-500">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MethodBlock({ name, description, code, params, returns }: {
  name: string;
  description: string;
  code: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  returns?: string;
}) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-5">
      <h3 className="mb-1 font-mono text-sm font-semibold text-surface-900">{name}</h3>
      <p className="mb-3 text-xs text-surface-500">{description}</p>
      <CodeExample code={code} title="example.ts" />
      {params && params.length > 0 && <ParamTable params={params} />}
      {returns && (
        <p className="mt-3 text-xs text-surface-500">
          Returns: <span className="font-mono text-surface-700">{returns}</span>
        </p>
      )}
    </div>
  );
}

function CLIBlock({ command, description, code, flags }: {
  command: string;
  description: string;
  code: string;
  flags?: { name: string; type: string; required: boolean; default?: string; description: string }[];
}) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-5">
      <h3 className="mb-1 font-mono text-sm font-semibold text-surface-900">{command}</h3>
      <p className="mb-3 text-xs text-surface-500">{description}</p>
      <CodeExample code={code} title="terminal" language="bash" />
      {flags && flags.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-surface-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Flag</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Required</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Description</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.name} className="border-b border-surface-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-surface-700">{f.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-brand-500">{f.type}</td>
                  <td className="px-4 py-2 text-xs">{f.required ? <span className="text-red-500">Yes</span> : <span className="text-surface-400">No</span>}</td>
                  <td className="px-4 py-2 text-xs text-surface-500">{f.description}{f.default ? ` (default: ${f.default})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry that's most visible in the top portion of the viewport
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -75% 0px', threshold: 0 },
    );

    for (const id of ALL_SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const sidebarRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // JS-driven sticky sidebar: track scroll and clamp sidebar within content bounds
  useEffect(() => {
    const sidebar = sidebarRef.current;
    const content = contentRef.current;
    if (!sidebar || !content) return;

    function updateSidebar() {
      if (!sidebar || !content) return;
      const contentRect = content.getBoundingClientRect();
      const navbarHeight = 80; // navbar ~h-16 + some padding

      // Content hasn't scrolled into view yet
      if (contentRect.top > navbarHeight) {
        sidebar.style.position = 'absolute';
        sidebar.style.top = '0px';
        return;
      }

      // Content has scrolled past (footer area)
      const sidebarHeight = sidebar.offsetHeight;
      if (contentRect.bottom < navbarHeight + sidebarHeight) {
        sidebar.style.position = 'absolute';
        sidebar.style.top = `${contentRect.height - sidebarHeight}px`;
        return;
      }

      // In the sweet spot — fix it
      sidebar.style.position = 'fixed';
      sidebar.style.top = `${navbarHeight}px`;
    }

    window.addEventListener('scroll', updateSidebar, { passive: true });
    window.addEventListener('resize', updateSidebar, { passive: true });
    updateSidebar();

    return () => {
      window.removeEventListener('scroll', updateSidebar);
      window.removeEventListener('resize', updateSidebar);
    };
  }, []);

  return (
    <>
      <Hero
        title="Attestify Documentation"
        subtitle="Docs"
        description="Everything you need to integrate with the Attestify protocol on Hedera testnet. SDK reference, CLI usage, contract addresses, and API endpoints."
      />

      <div className="relative mx-auto max-w-7xl px-4 py-10">
        {/* Sidebar — JS-driven positioning */}
        <div className="hidden lg:block" style={{ position: 'relative' }}>
          <nav
            ref={sidebarRef}
            className="absolute left-0 w-52 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-surface-200 bg-white p-4"
            style={{ zIndex: 10 }}
          >
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-surface-400">On this page</p>
            <ul className="space-y-1">
              {NAV_GROUPS.map((group) => {
                const Icon = group.icon;
                const groupIds = group.items.map((i) => i.id);
                const isOpen = groupIds.includes(activeSection);
                return (
                  <li key={group.label}>
                    {/* Group heading — clickable to first item */}
                    <a
                      href={`#${group.items[0].id}`}
                      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        isOpen
                          ? 'bg-brand-50 text-brand-600'
                          : 'text-surface-600 hover:bg-surface-50 hover:text-surface-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {group.label}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      )}
                    </a>
                    {/* Collapsible children */}
                    {isOpen && (
                      <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-surface-200 pl-2">
                        {group.items.map((item) => {
                          const isActive = activeSection === item.id;
                          return (
                            <li key={item.id}>
                              <a
                                href={`#${item.id}`}
                                className={`block rounded-md px-2 py-1 text-[11px] transition-colors ${
                                  isActive
                                    ? 'bg-brand-50 font-medium text-brand-600'
                                    : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700'
                                }`}
                              >
                                {item.label}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Content */}
        <div ref={contentRef} className="min-w-0 space-y-16 lg:ml-60">

          {/* ── Overview ─────────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="overview" />
            <SectionLabel text="Architecture" />
            <SectionTitle>Protocol Overview</SectionTitle>
            <SectionDesc>
              Attestify is a schema-based attestation protocol deployed on Hedera Smart Contract Service (HSCS).
              Authorities register schemas that define attestation data structures. Attesters issue signed claims
              about subjects, structured according to schemas. Anyone can verify attestation status on-chain.
            </SectionDesc>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Smart Contracts', desc: 'SchemaRegistry + AttestationService on HSCS, with pluggable resolver contracts for custom validation.', icon: Box },
                { label: 'TypeScript SDK', desc: 'Full-featured SDK wrapping all contract interactions, schema encoding, UID computation, HCS logging, and HTS operations.', icon: Cpu },
                { label: 'CLI Tool', desc: 'Command-line interface for schema registration, attestation lifecycle, authority management, and HCS audit logs.', icon: Terminal },
                { label: 'Indexer + API', desc: 'Mirror Node event indexer with PostgreSQL storage and REST API for efficient data querying.', icon: Server },
              ].map((item) => (
                <div key={item.label} className="flex gap-3 rounded-lg border border-surface-200 bg-white p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                    <item.icon className="h-4 w-4 text-brand-500" />
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-surface-900">{item.label}</h3>
                    <p className="text-xs leading-relaxed text-surface-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-lg border border-surface-200 bg-surface-50 p-4">
              <p className="mb-2 text-xs font-semibold text-surface-700">Data Flow</p>
              <p className="font-mono text-[11px] leading-relaxed text-surface-500">
                User Action → Smart Contract (HSCS) → Mirror Node → Indexer → REST API + HCS Publisher → Explorer / SDK / CLI
              </p>
            </div>
          </section>

          {/* ── Contracts ────────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="contracts" />
            <SectionLabel text="Hedera Testnet" />
            <SectionTitle>Deployed Contracts</SectionTitle>
            <SectionDesc>All contracts are deployed on Hedera Testnet (Chain ID 296). RPC: https://testnet.hashio.io/api</SectionDesc>
            <div className="overflow-hidden rounded-lg border border-surface-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">Contract</th>
                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTRACTS.map((c) => (
                    <tr key={c.name} className="border-b border-surface-100 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-surface-900">{c.name}</span>
                        <p className="text-xs text-surface-500">{c.description}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {c.address.startsWith('0x') ? (
                          <a href={`https://hashscan.io/testnet/contract/${c.address}`} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-xs text-brand-500 hover:underline">{c.address}</a>
                        ) : (
                          <span className="text-xs italic text-surface-400">{c.address}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── SDK Setup ────────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-setup" />
            <SectionLabel text="SDK" />
            <SectionTitle>Setup &amp; Configuration</SectionTitle>
            <SectionDesc>Install the SDK and initialize the service. All methods return ServiceResponse&lt;T&gt; — the SDK never throws after construction.</SectionDesc>
            <div className="space-y-4">
              <CodeExample code={SDK_INSTALL} title="terminal" language="bash" />
              <CodeExample code={SDK_SETUP} title="config.ts" />
            </div>
            <div className="mt-6 rounded-lg border border-surface-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold text-surface-700">ServiceResponse&lt;T&gt;</p>
              <p className="text-xs text-surface-500">Every SDK method returns this wrapper:</p>
              <CodeExample code={`interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: { type: AttestifyErrorType; message: string };
}`} title="types.ts" />
            </div>
            <div className="mt-4 rounded-lg border border-surface-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold text-surface-700">Error Types</p>
              <div className="flex flex-wrap gap-2">
                {['ALREADY_EXISTS', 'NOT_FOUND', 'UNAUTHORIZED', 'VALIDATION_ERROR', 'ALREADY_REVOKED', 'RESOLVER_REJECTED', 'EXPIRED', 'NETWORK_ERROR', 'CONFIGURATION_ERROR', 'TRANSACTION_ERROR', 'UNKNOWN_ERROR'].map((e) => (
                  <span key={e} className="rounded bg-surface-100 px-2 py-0.5 font-mono text-[10px] text-surface-600">{e}</span>
                ))}
              </div>
            </div>
          </section>

          {/* ── SDK Schemas ──────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-schemas" />
            <SectionLabel text="SDK" />
            <SectionTitle>Schema Operations</SectionTitle>
            <SectionDesc>Register and read schemas from the SchemaRegistry contract.</SectionDesc>
            <div className="space-y-4">
              <MethodBlock
                name="registerSchema(params)"
                description="Register a new schema on-chain. If HCS is configured, publishes schema.registered audit message."
                code={SDK_REGISTER_SCHEMA}
                params={[
                  { name: 'definition', type: 'string', required: true, description: 'Schema definition (ABI field types, e.g. "string name, uint256 age")' },
                  { name: 'revocable', type: 'boolean', required: true, description: 'Whether attestations under this schema can be revoked' },
                  { name: 'resolver', type: 'string', required: false, description: 'Resolver contract address. Defaults to zero address.' },
                ]}
                returns="ServiceResponse<{ schemaUid: string }>"
              />
              <MethodBlock
                name="getSchema(uid)"
                description="Read a schema from the contract (on-chain read, no gas)."
                code={SDK_GET_SCHEMA}
                params={[
                  { name: 'uid', type: 'string', required: true, description: 'Schema UID (bytes32 hex)' },
                ]}
                returns="ServiceResponse<SchemaRecord>"
              />
            </div>
          </section>

          {/* ── SDK Attestations ─────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-attestations" />
            <SectionLabel text="SDK" />
            <SectionTitle>Attestation Operations</SectionTitle>
            <SectionDesc>Create, read, and revoke attestations on the AttestationService contract.</SectionDesc>
            <div className="space-y-4">
              <MethodBlock
                name="createAttestation(params)"
                description="Create a new attestation. If HCS is configured, publishes attestation.created audit message."
                code={SDK_CREATE_ATTESTATION}
                params={[
                  { name: 'schemaUid', type: 'string', required: true, description: 'Schema UID to attest against (bytes32 hex)' },
                  { name: 'subject', type: 'string', required: true, description: 'Subject address the attestation is about' },
                  { name: 'data', type: 'string', required: true, description: 'ABI-encoded attestation payload (hex). Use SchemaEncoder.' },
                  { name: 'expirationTime', type: 'number', required: false, description: 'Unix timestamp for expiration. 0 = no expiration.' },
                ]}
                returns="ServiceResponse<{ attestationUid: string }>"
              />
              <MethodBlock
                name="getAttestation(uid)"
                description="Read an attestation from the contract (on-chain read, no gas)."
                code={SDK_GET_ATTESTATION}
                params={[
                  { name: 'uid', type: 'string', required: true, description: 'Attestation UID (bytes32 hex)' },
                ]}
                returns="ServiceResponse<AttestationRecord>"
              />
              <MethodBlock
                name="revokeAttestation(uid)"
                description="Revoke an attestation. Only the original attester can revoke. Schema must be revocable."
                code={SDK_REVOKE}
                params={[
                  { name: 'uid', type: 'string', required: true, description: 'Attestation UID to revoke' },
                ]}
                returns="ServiceResponse<void>"
              />
            </div>
          </section>

          {/* ── SDK Authorities ──────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-authorities" />
            <SectionLabel text="SDK" />
            <SectionTitle>Authority Operations</SectionTitle>
            <SectionDesc>Register, read, and verify authorities on the AttestationService contract.</SectionDesc>
            <div className="space-y-4">
              <MethodBlock
                name="registerAuthority(metadata)"
                description="Register the signer as an authority. Publishes authority.registered HCS message if configured."
                code={SDK_REGISTER_AUTHORITY}
                params={[
                  { name: 'metadata', type: 'string', required: true, description: 'Descriptive metadata for the authority' },
                ]}
                returns="ServiceResponse<void>"
              />
              <MethodBlock
                name="getAuthority(address)"
                description="Read authority info from the contract (on-chain read, no gas)."
                code={SDK_GET_AUTHORITY}
                params={[
                  { name: 'address', type: 'string', required: true, description: "Authority's EVM address" },
                ]}
                returns="ServiceResponse<AuthorityRecord>"
              />
              <MethodBlock
                name="setAuthorityVerification(address, verified)"
                description="Verify or unverify an authority. Admin-only (contract owner)."
                code={SDK_VERIFY_AUTHORITY}
                params={[
                  { name: 'address', type: 'string', required: true, description: 'Authority address' },
                  { name: 'verified', type: 'boolean', required: true, description: 'true to verify, false to unverify' },
                ]}
                returns="ServiceResponse<void>"
              />
            </div>
          </section>

          {/* ── SDK Delegation ────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-delegation" />
            <SectionLabel text="SDK" />
            <SectionTitle>Delegation Operations</SectionTitle>
            <SectionDesc>Delegate authority to other wallets to create attestations or revoke on your behalf. Useful for AI agents, employees, or automated systems.</SectionDesc>
            <div className="space-y-4">
              <MethodBlock
                name="addDelegate(delegate)"
                description="Add a delegate who can create attestations on your behalf."
                code={SDK_ADD_DELEGATE}
                params={[
                  { name: 'delegate', type: 'string', required: true, description: 'Address to authorize as delegate' },
                ]}
                returns="ServiceResponse<void>"
              />
              <MethodBlock
                name="removeDelegate(delegate)"
                description="Remove a delegate."
                code={SDK_REMOVE_DELEGATE}
                params={[
                  { name: 'delegate', type: 'string', required: true, description: 'Address to remove from delegates' },
                ]}
                returns="ServiceResponse<void>"
              />
              <MethodBlock
                name="isDelegate(authority, delegate)"
                description="Check if an address is a delegate of an authority."
                code={SDK_IS_DELEGATE}
                params={[
                  { name: 'authority', type: 'string', required: true, description: 'Authority address' },
                  { name: 'delegate', type: 'string', required: true, description: 'Delegate address to check' },
                ]}
                returns="ServiceResponse<{ isDelegate: boolean }>"
              />
              <MethodBlock
                name="getDelegates(authority)"
                description="Get all delegates for an authority."
                code={SDK_GET_DELEGATES}
                params={[
                  { name: 'authority', type: 'string', required: true, description: 'Authority address' },
                ]}
                returns="ServiceResponse<{ delegates: string[] }>"
              />
              <MethodBlock
                name="attestOnBehalf(params)"
                description="Create an attestation on behalf of an authority. Caller must be an authorized delegate. The attestation is recorded as coming from the authority."
                code={SDK_ATTEST_ON_BEHALF}
                params={[
                  { name: 'authority', type: 'string', required: true, description: 'Authority address you are delegating for' },
                  { name: 'schemaUid', type: 'string', required: true, description: 'Schema UID to attest against' },
                  { name: 'subject', type: 'string', required: true, description: 'Subject address' },
                  { name: 'data', type: 'string', required: true, description: 'ABI-encoded attestation data' },
                  { name: 'expirationTime', type: 'number', required: false, description: 'Unix timestamp for expiration' },
                ]}
                returns="ServiceResponse<{ attestationUid: string }>"
              />
              <MethodBlock
                name="revokeOnBehalf(attestationUid)"
                description="Revoke an attestation on behalf of the original attester. Caller must be an authorized delegate."
                code={SDK_REVOKE_ON_BEHALF}
                params={[
                  { name: 'attestationUid', type: 'string', required: true, description: 'Attestation UID to revoke' },
                ]}
                returns="ServiceResponse<void>"
              />
            </div>
          </section>

          {/* ── SDK Queries ──────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-queries" />
            <SectionLabel text="SDK" />
            <SectionTitle>Query Operations (Indexer)</SectionTitle>
            <SectionDesc>These methods query the indexer REST API. Requires the indexer to be running at the configured indexerUrl. No gas cost.</SectionDesc>
            <div className="space-y-4">
              <MethodBlock
                name="listSchemas(params?)"
                description="List schemas from the indexer, optionally filtered by authority."
                code={SDK_LIST_SCHEMAS}
                params={[
                  { name: 'authority', type: 'string', required: false, description: 'Filter by authority address' },
                  { name: 'limit', type: 'number', required: false, description: 'Max number of results' },
                  { name: 'offset', type: 'number', required: false, description: 'Pagination offset' },
                ]}
                returns="ServiceResponse<IndexedSchemaRecord[]>"
              />
              <MethodBlock
                name="listAttestations(params?)"
                description="List attestations from the indexer with multiple filter options."
                code={SDK_LIST_ATTESTATIONS}
                params={[
                  { name: 'attester', type: 'string', required: false, description: 'Filter by attester address' },
                  { name: 'subject', type: 'string', required: false, description: 'Filter by subject address' },
                  { name: 'schemaUid', type: 'string', required: false, description: 'Filter by schema UID' },
                  { name: 'revoked', type: 'boolean', required: false, description: 'Filter by revocation status' },
                  { name: 'limit', type: 'number', required: false, description: 'Max number of results' },
                  { name: 'offset', type: 'number', required: false, description: 'Pagination offset' },
                ]}
                returns="ServiceResponse<IndexedAttestationRecord[]>"
              />
              <MethodBlock
                name="getProfile(address)"
                description="Aggregated profile — authority status, schemas, attestations issued and received. Makes 4 parallel indexer requests."
                code={SDK_GET_PROFILE}
                params={[
                  { name: 'address', type: 'string', required: true, description: 'Wallet address to look up' },
                ]}
                returns="ServiceResponse<ProfileSummary>"
              />
            </div>
          </section>

          {/* ── SDK Resolvers ────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-resolvers" />
            <SectionLabel text="SDK" />
            <SectionTitle>Resolver Operations</SectionTitle>
            <SectionDesc>Interact with WhitelistResolver, FeeResolver, and TokenGatedResolver contracts. Requires resolverAddresses in config.</SectionDesc>

            <h3 className="mb-3 text-sm font-semibold text-surface-900">WhitelistResolver</h3>
            <div className="mb-6 space-y-4">
              <MethodBlock name="whitelistAdd(account)" description="Add an address to the whitelist (admin only)." code={SDK_WHITELIST_ADD}
                params={[{ name: 'account', type: 'string', required: true, description: 'Address to whitelist' }]} returns="ServiceResponse<void>" />
              <MethodBlock name="whitelistRemove(account)" description="Remove an address from the whitelist (admin only)." code={SDK_WHITELIST_REMOVE}
                params={[{ name: 'account', type: 'string', required: true, description: 'Address to remove' }]} returns="ServiceResponse<void>" />
              <MethodBlock name="whitelistCheck(account)" description="Check if an address is whitelisted (read-only, no gas)." code={SDK_WHITELIST_CHECK}
                params={[{ name: 'account', type: 'string', required: true, description: 'Address to check' }]} returns="ServiceResponse<{ whitelisted: boolean }>" />
              <MethodBlock name="whitelistOwner()" description="Get the resolver contract owner address." code={SDK_WHITELIST_OWNER} returns="ServiceResponse<{ owner: string }>" />
            </div>

            <h3 className="mb-3 text-sm font-semibold text-surface-900">FeeResolver</h3>
            <div className="mb-6 space-y-4">
              <MethodBlock name="feeDeposit(amountHbar)" description="Deposit HBAR into the fee resolver to pre-fund attestation fees." code={SDK_FEE_DEPOSIT}
                params={[{ name: 'amountHbar', type: 'string', required: true, description: 'Amount of HBAR to deposit (e.g. "10")' }]} returns="ServiceResponse<void>" />
              <MethodBlock name="feeSetFee(amountWei)" description="Set the attestation fee amount (admin only)." code={SDK_FEE_SET}
                params={[{ name: 'amountWei', type: 'string', required: true, description: 'Fee amount in wei/tinybar' }]} returns="ServiceResponse<void>" />
              <MethodBlock name="feeWithdraw()" description="Withdraw collected fees from the contract (admin only)." code={SDK_FEE_WITHDRAW} returns="ServiceResponse<void>" />
              <MethodBlock name="feeGetFee()" description="Read the current attestation fee (read-only, no gas)." code={SDK_FEE_GET} returns="ServiceResponse<{ fee: string }>" />
              <MethodBlock name="feeGetBalance(account)" description="Check how much HBAR an address has deposited." code={SDK_FEE_BALANCE}
                params={[{ name: 'account', type: 'string', required: true, description: 'Address to check balance for' }]} returns="ServiceResponse<{ balance: string }>" />
            </div>

            <h3 className="mb-3 text-sm font-semibold text-surface-900">TokenGatedResolver</h3>
            <div className="space-y-4">
              <MethodBlock name="tokenGatedSetConfig(tokenAddress, minimumBalance)" description="Configure which HTS token and minimum balance is required (admin only)." code={SDK_TOKEN_SET}
                params={[
                  { name: 'tokenAddress', type: 'string', required: true, description: 'HTS token contract address' },
                  { name: 'minimumBalance', type: 'string', required: true, description: 'Minimum token balance required' },
                ]} returns="ServiceResponse<void>" />
              <MethodBlock name="tokenGatedGetConfig()" description="Read the current token gate configuration (read-only, no gas)." code={SDK_TOKEN_GET}
                returns="ServiceResponse<{ tokenAddress: string; minimumBalance: string }>" />
            </div>
          </section>

          {/* ── SDK Token Reward ──────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-token-reward" />
            <SectionLabel text="SDK" />
            <SectionTitle>Token Reward Resolver</SectionTitle>
            <SectionDesc>Configure a resolver that automatically rewards attestation subjects with HTS tokens. When someone receives an attestation, they get tokens.</SectionDesc>
            <div className="space-y-4">
              <MethodBlock name="tokenRewardSetConfig(resolverAddress, rewardToken, rewardAmount)" description="Set the reward token and amount per attestation. Admin-only." code={SDK_TOKEN_REWARD_SET}
                params={[
                  { name: 'resolverAddress', type: 'string', required: true, description: 'TokenRewardResolver contract address' },
                  { name: 'rewardToken', type: 'string', required: true, description: 'HTS reward token address' },
                  { name: 'rewardAmount', type: 'string', required: true, description: 'Amount per attestation' },
                ]} returns="ServiceResponse<void>" />
              <MethodBlock name="tokenRewardGetConfig(resolverAddress)" description="Get the current reward configuration." code={SDK_TOKEN_REWARD_GET}
                params={[
                  { name: 'resolverAddress', type: 'string', required: true, description: 'TokenRewardResolver contract address' },
                ]} returns="ServiceResponse<{ rewardToken: string; rewardAmount: string }>" />
              <MethodBlock name="tokenRewardGetDistributed(resolverAddress, subject)" description="Check total rewards distributed to a subject." code={SDK_TOKEN_REWARD_DISTRIBUTED}
                params={[
                  { name: 'resolverAddress', type: 'string', required: true, description: 'TokenRewardResolver contract address' },
                  { name: 'subject', type: 'string', required: true, description: 'Subject address to check' },
                ]} returns="ServiceResponse<{ distributed: string }>" />
            </div>
          </section>

          {/* ── SDK Cross-Contract ────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-cross-contract" />
            <SectionLabel text="SDK" />
            <SectionTitle>Cross-Contract Resolver</SectionTitle>
            <SectionDesc>Pipeline resolver that chains multiple resolvers in sequence. All must approve for the attestation to proceed.</SectionDesc>
            <div className="space-y-4">
              <MethodBlock name="crossContractSetPipeline(resolverAddress, resolvers)" description="Set the resolver pipeline. Admin-only." code={SDK_CROSS_SET_PIPELINE}
                params={[
                  { name: 'resolverAddress', type: 'string', required: true, description: 'CrossContractResolver contract address' },
                  { name: 'resolvers', type: 'string[]', required: true, description: 'Ordered array of resolver addresses' },
                ]} returns="ServiceResponse<void>" />
              <MethodBlock name="crossContractGetPipeline(resolverAddress)" description="Get the current resolver pipeline." code={SDK_CROSS_GET_PIPELINE}
                params={[
                  { name: 'resolverAddress', type: 'string', required: true, description: 'CrossContractResolver contract address' },
                ]} returns="ServiceResponse<{ pipeline: string[] }>" />
            </div>
          </section>

          {/* ── SDK NFT Minting ─────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-nft" />
            <SectionLabel text="SDK" />
            <SectionTitle>HTS NFT Minting</SectionTitle>
            <SectionDesc>Mint an HTS non-fungible token as a credential for a successful attestation. The attestation UID is embedded in the NFT metadata.</SectionDesc>
            <div className="space-y-4">
              <MethodBlock name="mintNFT(params)" description="Mint an HTS NFT credential. Requires the Hedera client to have the token's supply key." code={SDK_MINT_NFT}
                params={[
                  { name: 'subject', type: 'string', required: true, description: 'Subject address to receive the NFT' },
                  { name: 'attestationUid', type: 'string', required: true, description: 'Attestation UID to embed in metadata' },
                  { name: 'tokenId', type: 'string', required: true, description: 'HTS token ID for the NFT collection (e.g. 0.0.12345)' },
                ]} returns="ServiceResponse<{ serialNumber: number }>" />
            </div>
          </section>

          {/* ── SDK Utilities ────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-utilities" />
            <SectionLabel text="SDK" />
            <SectionTitle>Utilities &amp; Exports</SectionTitle>
            <SectionDesc>Schema encoding, UID computation, standalone indexer client, and default constants.</SectionDesc>
            <div className="space-y-4">
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <h3 className="mb-1 font-mono text-sm font-semibold text-surface-900">SchemaEncoder &amp; parseSchema</h3>
                <p className="mb-3 text-xs text-surface-500">Encode/decode attestation data according to a schema definition.</p>
                <CodeExample code={SDK_SCHEMA_ENCODER} title="encoding.ts" />
              </div>
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <h3 className="mb-1 font-mono text-sm font-semibold text-surface-900">computeSchemaUid &amp; computeAttestationUid</h3>
                <p className="mb-3 text-xs text-surface-500">Compute deterministic UIDs (same algorithm as the contracts).</p>
                <CodeExample code={SDK_UID_COMPUTE} title="uid.ts" />
              </div>
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <h3 className="mb-1 font-mono text-sm font-semibold text-surface-900">IndexerClient</h3>
                <p className="mb-3 text-xs text-surface-500">Standalone indexer client — no private key needed. Alternative to HederaAttestService query methods.</p>
                <CodeExample code={SDK_INDEXER_CLIENT} title="client.ts" />
              </div>
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <h3 className="mb-1 font-mono text-sm font-semibold text-surface-900">Default Constants</h3>
                <p className="mb-3 text-xs text-surface-500">Pre-configured defaults for Hedera testnet.</p>
                <CodeExample code={SDK_CONSTANTS} title="constants.ts" />
              </div>
            </div>
          </section>

          {/* ── CLI Reference ────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli" />
            <SectionLabel text="CLI" />
            <SectionTitle>CLI Setup &amp; Global Options</SectionTitle>
            <SectionDesc>Command-line tool wrapping the SDK. All commands use HederaAttestService internally.</SectionDesc>
            <CodeExample code={CLI_SETUP} title="terminal" language="bash" />
            <div className="mt-4 overflow-hidden rounded-lg border border-surface-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Variable</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Required</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'HEDERA_ACCOUNT_ID', req: true, desc: 'Hedera operator account ID (e.g. 0.0.7284771)' },
                    { name: 'HEDERA_PRIVATE_KEY', req: true, desc: 'ECDSA private key (hex, no 0x prefix)' },
                    { name: 'INDEXER_URL', req: false, desc: 'Indexer API URL (default: http://localhost:3001/api)' },
                    { name: 'HCS_TOPIC_SCHEMAS', req: false, desc: 'HCS topic ID for schema audit messages' },
                    { name: 'HCS_TOPIC_ATTESTATIONS', req: false, desc: 'HCS topic ID for attestation audit messages' },
                    { name: 'HCS_TOPIC_AUTHORITIES', req: false, desc: 'HCS topic ID for authority audit messages' },
                  ].map((v) => (
                    <tr key={v.name} className="border-b border-surface-100 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs text-surface-700">{v.name}</td>
                      <td className="px-4 py-2 text-xs">{v.req ? <span className="text-red-500">Yes</span> : <span className="text-surface-400">No</span>}</td>
                      <td className="px-4 py-2 text-xs text-surface-500">{v.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-surface-500">
              Global flag: <span className="font-mono text-surface-700">--json</span> outputs all results as machine-readable JSON.
            </p>
          </section>

          {/* ── CLI Schema ───────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-schema" />
            <SectionLabel text="CLI" />
            <SectionTitle>Schema Commands</SectionTitle>
            <div className="space-y-4">
              <CLIBlock
                command="attestify schema create"
                description="Register a new schema on-chain."
                code={CLI_SCHEMA_CREATE}
                flags={[
                  { name: '--definition', type: 'string', required: true, description: 'Schema definition (ABI field types). Required unless --file.' },
                  { name: '--revocable', type: 'boolean', required: false, default: 'false', description: 'Whether attestations can be revoked' },
                  { name: '--resolver', type: 'string', required: false, description: 'Resolver contract address' },
                  { name: '--file', type: 'string', required: false, description: 'Path to JSON file with { definition, revocable, resolver }' },
                ]}
              />
              <CLIBlock
                command="attestify schema fetch"
                description="Get a schema by UID (reads from on-chain contract)."
                code={CLI_SCHEMA_FETCH}
                flags={[
                  { name: '--uid', type: 'string', required: true, description: 'Schema UID (bytes32 hex)' },
                ]}
              />
              <CLIBlock
                command="attestify schema list"
                description="List schemas from the indexer."
                code={CLI_SCHEMA_LIST}
                flags={[
                  { name: '--authority', type: 'string', required: false, description: 'Filter by authority address' },
                  { name: '--limit', type: 'number', required: false, default: '25', description: 'Max number of results' },
                ]}
              />
            </div>
          </section>

          {/* ── CLI Attestation ──────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-attestation" />
            <SectionLabel text="CLI" />
            <SectionTitle>Attestation Commands</SectionTitle>
            <div className="space-y-4">
              <CLIBlock
                command="attestify attestation create"
                description="Create a new attestation on-chain."
                code={CLI_ATT_CREATE}
                flags={[
                  { name: '--schema-uid', type: 'string', required: true, description: 'Schema UID to attest against' },
                  { name: '--subject', type: 'string', required: true, description: 'Subject address' },
                  { name: '--data', type: 'string', required: true, description: 'ABI-encoded attestation data (hex)' },
                  { name: '--expiration', type: 'number', required: false, default: '0', description: 'Unix timestamp for expiration' },
                  { name: '--file', type: 'string', required: false, description: 'Path to JSON file with params' },
                ]}
              />
              <CLIBlock
                command="attestify attestation fetch"
                description="Get an attestation by UID (reads from on-chain contract)."
                code={CLI_ATT_FETCH}
                flags={[
                  { name: '--uid', type: 'string', required: true, description: 'Attestation UID (bytes32 hex)' },
                ]}
              />
              <CLIBlock
                command="attestify attestation list"
                description="List attestations from the indexer with filters."
                code={CLI_ATT_LIST}
                flags={[
                  { name: '--attester', type: 'string', required: false, description: 'Filter by attester address' },
                  { name: '--subject', type: 'string', required: false, description: 'Filter by subject address' },
                  { name: '--schema-uid', type: 'string', required: false, description: 'Filter by schema UID' },
                  { name: '--limit', type: 'number', required: false, default: '25', description: 'Max number of results' },
                ]}
              />
              <CLIBlock
                command="attestify attestation revoke"
                description="Revoke an attestation (must be original attester, schema must be revocable)."
                code={CLI_ATT_REVOKE}
                flags={[
                  { name: '--uid', type: 'string', required: true, description: 'Attestation UID to revoke' },
                ]}
              />
            </div>
          </section>

          {/* ── CLI Authority ────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-authority" />
            <SectionLabel text="CLI" />
            <SectionTitle>Authority Commands</SectionTitle>
            <div className="space-y-4">
              <CLIBlock
                command="attestify authority register"
                description="Register the signer as an authority."
                code={CLI_AUTH_REGISTER}
                flags={[
                  { name: '--metadata', type: 'string', required: true, description: 'Descriptive metadata for the authority' },
                ]}
              />
              <CLIBlock
                command="attestify authority fetch"
                description="Get authority info by address (reads from on-chain contract)."
                code={CLI_AUTH_FETCH}
                flags={[
                  { name: '--address', type: 'string', required: true, description: 'Authority address' },
                ]}
              />
              <CLIBlock
                command="attestify authority verify"
                description="Verify or unverify an authority (admin only — contract owner)."
                code={CLI_AUTH_VERIFY}
                flags={[
                  { name: '--address', type: 'string', required: true, description: 'Authority address to verify/unverify' },
                  { name: '--revoke', type: 'boolean', required: false, default: 'false', description: 'Unverify instead of verifying' },
                ]}
              />
            </div>
          </section>

          {/* ── CLI Delegation ────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-delegation" />
            <SectionLabel text="CLI" />
            <SectionTitle>Delegation Commands</SectionTitle>
            <SectionDesc>Manage delegates and create/revoke attestations on behalf of authorities.</SectionDesc>
            <div className="space-y-4">
              <CLIBlock command="attestify delegate add" description="Add a delegate who can attest/revoke on your behalf." code={CLI_DELEGATE_ADD}
                flags={[{ name: '--address', type: 'string', required: true, description: 'Delegate address to authorize' }]} />
              <CLIBlock command="attestify delegate remove" description="Remove a delegate." code={CLI_DELEGATE_REMOVE}
                flags={[{ name: '--address', type: 'string', required: true, description: 'Delegate address to remove' }]} />
              <CLIBlock command="attestify delegate check" description="Check if an address is a delegate of an authority." code={CLI_DELEGATE_CHECK}
                flags={[
                  { name: '--authority', type: 'string', required: true, description: 'Authority address' },
                  { name: '--delegate', type: 'string', required: true, description: 'Delegate address to check' },
                ]} />
              <CLIBlock command="attestify delegate list" description="List all delegates for an authority." code={CLI_DELEGATE_LIST}
                flags={[{ name: '--authority', type: 'string', required: true, description: 'Authority address' }]} />
              <CLIBlock command="attestify delegate attest" description="Create an attestation on behalf of an authority (delegated)." code={CLI_DELEGATE_ATTEST}
                flags={[
                  { name: '--authority', type: 'string', required: true, description: 'Authority address you are delegating for' },
                  { name: '--schema-uid', type: 'string', required: true, description: 'Schema UID' },
                  { name: '--subject', type: 'string', required: true, description: 'Subject address' },
                  { name: '--data', type: 'string', required: true, description: 'ABI-encoded attestation data (hex)' },
                  { name: '--expiration', type: 'number', required: false, description: 'Expiration timestamp' },
                ]} />
              <CLIBlock command="attestify delegate revoke" description="Revoke an attestation on behalf of the original attester." code={CLI_DELEGATE_REVOKE}
                flags={[{ name: '--uid', type: 'string', required: true, description: 'Attestation UID to revoke' }]} />
            </div>
          </section>

          {/* ── CLI Profile ──────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-profile" />
            <SectionLabel text="CLI" />
            <SectionTitle>Profile Command</SectionTitle>
            <div className="space-y-4">
              <CLIBlock
                command="attestify profile"
                description="View a complete profile for any address — authority status, schemas, attestations issued and received."
                code={CLI_PROFILE}
                flags={[
                  { name: '--address', type: 'string', required: true, description: 'Wallet address to look up' },
                ]}
              />
            </div>
          </section>

          {/* ── CLI Resolvers ────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-resolvers" />
            <SectionLabel text="CLI" />
            <SectionTitle>Resolver Commands</SectionTitle>
            <SectionDesc>Manage WhitelistResolver, FeeResolver, and TokenGatedResolver contracts from the CLI. Resolver addresses are auto-configured for testnet.</SectionDesc>

            <h3 className="mb-3 text-sm font-semibold text-surface-900">Whitelist</h3>
            <div className="mb-6 space-y-4">
              <CLIBlock command="attestify whitelist add" description="Add an address to the whitelist (admin only)." code={CLI_WHITELIST_ADD}
                flags={[{ name: '--account', type: 'string', required: true, description: 'Address to whitelist' }]} />
              <CLIBlock command="attestify whitelist remove" description="Remove an address from the whitelist (admin only)." code={CLI_WHITELIST_REMOVE}
                flags={[{ name: '--account', type: 'string', required: true, description: 'Address to remove' }]} />
              <CLIBlock command="attestify whitelist check" description="Check if an address is whitelisted." code={CLI_WHITELIST_CHECK}
                flags={[{ name: '--account', type: 'string', required: true, description: 'Address to check' }]} />
              <CLIBlock command="attestify whitelist owner" description="Get the whitelist resolver owner." code={CLI_WHITELIST_OWNER} />
            </div>

            <h3 className="mb-3 text-sm font-semibold text-surface-900">Fee</h3>
            <div className="mb-6 space-y-4">
              <CLIBlock command="attestify fee deposit" description="Deposit HBAR into the fee resolver." code={CLI_FEE_DEPOSIT}
                flags={[{ name: '--amount', type: 'string', required: true, description: 'Amount of HBAR to deposit' }]} />
              <CLIBlock command="attestify fee set-fee" description="Set the attestation fee (admin only)." code={CLI_FEE_SET}
                flags={[{ name: '--amount', type: 'string', required: true, description: 'Fee amount in wei/tinybar' }]} />
              <CLIBlock command="attestify fee withdraw" description="Withdraw collected fees (admin only)." code={CLI_FEE_WITHDRAW} />
              <CLIBlock command="attestify fee get-fee" description="Get the current attestation fee." code={CLI_FEE_GET} />
              <CLIBlock command="attestify fee balance" description="Check deposited balance for an address." code={CLI_FEE_BALANCE}
                flags={[{ name: '--account', type: 'string', required: true, description: 'Address to check' }]} />
              <CLIBlock command="attestify fee owner" description="Get the fee resolver owner." code={CLI_FEE_OWNER} />
            </div>

            <h3 className="mb-3 text-sm font-semibold text-surface-900">Token Gated</h3>
            <div className="space-y-4">
              <CLIBlock command="attestify token-gated set-config" description="Set token address and minimum balance (admin only)." code={CLI_TOKEN_SET}
                flags={[
                  { name: '--token', type: 'string', required: true, description: 'HTS token address' },
                  { name: '--min-balance', type: 'string', required: true, description: 'Minimum token balance required' },
                ]} />
              <CLIBlock command="attestify token-gated get-config" description="Get current token gate configuration." code={CLI_TOKEN_GET} />
              <CLIBlock command="attestify token-gated owner" description="Get the token gated resolver owner." code={CLI_TOKEN_OWNER} />
            </div>
          </section>

          {/* ── CLI Token Reward ──────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-token-reward" />
            <SectionLabel text="CLI" />
            <SectionTitle>Token Reward Commands</SectionTitle>
            <SectionDesc>Manage the TokenRewardResolver — configure reward tokens and check distributions.</SectionDesc>
            <div className="space-y-4">
              <CLIBlock command="attestify token-reward set-config" description="Set reward token and amount per attestation (admin only)." code={CLI_TOKEN_REWARD_SET}
                flags={[
                  { name: '--resolver', type: 'string', required: true, description: 'TokenRewardResolver contract address' },
                  { name: '--token', type: 'string', required: true, description: 'HTS reward token address' },
                  { name: '--amount', type: 'string', required: true, description: 'Reward amount per attestation' },
                ]} />
              <CLIBlock command="attestify token-reward get-config" description="Get current reward configuration." code={CLI_TOKEN_REWARD_GET}
                flags={[{ name: '--resolver', type: 'string', required: true, description: 'TokenRewardResolver contract address' }]} />
              <CLIBlock command="attestify token-reward distributed" description="Check total rewards distributed to a subject." code={CLI_TOKEN_REWARD_DISTRIBUTED}
                flags={[
                  { name: '--resolver', type: 'string', required: true, description: 'TokenRewardResolver contract address' },
                  { name: '--subject', type: 'string', required: true, description: 'Subject address to check' },
                ]} />
            </div>
          </section>

          {/* ── CLI Cross-Contract ────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-cross-contract" />
            <SectionLabel text="CLI" />
            <SectionTitle>Cross-Contract Commands</SectionTitle>
            <SectionDesc>Manage the CrossContractResolver pipeline — chain multiple resolvers in sequence.</SectionDesc>
            <div className="space-y-4">
              <CLIBlock command="attestify cross-contract set-pipeline" description="Set the resolver pipeline (admin only)." code={CLI_CROSS_SET}
                flags={[
                  { name: '--resolver', type: 'string', required: true, description: 'CrossContractResolver contract address' },
                  { name: '--resolvers', type: 'string', required: true, description: 'Comma-separated list of resolver addresses' },
                ]} />
              <CLIBlock command="attestify cross-contract get-pipeline" description="Get the current resolver pipeline." code={CLI_CROSS_GET}
                flags={[{ name: '--resolver', type: 'string', required: true, description: 'CrossContractResolver contract address' }]} />
            </div>
          </section>

          {/* ── CLI NFT Mint ─────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-nft" />
            <SectionLabel text="CLI" />
            <SectionTitle>NFT Mint Command</SectionTitle>
            <div className="space-y-4">
              <CLIBlock
                command="attestify nft-mint"
                description="Mint an HTS NFT credential for an attestation. Embeds the attestation UID in the NFT metadata."
                code={CLI_NFT_MINT}
                flags={[
                  { name: '--subject', type: 'string', required: true, description: 'Subject address to receive the NFT' },
                  { name: '--attestation-uid', type: 'string', required: true, description: 'Attestation UID to embed in metadata' },
                  { name: '--token-id', type: 'string', required: true, description: 'HTS token ID for the NFT collection' },
                ]}
              />
            </div>
          </section>

          {/* ── CLI HCS ──────────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-hcs" />
            <SectionLabel text="CLI" />
            <SectionTitle>HCS Commands</SectionTitle>
            <div className="space-y-4">
              <CLIBlock
                command="attestify hcs topics"
                description="List configured HCS topic IDs and their HashScan URLs."
                code={CLI_HCS_TOPICS}
              />
              <CLIBlock
                command="attestify hcs messages"
                description="Fetch HCS audit messages from a specific topic (reads from Hedera Mirror Node)."
                code={CLI_HCS_MESSAGES}
                flags={[
                  { name: '--topic', type: 'string', required: true, description: 'HCS topic ID (e.g. 0.0.8221946)' },
                  { name: '--limit', type: 'number', required: false, default: '25', description: 'Number of messages (max 100)' },
                  { name: '--order', type: 'string', required: false, default: 'desc', description: 'Sort: asc (oldest first) or desc (newest first)' },
                ]}
              />
            </div>
          </section>

          {/* ── HCS Audit Trail ──────────────────────────────────────── */}
          <section>
            <SectionAnchor id="hcs" />
            <SectionLabel text="Hedera Consensus Service" />
            <SectionTitle>HCS Audit Trail</SectionTitle>
            <SectionDesc>
              HCS provides an immutable, consensus-timestamped log of all protocol events. It runs alongside the Mirror Node indexer — additive, never a replacement.
            </SectionDesc>

            <h3 className="mb-3 text-sm font-semibold text-surface-900">Global Topics</h3>
            <div className="mb-6 overflow-hidden rounded-lg border border-surface-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Topic</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {HCS_TOPICS.map((t) => (
                    <tr key={t.id} className="border-b border-surface-100 last:border-0">
                      <td className="px-4 py-2 text-xs font-medium text-surface-900">{t.name}</td>
                      <td className="px-4 py-2">
                        <a href={`https://hashscan.io/testnet/topic/${t.id}`} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-xs text-brand-500 hover:underline">{t.id}</a>
                      </td>
                      <td className="px-4 py-2 text-xs text-surface-500">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mb-3 text-sm font-semibold text-surface-900">Per-Schema Topics</h3>
            <div className="mb-6 rounded-lg border border-surface-200 bg-white p-4 text-xs leading-relaxed text-surface-500">
              <p>Each schema gets its own HCS topic, created automatically by the indexer when a schema is registered. Contains all activity for that schema: registration, attestations, revocations, resolver events.</p>
              <p className="mt-2">Per-schema topics are an indexer-only feature — SDK/CLI only publish to global topics. Topic ID is stored in the database (<span className="font-mono text-surface-700">hcsTopicId</span> column).</p>
            </div>

            <h3 className="mb-3 text-sm font-semibold text-surface-900">Message Format</h3>
            <CodeExample code={HCS_MESSAGE_FORMAT} title="HCS message" language="json" />

            <div className="mt-4 overflow-hidden rounded-lg border border-surface-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Message Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Published When</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { type: 'schema.registered', when: 'New schema created' },
                    { type: 'attestation.created', when: 'New attestation created (includes decodedData)' },
                    { type: 'attestation.revoked', when: 'Attestation revoked' },
                    { type: 'authority.registered', when: 'New authority registered' },
                    { type: 'authority.verified', when: 'Authority verification changed' },
                  ].map((m) => (
                    <tr key={m.type} className="border-b border-surface-100 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs text-surface-700">{m.type}</td>
                      <td className="px-4 py-2 text-xs text-surface-500">{m.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Indexer API ───────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="indexer" />
            <SectionLabel text="Indexer" />
            <SectionTitle>REST API Endpoints</SectionTitle>
            <SectionDesc>The indexer polls the Hedera Mirror Node for contract events, stores them in PostgreSQL, and exposes a REST API.</SectionDesc>
            <div className="overflow-hidden rounded-lg border border-surface-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">Method</th>
                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">Endpoint</th>
                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">Description</th>
                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">Query Params</th>
                  </tr>
                </thead>
                <tbody>
                  {API_ENDPOINTS.map((ep) => (
                    <tr key={ep.path} className="border-b border-surface-100 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs text-brand-500">{ep.method}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-surface-600">{ep.path}</td>
                      <td className="px-4 py-2.5 text-xs text-surface-500">{ep.description}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-surface-400">{ep.params || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Resolvers ────────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="resolvers" />
            <SectionLabel text="Contracts" />
            <SectionTitle>Resolver Contracts</SectionTitle>
            <SectionDesc>Optional smart contracts that run validation logic when attestations are created. Attach a resolver to a schema during registration.</SectionDesc>
            <div className="space-y-4">
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <div className="mb-1 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-brand-500" />
                  <h3 className="text-sm font-semibold text-surface-900">WhitelistResolver</h3>
                </div>
                <p className="mb-2 text-xs text-surface-500">Only whitelisted addresses can create attestations under this schema. Admin manages the whitelist.</p>
                <p className="font-mono text-xs text-surface-400">0x461349A8aEfB220A48b61923095DfF237465c27A</p>
              </div>
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <div className="mb-1 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-surface-900">FeeResolver</h3>
                </div>
                <p className="mb-2 text-xs text-surface-500">Requires HBAR deposit to create an attestation. Fee amount is configurable by the admin.</p>
                <p className="font-mono text-xs text-surface-400">0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C</p>
              </div>
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <div className="mb-1 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-surface-900">TokenGatedResolver</h3>
                </div>
                <p className="mb-2 text-xs text-surface-500">Requires the attester to hold a specific HTS token with a minimum balance. Admin configures token ID and threshold.</p>
                <p className="font-mono text-xs text-surface-400">0x7d04a83cF73CD4853dB4E378DD127440d444718c</p>
              </div>
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <div className="mb-1 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-surface-900">TokenRewardResolver</h3>
                </div>
                <p className="mb-2 text-xs text-surface-500">Automatically rewards attestation subjects with HTS tokens. Configurable reward token and amount per attestation. Deploy per-instance.</p>
                <p className="font-mono text-xs text-surface-400">Deploy your own instance</p>
              </div>
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <div className="mb-1 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-surface-900">CrossContractResolver</h3>
                </div>
                <p className="mb-2 text-xs text-surface-500">Pipeline resolver that chains multiple resolvers in sequence. All must approve for the attestation to proceed. Deploy per-instance.</p>
                <p className="font-mono text-xs text-surface-400">Deploy your own instance</p>
              </div>
            </div>
          </section>

          {/* ── Schema Types ─────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="schema-types" />
            <SectionLabel text="Reference" />
            <SectionTitle>Supported Schema Types</SectionTitle>
            <SectionDesc>All Solidity ABI types are supported in schema definitions.</SectionDesc>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { category: 'Integers', types: 'uint8–uint256, int8–int256' },
                { category: 'Address & Bool', types: 'address, bool' },
                { category: 'Bytes', types: 'bytes, bytes1–bytes32' },
                { category: 'String', types: 'string' },
                { category: 'Arrays', types: 'uint256[], address[], string[], bytes32[]' },
                { category: 'Tuples', types: '(address,uint256), nested tuples' },
              ].map((t) => (
                <div key={t.category} className="rounded-lg border border-surface-200 bg-white p-4">
                  <h3 className="mb-1 text-xs font-semibold text-surface-900">{t.category}</h3>
                  <p className="font-mono text-xs text-surface-500">{t.types}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Hedera Native: HCS Proof ────────────────────────────── */}
          <section>
            <SectionAnchor id="hedera-hcs-proof" />
            <SectionLabel text="Hedera Native" />
            <SectionTitle>HCS Attestation Proof</SectionTitle>
            <SectionDesc>
              Verify an attestation&apos;s existence using its HCS consensus timestamp — an immutable, Hedera-native notarization proof.
              HCS provides consensus-ordered timestamps that are independent of the smart contract, proving the attestation existed at an exact moment.
            </SectionDesc>
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-5">
                <h3 className="mb-2 text-sm font-semibold text-green-900">How it works</h3>
                <ol className="list-inside list-decimal space-y-1 text-xs text-green-700">
                  <li>When an attestation is created, the indexer publishes an HCS message to the global attestation topic</li>
                  <li>The HCS message receives a consensus timestamp from the Hedera network</li>
                  <li>Anyone can verify the attestation existed at that exact moment by querying the HCS topic</li>
                  <li>The consensus timestamp cannot be forged or backdated — it&apos;s assigned by the network</li>
                </ol>
              </div>
              <div className="rounded-lg border border-surface-200 bg-white p-5">
                <p className="mb-2 text-xs text-surface-500">No SDK/CLI needed — query the Mirror Node REST API directly:</p>
                <CodeExample code={`GET https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.8221946/messages?limit=100&order=desc`} title="Mirror Node API" language="bash" />
              </div>
            </div>
          </section>

          {/* ── Hedera Native: HTS NFT ───────────────────────────────── */}
          <section>
            <SectionAnchor id="hedera-nft" />
            <SectionLabel text="Hedera Native" />
            <SectionTitle>HTS NFT Credentials</SectionTitle>
            <SectionDesc>
              Mint Hedera Token Service (HTS) NFTs as verifiable credentials for attestations. HTS is a native token service — not an ERC-721 smart contract — with lower gas costs and native royalty support.
            </SectionDesc>
            <div className="space-y-4">
              <MethodBlock
                name="mintNFT(params)"
                description="Mint an HTS NFT credential. The attestation UID is embedded in the NFT metadata. Requires the Hedera client to have the token's supply key."
                code={SDK_MINT_NFT}
                params={[
                  { name: 'subject', type: 'string', required: true, description: 'Subject address to receive the NFT' },
                  { name: 'attestationUid', type: 'string', required: true, description: 'Attestation UID to embed in metadata' },
                  { name: 'tokenId', type: 'string', required: true, description: 'HTS token ID for the NFT collection (e.g. 0.0.12345)' },
                ]}
                returns="ServiceResponse<{ serialNumber: number }>"
              />
              <CLIBlock
                command="attestify nft-mint"
                description="Mint an HTS NFT credential from the CLI."
                code={CLI_NFT_MINT}
                flags={[
                  { name: '--subject', type: 'string', required: true, description: 'Subject address' },
                  { name: '--attestation-uid', type: 'string', required: true, description: 'Attestation UID' },
                  { name: '--token-id', type: 'string', required: true, description: 'HTS token ID' },
                ]}
              />
            </div>
          </section>

          {/* ── Hedera Native: Scheduled Revocation ──────────────────── */}
          <section>
            <SectionAnchor id="hedera-scheduled" />
            <SectionLabel text="Hedera Native" />
            <SectionTitle>Scheduled Revocation</SectionTitle>
            <SectionDesc>
              Schedule automatic attestation revocations using Hedera&apos;s native Scheduled Transactions. No cron jobs, no off-chain automation — pure on-chain scheduled execution.
            </SectionDesc>
            <div className="space-y-4">
              <MethodBlock
                name="scheduleRevocation(params)"
                description="Schedule an automatic revocation at a future time using Hedera's ScheduleCreateTransaction."
                code={SDK_SCHEDULE_REVOKE}
                params={[
                  { name: 'attestationUid', type: 'string', required: true, description: 'Attestation UID to revoke' },
                  { name: 'executeAt', type: 'number', required: true, description: 'Unix timestamp (seconds) when revocation should execute' },
                ]}
                returns="ServiceResponse<{ scheduleId: string; transactionId: string }>"
              />
              <MethodBlock
                name="getScheduledRevocation(scheduleId)"
                description="Check the status of a scheduled revocation."
                code={SDK_SCHEDULE_STATUS}
                params={[
                  { name: 'scheduleId', type: 'string', required: true, description: 'Hedera Schedule ID (e.g. 0.0.12345)' },
                ]}
                returns="ServiceResponse<ScheduledRevocationInfo>"
              />
              <CLIBlock
                command="attestify schedule revoke"
                description="Schedule an automatic revocation from the CLI."
                code={CLI_SCHEDULE_REVOKE}
                flags={[
                  { name: '--uid', type: 'string', required: true, description: 'Attestation UID to revoke' },
                  { name: '--execute-at', type: 'number', required: true, description: 'Unix timestamp for execution' },
                ]}
              />
              <CLIBlock
                command="attestify schedule status"
                description="Check the status of a scheduled revocation."
                code={CLI_SCHEDULE_STATUS}
                flags={[
                  { name: '--schedule-id', type: 'string', required: true, description: 'Hedera Schedule ID' },
                ]}
              />
            </div>
          </section>

          {/* ── Hedera Native: Multi-Sig Authority ────────────────── */}
          <section>
            <SectionAnchor id="hedera-multisig" />
            <SectionLabel text="Hedera Native" />
            <SectionTitle>Multi-Sig Authority</SectionTitle>
            <SectionDesc>
              Create multi-sig authority accounts using Hedera&apos;s native threshold keys. No smart contract multi-sig needed — it&apos;s built into the account model.
              A 2-of-3 authority means 2 out of 3 signers must approve before any attestation is created.
            </SectionDesc>
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-5">
                <h3 className="mb-2 text-sm font-semibold text-green-900">How it works</h3>
                <ol className="list-inside list-decimal space-y-1 text-xs text-green-700">
                  <li>Create a new Hedera account with a KeyList containing multiple ECDSA public keys</li>
                  <li>Set a threshold (e.g. 2-of-3) — the account requires that many signatures for any transaction</li>
                  <li>Register this account as an authority on the AttestationService contract</li>
                  <li>Any attestation created by this authority requires the threshold number of signers</li>
                </ol>
              </div>
              <MethodBlock
                name="createMultiSigAuthority(params)"
                description="Create a new Hedera account with threshold keys for multi-sig authority."
                code={SDK_MULTISIG_CREATE}
                params={[
                  { name: 'publicKeys', type: 'string[]', required: true, description: 'Array of ECDSA public keys (hex or DER)' },
                  { name: 'threshold', type: 'number', required: true, description: 'Number of required signatures' },
                  { name: 'initialBalance', type: 'string', required: false, description: 'Initial HBAR balance (default: 10)' },
                ]}
                returns="ServiceResponse<{ accountId: string; threshold: number; totalKeys: number }>"
              />
              <MethodBlock
                name="getAccountKeyInfo(accountId)"
                description="Get key structure info for a Hedera account via Mirror Node."
                code={SDK_MULTISIG_INFO}
                params={[
                  { name: 'accountId', type: 'string', required: true, description: 'Hedera account ID (e.g. 0.0.12345)' },
                ]}
                returns="ServiceResponse<{ accountId: string; keyType: string; threshold?: number; keyCount?: number }>"
              />
              <CLIBlock command="attestify multisig create" description="Create a multi-sig authority account." code={CLI_MULTISIG_CREATE}
                flags={[
                  { name: '--keys', type: 'string', required: true, description: 'Comma-separated ECDSA public keys' },
                  { name: '--threshold', type: 'number', required: true, description: 'Required signatures' },
                  { name: '--initial-balance', type: 'string', required: false, default: '10', description: 'Initial HBAR balance' },
                ]} />
              <CLIBlock command="attestify multisig info" description="Get key structure info for a Hedera account." code={CLI_MULTISIG_INFO}
                flags={[
                  { name: '--account', type: 'string', required: true, description: 'Hedera account ID' },
                ]} />
            </div>
          </section>

          {/* ── Hedera Native: Token Staking ─────────────────────────── */}
          <section>
            <SectionAnchor id="hedera-staking" />
            <SectionLabel text="Hedera Native" />
            <SectionTitle>HTS Token Staking</SectionTitle>
            <SectionDesc>
              Authorities stake HTS fungible tokens to maintain their verified status. If they misbehave, their stake can be slashed.
              Uses Hedera Token Service (HTS) — native staking, not a smart contract token.
            </SectionDesc>
            <div className="space-y-4">
              <MethodBlock name="stakeTokens(tokenAddress, amount)" description="Stake HTS tokens as an authority." code={SDK_STAKE}
                params={[
                  { name: 'tokenAddress', type: 'string', required: true, description: 'HTS token EVM address' },
                  { name: 'amount', type: 'string', required: true, description: 'Amount to stake' },
                ]} returns="ServiceResponse<void>" />
              <MethodBlock name="unstakeTokens(tokenAddress, amount)" description="Unstake HTS tokens." code={SDK_UNSTAKE}
                params={[
                  { name: 'tokenAddress', type: 'string', required: true, description: 'HTS token EVM address' },
                  { name: 'amount', type: 'string', required: true, description: 'Amount to unstake' },
                ]} returns="ServiceResponse<void>" />
              <MethodBlock name="getStake(tokenAddress, authority)" description="Check staked token balance for an authority." code={SDK_GET_STAKE}
                params={[
                  { name: 'tokenAddress', type: 'string', required: true, description: 'HTS token EVM address' },
                  { name: 'authority', type: 'string', required: true, description: 'Authority address or account ID' },
                ]} returns="ServiceResponse<{ stakedAmount: string; tokenAddress: string }>" />
              <CLIBlock command="attestify staking stake" description="Stake HTS tokens." code={CLI_STAKE}
                flags={[
                  { name: '--token', type: 'string', required: true, description: 'HTS token address' },
                  { name: '--amount', type: 'string', required: true, description: 'Amount to stake' },
                ]} />
              <CLIBlock command="attestify staking unstake" description="Unstake HTS tokens." code={CLI_UNSTAKE}
                flags={[
                  { name: '--token', type: 'string', required: true, description: 'HTS token address' },
                  { name: '--amount', type: 'string', required: true, description: 'Amount to unstake' },
                ]} />
              <CLIBlock command="attestify staking balance" description="Check staked balance." code={CLI_STAKE_BALANCE}
                flags={[
                  { name: '--token', type: 'string', required: true, description: 'HTS token address' },
                  { name: '--authority', type: 'string', required: true, description: 'Authority address or account ID' },
                ]} />
            </div>
          </section>

          {/* ── Hedera Native: File Service Schema ───────────────────── */}
          <section>
            <SectionAnchor id="hedera-file-schema" />
            <SectionLabel text="Hedera Native" />
            <SectionTitle>File Service Schema Storage</SectionTitle>
            <SectionDesc>
              Store complex schema definitions on Hedera File Service for schemas too large for a single contract string.
              The schema UID references a File ID. Uses <code className="font-mono text-xs">FileCreateTransaction</code> from @hashgraph/sdk.
            </SectionDesc>
            <div className="space-y-4">
              <MethodBlock name="uploadSchemaFile(definition, memo?)" description="Upload a schema definition to Hedera File Service." code={SDK_FILE_UPLOAD}
                params={[
                  { name: 'definition', type: 'string', required: true, description: 'Schema definition string' },
                  { name: 'memo', type: 'string', required: false, description: 'Optional file memo' },
                ]} returns="ServiceResponse<{ fileId: string; definition: string }>" />
              <MethodBlock name="readSchemaFile(fileId)" description="Read a schema definition from Hedera File Service." code={SDK_FILE_READ}
                params={[
                  { name: 'fileId', type: 'string', required: true, description: 'Hedera File ID (e.g. 0.0.12345)' },
                ]} returns="ServiceResponse<{ fileId: string; definition: string }>" />
              <MethodBlock name="registerSchemaFromFile(params)" description="Read definition from File Service and register on-chain in one step." code={SDK_FILE_REGISTER}
                params={[
                  { name: 'fileId', type: 'string', required: true, description: 'Hedera File ID containing the schema' },
                  { name: 'revocable', type: 'boolean', required: true, description: 'Whether attestations can be revoked' },
                  { name: 'resolver', type: 'string', required: false, description: 'Resolver contract address' },
                ]} returns="ServiceResponse<{ schemaUid: string }>" />
              <CLIBlock command="attestify file-schema upload" description="Upload a schema to File Service." code={CLI_FILE_UPLOAD}
                flags={[
                  { name: '--definition', type: 'string', required: true, description: 'Schema definition string' },
                  { name: '--memo', type: 'string', required: false, description: 'File memo' },
                ]} />
              <CLIBlock command="attestify file-schema read" description="Read a schema from File Service." code={CLI_FILE_READ}
                flags={[
                  { name: '--file-id', type: 'string', required: true, description: 'Hedera File ID' },
                ]} />
              <CLIBlock command="attestify file-schema register" description="Register a schema from a File ID." code={CLI_FILE_REGISTER}
                flags={[
                  { name: '--file-id', type: 'string', required: true, description: 'Hedera File ID' },
                  { name: '--revocable', type: 'boolean', required: false, default: 'false', description: 'Whether attestations can be revoked' },
                  { name: '--resolver', type: 'string', required: false, description: 'Resolver contract address' },
                ]} />
            </div>
          </section>

          {/* ── SDK AI Tools ─────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="sdk-ai" />
            <SectionLabel text="AI Integration" />
            <SectionTitle>SDK AI Tools</SectionTitle>
            <SectionDesc>
              The <code className="font-mono text-xs">@attestify/sdk/ai</code> entry point exports LangChain-compatible tools and an agent factory.
              Plug 17 ready-made tools into any LangChain, CrewAI, or custom agent — or get a complete agent with conversation memory in one call.
              Requires peer dependencies: langchain, @langchain/core, @langchain/openai, zod.
            </SectionDesc>
            <div className="space-y-4">
              <CodeExample code={SDK_AI_INSTALL} title="terminal" language="bash" />
              <MethodBlock
                name="getAttestifyTools(config)"
                description="Returns 17 LangChain-compatible tools wrapping @attestify/sdk. Plug these into any agent framework."
                code={SDK_AI_TOOLS}
                params={[
                  { name: 'accountId', type: 'string', required: true, description: 'Hedera operator account ID (e.g. 0.0.XXXXX)' },
                  { name: 'privateKey', type: 'string', required: true, description: 'ECDSA private key (hex)' },
                  { name: 'indexerUrl', type: 'string', required: false, description: 'Indexer API URL for query operations' },
                  { name: 'rpcUrl', type: 'string', required: false, description: 'Hedera JSON-RPC URL (default: testnet)' },
                ]}
                returns="StructuredTool[] (17 tools)"
              />
              <MethodBlock
                name="createAttestifyAgent(config)"
                description="Creates a ready-to-use agent with conversation memory. Returns processMessage() for chat and clearConversation() to reset."
                code={SDK_AI_AGENT}
                params={[
                  { name: 'accountId', type: 'string', required: true, description: 'Hedera operator account ID' },
                  { name: 'privateKey', type: 'string', required: true, description: 'ECDSA private key (hex)' },
                  { name: 'openAIApiKey', type: 'string', required: true, description: 'OpenAI API key' },
                  { name: 'modelName', type: 'string', required: false, description: 'OpenAI model (default: gpt-4o-mini)' },
                  { name: 'temperature', type: 'number', required: false, description: 'LLM temperature (default: 0)' },
                  { name: 'indexerUrl', type: 'string', required: false, description: 'Indexer API URL' },
                  { name: 'systemPrompt', type: 'string', required: false, description: 'Custom system prompt for the agent' },
                ]}
                returns="{ processMessage, clearConversation, tools, executor }"
              />
              <div className="mt-4 overflow-hidden rounded-lg border border-surface-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Tool Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-surface-500">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'register_schema', desc: 'Register a new attestation schema on-chain' },
                      { name: 'get_schema', desc: 'Look up a schema by UID' },
                      { name: 'list_schemas', desc: 'List schemas from the indexer' },
                      { name: 'create_attestation', desc: 'Create an on-chain attestation' },
                      { name: 'get_attestation', desc: 'Look up an attestation by UID' },
                      { name: 'revoke_attestation', desc: 'Revoke an attestation' },
                      { name: 'list_attestations', desc: 'List attestations from the indexer' },
                      { name: 'register_authority', desc: 'Register as an authority' },
                      { name: 'get_authority', desc: 'Look up authority info' },
                      { name: 'get_profile', desc: 'Get full profile for an address' },
                      { name: 'encode_attestation_data', desc: 'ABI-encode attestation data' },
                      { name: 'decode_attestation_data', desc: 'Decode ABI-encoded attestation data' },
                      { name: 'whitelist_check', desc: 'Check whitelist status' },
                      { name: 'fee_get_fee', desc: 'Get current attestation fee' },
                      { name: 'fee_get_balance', desc: 'Check deposited balance on FeeResolver' },
                      { name: 'mint_nft_credential', desc: 'Mint an HTS NFT credential' },
                      { name: 'schedule_revocation', desc: 'Schedule automatic revocation' },
                    ].map((t) => (
                      <tr key={t.name} className="border-b border-surface-100 last:border-0">
                        <td className="px-4 py-2 font-mono text-xs text-surface-700">{t.name}</td>
                        <td className="px-4 py-2 text-xs text-surface-500">{t.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── CLI AI Mode ──────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="cli-ai" />
            <SectionLabel text="AI Integration" />
            <SectionTitle>CLI AI Mode</SectionTitle>
            <SectionDesc>
              The <code className="font-mono text-xs">attestify ai</code> command provides a natural language interface to the protocol.
              Uses <code className="font-mono text-xs">@attestify/sdk/ai</code> under the hood — same 17 tools, same LangChain agent.
              Supports one-shot mode (pass a message) or interactive REPL mode (omit the message).
            </SectionDesc>
            <div className="space-y-4">
              <CLIBlock
                command="attestify ai [message]"
                description="One-shot mode — send a single natural language message and get a response."
                code={CLI_AI_ONESHOT}
                flags={[
                  { name: '[message]', type: 'string', required: false, description: 'Message to send. Omit for interactive REPL mode.' },
                  { name: '--model', type: 'string', required: false, default: 'gpt-4o-mini', description: 'OpenAI model name' },
                ]}
              />
              <CLIBlock
                command="attestify ai (interactive)"
                description="Interactive REPL mode — multi-turn conversation with the agent. Type 'exit' to quit."
                code={CLI_AI_REPL}
              />
              <CLIBlock
                command="attestify ai (options)"
                description="Additional options for model selection and output format."
                code={CLI_AI_OPTIONS}
                flags={[
                  { name: '--model', type: 'string', required: false, default: 'gpt-4o-mini', description: 'OpenAI model to use' },
                  { name: '--json', type: 'boolean', required: false, description: 'Output as JSON (global flag, one-shot only)' },
                ]}
              />
              <div className="mt-4 rounded-lg border border-surface-200 bg-white p-4">
                <p className="mb-2 text-xs font-semibold text-surface-700">Required Environment Variable</p>
                <CodeExample code={`export OPENAI_API_KEY="sk-..."`} title="terminal" language="bash" />
                <p className="mt-2 text-xs text-surface-500">
                  Plus the standard <span className="font-mono text-surface-700">HEDERA_ACCOUNT_ID</span> and <span className="font-mono text-surface-700">HEDERA_PRIVATE_KEY</span> from the CLI setup section.
                </p>
              </div>
            </div>
          </section>

          {/* ── CTA ──────────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-surface-200 bg-white p-8 text-center shadow-sm">
            <h2 className="mb-2 text-xl font-bold text-surface-900">Start building</h2>
            <p className="mb-6 text-sm text-surface-500">Try the sandbox to test the protocol, or explore on-chain data.</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/sandbox"
                className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
              >
                Try the Sandbox
              </Link>
              <Link
                href="/schemas"
                className="rounded-lg border border-surface-300 px-6 py-2.5 text-sm font-medium text-surface-700 transition-colors hover:border-surface-400 hover:text-surface-900"
              >
                Explore Protocol
              </Link>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}