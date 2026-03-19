/**
 * Attestify LangChain Tools
 *
 * Wraps @attestify/sdk methods as LangChain-compatible tools so the
 * AI agent can interact with the Attestify protocol via natural language.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  HederaAttestService,
  SchemaEncoder,
  TESTNET_CONTRACT_ADDRESSES,
  TESTNET_RESOLVER_ADDRESSES,
  TESTNET_HCS_TOPICS,
  DEFAULT_RPC_URL,
} from '@attestify/sdk';

// ─── SDK Instance ────────────────────────────────────────────────────────────

let service: HederaAttestService;

export function initializeSDK(config: {
  accountId: string;
  privateKey: string;
  indexerUrl: string;
}) {
  service = new HederaAttestService({
    network: 'testnet',
    operatorAccountId: config.accountId,
    operatorPrivateKey: config.privateKey,
    rpcUrl: DEFAULT_RPC_URL,
    contractAddresses: TESTNET_CONTRACT_ADDRESSES,
    resolverAddresses: TESTNET_RESOLVER_ADDRESSES,
    hcsTopicIds: TESTNET_HCS_TOPICS,
    indexerUrl: config.indexerUrl,
  });
}


// ─── Schema Tools ────────────────────────────────────────────────────────────

export const registerSchemaTool = tool(
  async ({ definition, revocable, resolver }) => {
    const result = await service.registerSchema({
      definition,
      revocable: revocable ?? true,
      resolver,
    });
    if (!result.success) {
      return `Failed to register schema: ${result.error?.message}`;
    }
    return `Schema registered successfully!\nSchema UID: ${result.data!.schemaUid}\nDefinition: ${definition}\nRevocable: ${revocable ?? true}`;
  },
  {
    name: 'register_schema',
    description:
      'Register a new attestation schema on-chain. A schema defines the structure of attestation data (e.g. "string name, uint256 age, bool verified"). Returns the schema UID.',
    schema: z.object({
      definition: z
        .string()
        .describe('Schema definition with comma-separated Solidity ABI types and field names, e.g. "string name, uint256 age, bool verified"'),
      revocable: z
        .boolean()
        .optional()
        .describe('Whether attestations under this schema can be revoked. Defaults to true.'),
      resolver: z
        .string()
        .optional()
        .describe('Optional resolver contract address for custom validation logic.'),
    }),
  },
);

export const getSchemaTool = tool(
  async ({ uid }) => {
    const result = await service.getSchema(uid);
    if (!result.success) {
      return `Failed to get schema: ${result.error?.message}`;
    }
    const s = result.data!;
    return `Schema found:\n  UID: ${s.uid}\n  Definition: ${s.definition}\n  Authority: ${s.authority}\n  Resolver: ${s.resolver}\n  Revocable: ${s.revocable}\n  Timestamp: ${s.timestamp}`;
  },
  {
    name: 'get_schema',
    description: 'Look up a schema by its UID from the on-chain contract. Returns the schema definition, authority, resolver, and revocable flag.',
    schema: z.object({
      uid: z.string().describe('Schema UID (bytes32 hex string starting with 0x)'),
    }),
  },
);

export const listSchemasTool = tool(
  async ({ authority, limit }) => {
    const result = await service.listSchemas({ authority, limit: limit ?? 10 });
    if (!result.success) {
      return `Failed to list schemas: ${result.error?.message}`;
    }
    const schemas = result.data!;
    if (schemas.length === 0) return 'No schemas found.';
    return `Found ${schemas.length} schema(s):\n${schemas
      .map(
        (s) =>
          `  UID: ${s.uid}\n  Definition: ${s.definition}\n  Authority: ${s.authorityAddress}\n  Revocable: ${s.revocable}\n`,
      )
      .join('\n')}`;
  },
  {
    name: 'list_schemas',
    description: 'List schemas from the indexer. Optionally filter by authority address.',
    schema: z.object({
      authority: z.string().optional().describe('Filter by authority address'),
      limit: z.number().optional().describe('Max results (default 10)'),
    }),
  },
);


// ─── Attestation Tools ───────────────────────────────────────────────────────

export const createAttestationTool = tool(
  async ({ schemaUid, subject, data, expirationTime }) => {
    // If data looks like key-value pairs, try to encode it
    let encodedData = data;
    if (!data.startsWith('0x')) {
      // User provided human-readable data — try to encode using the schema
      const schemaResult = await service.getSchema(schemaUid);
      if (schemaResult.success && schemaResult.data) {
        try {
          const encoder = new SchemaEncoder(schemaResult.data.definition);
          const parsed = JSON.parse(data);
          encodedData = encoder.encode(parsed);
        } catch {
          return `Failed to encode data. Provide either ABI-encoded hex (0x...) or a JSON object matching the schema fields. Schema definition: ${schemaResult.data.definition}`;
        }
      }
    }

    const result = await service.createAttestation({
      schemaUid,
      subject,
      data: encodedData,
      expirationTime: expirationTime ?? 0,
    });
    if (!result.success) {
      return `Failed to create attestation: ${result.error?.message}`;
    }
    return `Attestation created successfully!\nAttestation UID: ${result.data!.attestationUid}\nSchema: ${schemaUid}\nSubject: ${subject}`;
  },
  {
    name: 'create_attestation',
    description:
      'Create an on-chain attestation against an existing schema. The data can be ABI-encoded hex (0x...) or a JSON object with field values matching the schema definition.',
    schema: z.object({
      schemaUid: z.string().describe('Schema UID to attest against (bytes32 hex)'),
      subject: z.string().describe('Subject address the attestation is about'),
      data: z
        .string()
        .describe(
          'Attestation data — either ABI-encoded hex (0x...) or a JSON string like {"name":"Alice","age":25,"verified":true}',
        ),
      expirationTime: z
        .number()
        .optional()
        .describe('Unix timestamp for expiration. 0 or omitted means no expiration.'),
    }),
  },
);

export const getAttestationTool = tool(
  async ({ uid }) => {
    const result = await service.getAttestation(uid);
    if (!result.success) {
      return `Failed to get attestation: ${result.error?.message}`;
    }
    const a = result.data!;
    return `Attestation found:\n  UID: ${a.uid}\n  Schema UID: ${a.schemaUid}\n  Attester: ${a.attester}\n  Subject: ${a.subject}\n  Data: ${a.data}\n  Revoked: ${a.revoked}\n  Timestamp: ${a.timestamp}\n  Expiration: ${a.expirationTime || 'None'}\n  Nonce: ${a.nonce}`;
  },
  {
    name: 'get_attestation',
    description: 'Look up an attestation by its UID from the on-chain contract.',
    schema: z.object({
      uid: z.string().describe('Attestation UID (bytes32 hex string starting with 0x)'),
    }),
  },
);

export const revokeAttestationTool = tool(
  async ({ uid }) => {
    const result = await service.revokeAttestation(uid);
    if (!result.success) {
      return `Failed to revoke attestation: ${result.error?.message}`;
    }
    return `Attestation revoked successfully!\nUID: ${uid}`;
  },
  {
    name: 'revoke_attestation',
    description: 'Revoke an attestation. Only the original attester can revoke. The schema must be revocable.',
    schema: z.object({
      uid: z.string().describe('Attestation UID to revoke (bytes32 hex)'),
    }),
  },
);

export const listAttestationsTool = tool(
  async ({ attester, subject, schemaUid, limit }) => {
    const result = await service.listAttestations({
      attester,
      subject,
      schemaUid,
      limit: limit ?? 10,
    });
    if (!result.success) {
      return `Failed to list attestations: ${result.error?.message}`;
    }
    const attestations = result.data!;
    if (attestations.length === 0) return 'No attestations found.';
    return `Found ${attestations.length} attestation(s):\n${attestations
      .map(
        (a) =>
          `  UID: ${a.uid}\n  Schema: ${a.schemaUid}\n  Attester: ${a.attesterAddress}\n  Subject: ${a.subjectAddress}\n  Revoked: ${a.revoked}\n  Created: ${a.createdAt}\n`,
      )
      .join('\n')}`;
  },
  {
    name: 'list_attestations',
    description: 'List attestations from the indexer. Filter by attester, subject, schema UID, or revocation status.',
    schema: z.object({
      attester: z.string().optional().describe('Filter by attester address'),
      subject: z.string().optional().describe('Filter by subject address'),
      schemaUid: z.string().optional().describe('Filter by schema UID'),
      limit: z.number().optional().describe('Max results (default 10)'),
    }),
  },
);


// ─── Authority Tools ─────────────────────────────────────────────────────────

export const registerAuthorityTool = tool(
  async ({ metadata }) => {
    const result = await service.registerAuthority(metadata);
    if (!result.success) {
      return `Failed to register authority: ${result.error?.message}`;
    }
    return `Authority registered successfully!\nMetadata: ${metadata}`;
  },
  {
    name: 'register_authority',
    description: 'Register the agent as an authority on the AttestationService contract. Provide descriptive metadata.',
    schema: z.object({
      metadata: z.string().describe('Descriptive metadata for the authority (e.g. "Acme KYC Services")'),
    }),
  },
);

export const getAuthorityTool = tool(
  async ({ address }) => {
    const result = await service.getAuthority(address);
    if (!result.success) {
      return `Failed to get authority: ${result.error?.message}`;
    }
    const a = result.data!;
    return `Authority found:\n  Address: ${a.addr}\n  Metadata: ${a.metadata}\n  Verified: ${a.isVerified}\n  Registered At: ${a.registeredAt}`;
  },
  {
    name: 'get_authority',
    description: 'Look up authority info by address from the on-chain contract.',
    schema: z.object({
      address: z.string().describe('Authority EVM address'),
    }),
  },
);

// ─── Profile Tool ────────────────────────────────────────────────────────────

export const getProfileTool = tool(
  async ({ address }) => {
    const result = await service.getProfile(address);
    if (!result.success) {
      return `Failed to get profile: ${result.error?.message}`;
    }
    const p = result.data!;
    const parts: string[] = [`Profile for ${p.address}:`];
    if (p.authority) {
      parts.push(`  Authority: ${p.authority.metadata || 'No metadata'} (Verified: ${p.authority.isVerified})`);
    } else {
      parts.push('  Authority: Not registered');
    }
    parts.push(`  Schemas created: ${p.schemas.length}`);
    parts.push(`  Attestations issued: ${p.attestationsIssued.length}`);
    parts.push(`  Attestations received: ${p.attestationsReceived.length}`);
    return parts.join('\n');
  },
  {
    name: 'get_profile',
    description:
      'Get a complete profile for any address — authority status, schemas created, attestations issued, and attestations received.',
    schema: z.object({
      address: z.string().describe('Wallet address to look up'),
    }),
  },
);

// ─── Schema Encoder Tools ────────────────────────────────────────────────────

export const encodeDataTool = tool(
  async ({ definition, values }) => {
    try {
      const encoder = new SchemaEncoder(definition);
      const parsed = JSON.parse(values);
      const encoded = encoder.encode(parsed);
      return `Encoded data: ${encoded}`;
    } catch (e: any) {
      return `Failed to encode: ${e.message}`;
    }
  },
  {
    name: 'encode_attestation_data',
    description:
      'ABI-encode attestation data according to a schema definition. Returns hex string ready for createAttestation.',
    schema: z.object({
      definition: z.string().describe('Schema definition (e.g. "string name, uint256 age")'),
      values: z.string().describe('JSON object with field values (e.g. {"name":"Alice","age":25})'),
    }),
  },
);

export const decodeDataTool = tool(
  async ({ definition, data }) => {
    try {
      const encoder = new SchemaEncoder(definition);
      const decoded = encoder.decode(data);
      return `Decoded data:\n${Object.entries(decoded).map(([key, val]) => `  ${key}: ${val}`).join('\n')}`;
    } catch (e: any) {
      return `Failed to decode: ${e.message}`;
    }
  },
  {
    name: 'decode_attestation_data',
    description: 'Decode ABI-encoded attestation data back into human-readable field values using a schema definition.',
    schema: z.object({
      definition: z.string().describe('Schema definition (e.g. "string name, uint256 age")'),
      data: z.string().describe('ABI-encoded hex data (0x...)'),
    }),
  },
);


// ─── Resolver Tools ──────────────────────────────────────────────────────────

export const whitelistCheckTool = tool(
  async ({ account }) => {
    const result = await service.whitelistCheck(account);
    if (!result.success) {
      return `Failed to check whitelist: ${result.error?.message}`;
    }
    return `Address ${account} is ${result.data!.whitelisted ? 'whitelisted ✓' : 'NOT whitelisted ✗'}`;
  },
  {
    name: 'whitelist_check',
    description: 'Check if an address is whitelisted on the WhitelistResolver.',
    schema: z.object({
      account: z.string().describe('EVM address to check'),
    }),
  },
);

export const feeGetFeeTool = tool(
  async () => {
    const result = await service.feeGetFee();
    if (!result.success) {
      return `Failed to get fee: ${result.error?.message}`;
    }
    return `Current attestation fee: ${result.data!.fee} wei (tinybar)`;
  },
  {
    name: 'fee_get_fee',
    description: 'Get the current attestation fee from the FeeResolver.',
    schema: z.object({}),
  },
);

export const feeGetBalanceTool = tool(
  async ({ account }) => {
    const result = await service.feeGetBalance(account);
    if (!result.success) {
      return `Failed to get balance: ${result.error?.message}`;
    }
    return `Deposited balance for ${account}: ${result.data!.balance} wei (tinybar)`;
  },
  {
    name: 'fee_get_balance',
    description: 'Check the deposited HBAR balance for an address on the FeeResolver.',
    schema: z.object({
      account: z.string().describe('EVM address to check'),
    }),
  },
);

// ─── Hedera Native Tools ─────────────────────────────────────────────────────

export const mintNFTTool = tool(
  async ({ subject, attestationUid, tokenId }) => {
    const result = await service.mintNFT({ subject, attestationUid, tokenId });
    if (!result.success) {
      return `Failed to mint NFT: ${result.error?.message}`;
    }
    return `NFT minted successfully!\nSerial Number: ${result.data!.serialNumber}\nToken ID: ${tokenId}\nAttestation UID: ${attestationUid}`;
  },
  {
    name: 'mint_nft_credential',
    description: 'Mint an HTS NFT credential linked to an attestation. The attestation UID is embedded in the NFT metadata.',
    schema: z.object({
      subject: z.string().describe('Subject address to receive the NFT'),
      attestationUid: z.string().describe('Attestation UID to embed in NFT metadata'),
      tokenId: z.string().describe('HTS token ID for the NFT collection (e.g. 0.0.12345)'),
    }),
  },
);

export const scheduleRevocationTool = tool(
  async ({ attestationUid, executeAt }) => {
    const result = await service.scheduleRevocation({ attestationUid, executeAt });
    if (!result.success) {
      return `Failed to schedule revocation: ${result.error?.message}`;
    }
    return `Revocation scheduled!\nSchedule ID: ${result.data!.scheduleId}\nTransaction ID: ${result.data!.transactionId}\nExecutes at: ${new Date(executeAt * 1000).toISOString()}`;
  },
  {
    name: 'schedule_revocation',
    description:
      'Schedule an automatic attestation revocation at a future time using Hedera Scheduled Transactions. No cron jobs needed.',
    schema: z.object({
      attestationUid: z.string().describe('Attestation UID to revoke'),
      executeAt: z.number().describe('Unix timestamp (seconds) when the revocation should execute'),
    }),
  },
);

// ─── Export All Tools ────────────────────────────────────────────────────────

export function getAllTools() {
  return [
    registerSchemaTool,
    getSchemaTool,
    listSchemasTool,
    createAttestationTool,
    getAttestationTool,
    revokeAttestationTool,
    listAttestationsTool,
    registerAuthorityTool,
    getAuthorityTool,
    getProfileTool,
    encodeDataTool,
    decodeDataTool,
    whitelistCheckTool,
    feeGetFeeTool,
    feeGetBalanceTool,
    mintNFTTool,
    scheduleRevocationTool,
  ];
}
