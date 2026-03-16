/**
 * Attestify SDK
 * TypeScript SDK for the Hedera attestation protocol
 */

export { HederaAttestService } from './HederaAttestService';
export * from './types';
export * from './config';
export { SchemaEncoder, parseSchema, isValidSolidityType } from './schema-encoder';
export { computeSchemaUid, computeAttestationUid } from './uid';
export { HCSLogger } from './hcs';
export type { HCSTopicIds } from './hcs';
export { mintAttestationNFT } from './hts';
export { IndexerClient } from './indexer-client';
export type {
  IndexedSchema,
  IndexedAttestation,
  IndexedAuthority,
  PaginatedResult,
  ProfileResult,
} from './indexer-client';
