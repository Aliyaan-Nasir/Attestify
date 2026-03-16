/**
 * Attestify SDK — Type Definitions
 *
 * TypeScript interfaces mirroring the on-chain Solidity structs, SDK configuration,
 * operation parameters, and structured error types for the Hedera attestation protocol.
 */

// ─── Error Types ─────────────────────────────────────────────────────────────

/**
 * Structured error types for SDK operations.
 * Maps Solidity custom errors and runtime failures to a finite set of categories.
 */
export enum AttestifyErrorType {
  /** Schema with the same UID already exists on-chain */
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  /** Schema, attestation, or authority not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Caller is not authorized for the requested operation */
  UNAUTHORIZED = 'UNAUTHORIZED',
  /** Input validation failed (non-revocable schema, invalid resolver, insufficient fee/balance) */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** Attestation has already been revoked */
  ALREADY_REVOKED = 'ALREADY_REVOKED',
  /** Resolver contract rejected the operation */
  RESOLVER_REJECTED = 'RESOLVER_REJECTED',
  /** Attestation has expired */
  EXPIRED = 'EXPIRED',
  /** Network or RPC communication failure */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** SDK configuration is invalid */
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  /** On-chain transaction failed */
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  /** Unrecognized or unexpected error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// ─── Service Response ────────────────────────────────────────────────────────

/**
 * Standard response wrapper for all SDK operations.
 * All methods return this type — the SDK never throws.
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    type: AttestifyErrorType;
    message: string;
  };
}

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Contract addresses required by the SDK.
 */
export interface ContractAddresses {
  schemaRegistry: string;
  attestationService: string;
}

/**
 * Optional resolver contract addresses.
 */
export interface ResolverAddresses {
  whitelistResolver?: string;
  feeResolver?: string;
  tokenGatedResolver?: string;
}

/**
 * Configuration for initializing HederaAttestService.
 */
export interface HederaAttestServiceConfig {
  /** Target network — testnet only for now */
  network: 'testnet';
  /** Hedera operator account ID (e.g. "0.0.12345") */
  operatorAccountId: string;
  /** Hedera operator ECDSA private key (hex) */
  operatorPrivateKey: string;
  /** Deployed contract addresses */
  contractAddresses: ContractAddresses;
  /** Optional HCS topic ID for audit logging (single topic, legacy) */
  hcsTopicId?: string;
  /** Optional per-category HCS topic IDs for audit logging */
  hcsTopicIds?: {
    schemas?: string;
    attestations?: string;
    authorities?: string;
  };
  /** JSON-RPC relay URL — defaults to https://testnet.hashio.io/api */
  rpcUrl?: string;
  /** Indexer API URL for query operations (listSchemas, listAttestations, profile) */
  indexerUrl?: string;
  /** Optional resolver contract addresses for whitelist, fee, and token-gated operations */
  resolverAddresses?: ResolverAddresses;
}

// ─── On-Chain Record Types ───────────────────────────────────────────────────
// These mirror the Solidity structs in SchemaRegistry.sol and AttestationService.sol.
// Solidity bytes32 → string (hex), address → string, uint64 → number, uint256 → number.

/**
 * Schema record as stored on-chain in SchemaRegistry.
 */
export interface SchemaRecord {
  /** Deterministic schema UID (bytes32 hex string) */
  uid: string;
  /** ABI-encoded schema definition string */
  definition: string;
  /** Address of the authority that registered the schema */
  authority: string;
  /** Resolver contract address (zero address if none) */
  resolver: string;
  /** Whether attestations under this schema can be revoked */
  revocable: boolean;
  /** Block timestamp when the schema was registered */
  timestamp: number;
}

/**
 * Attestation record as stored on-chain in AttestationService.
 */
export interface AttestationRecord {
  /** Deterministic attestation UID (bytes32 hex string) */
  uid: string;
  /** Schema UID this attestation references (bytes32 hex string) */
  schemaUid: string;
  /** Address of the entity that created the attestation */
  attester: string;
  /** Address of the entity the attestation is about */
  subject: string;
  /** ABI-encoded attestation payload (hex string) */
  data: string;
  /** Block timestamp when the attestation was created */
  timestamp: number;
  /** Expiration timestamp (0 means no expiration) */
  expirationTime: number;
  /** Whether the attestation has been revoked */
  revoked: boolean;
  /** Timestamp when the attestation was revoked (0 if not revoked) */
  revocationTime: number;
  /** Per-attester nonce used in UID derivation */
  nonce: number;
}

/**
 * Authority record as stored on-chain in AttestationService.
 */
export interface AuthorityRecord {
  /** Authority's address */
  addr: string;
  /** Descriptive metadata string */
  metadata: string;
  /** Whether the authority has been verified by the contract admin */
  isVerified: boolean;
  /** Block timestamp when the authority was registered */
  registeredAt: number;
}

// ─── Indexer Query Types ──────────────────────────────────────────────────────

/**
 * Schema record as returned by the indexer API (includes DB fields).
 */
export interface IndexedSchemaRecord {
  uid: string;
  definition: string;
  authorityAddress: string;
  resolverAddress: string | null;
  revocable: boolean;
  hcsTopicId: string | null;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string | null;
  createdAt: string;
}

/**
 * Attestation record as returned by the indexer API (includes DB fields).
 */
export interface IndexedAttestationRecord {
  uid: string;
  schemaUid: string;
  attesterAddress: string;
  subjectAddress: string;
  data: string;
  nonce: number;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string | null;
  expirationTime: string | null;
  revoked: boolean;
  revocationTime: string | null;
  revocationTxHash: string | null;
  createdAt: string;
}

/**
 * Authority record as returned by the indexer API (includes DB fields).
 */
export interface IndexedAuthorityRecord {
  address: string;
  metadata: string | null;
  isVerified: boolean;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string | null;
  createdAt: string;
}

/**
 * Profile summary for an address — aggregates authority, schemas, and attestations.
 */
export interface ProfileSummary {
  address: string;
  authority: IndexedAuthorityRecord | null;
  schemas: IndexedSchemaRecord[];
  attestationsIssued: IndexedAttestationRecord[];
  attestationsReceived: IndexedAttestationRecord[];
}

// ─── Attestation Status ──────────────────────────────────────────────────────

/**
 * Derived attestation status for display purposes.
 * Computed from the revocation flag and expiration timestamp (Property 27).
 */
export type AttestationStatus = 'active' | 'revoked' | 'expired';

// ─── Operation Parameter Types ───────────────────────────────────────────────

/**
 * Parameters for registering a new schema.
 */
export interface RegisterSchemaParams {
  /** Schema definition string (ABI-encoded field types) */
  definition: string;
  /** Optional resolver contract address */
  resolver?: string;
  /** Whether attestations under this schema can be revoked */
  revocable: boolean;
}

/**
 * Parameters for creating a new attestation.
 */
export interface CreateAttestationParams {
  /** Schema UID to attest against (bytes32 hex string) */
  schemaUid: string;
  /** Subject address the attestation is about */
  subject: string;
  /** ABI-encoded attestation data (hex string) */
  data: string;
  /** Optional expiration timestamp (0 or omitted for no expiration) */
  expirationTime?: number;
}

/**
 * Parameters for setting authority verification status.
 */
export interface SetAuthorityVerificationParams {
  /** Authority address */
  address: string;
  /** New verification status */
  verified: boolean;
}

/**
 * Parameters for minting an HTS NFT credential.
 */
export interface MintAttestationNFTParams {
  /** Subject address to receive the NFT */
  subject: string;
  /** Attestation UID to embed in NFT metadata */
  attestationUid: string;
  /** HTS token ID for the NFT collection */
  tokenId: string;
}

/**
 * Parameters for scheduling an automatic revocation via Hedera Scheduled Transactions.
 */
export interface ScheduleRevocationParams {
  /** Attestation UID to revoke */
  attestationUid: string;
  /** Unix timestamp (seconds) when the revocation should execute */
  executeAt: number;
}

/**
 * Result of a scheduled revocation.
 */
export interface ScheduledRevocationResult {
  /** Hedera Schedule ID (e.g. "0.0.12345") */
  scheduleId: string;
  /** The scheduled transaction ID */
  transactionId: string;
}

/**
 * Info about a scheduled revocation.
 */
export interface ScheduledRevocationInfo {
  /** Schedule ID */
  scheduleId: string;
  /** Whether the scheduled transaction has been executed */
  executed: boolean;
  /** Whether the scheduled transaction has been deleted */
  deleted: boolean;
  /** Expiration time of the schedule */
  expirationTime: string;
}

// ─── Multi-Sig Authority Types ───────────────────────────────────────────────

/**
 * Parameters for creating a multi-sig authority account.
 */
export interface CreateMultiSigAuthorityParams {
  /** Array of ECDSA public keys (hex or DER encoded) */
  publicKeys: string[];
  /** Number of required signatures (threshold) */
  threshold: number;
  /** Initial HBAR balance for the new account */
  initialBalance?: string;
}

/**
 * Result of creating a multi-sig authority account.
 */
export interface MultiSigAuthorityResult {
  /** New Hedera account ID */
  accountId: string;
  /** Threshold required */
  threshold: number;
  /** Number of keys */
  totalKeys: number;
}

/**
 * Info about a Hedera account's key structure.
 */
export interface AccountKeyInfo {
  /** Account ID */
  accountId: string;
  /** Key type: 'single', 'threshold', 'keylist' */
  keyType: string;
  /** Threshold (if threshold key) */
  threshold?: number;
  /** Number of keys in the list */
  keyCount?: number;
}

// ─── Staking Resolver Types ──────────────────────────────────────────────────

/**
 * Staking configuration for the StakingResolver.
 */
export interface StakingConfig {
  /** HTS token address used for staking */
  tokenAddress: string;
  /** Minimum stake required */
  minimumStake: string;
}

// ─── File Service Schema Types ───────────────────────────────────────────────

/**
 * Result of creating a schema file on Hedera File Service.
 */
export interface SchemaFileResult {
  /** Hedera File ID (e.g. "0.0.12345") */
  fileId: string;
  /** The schema definition stored */
  definition: string;
}

// ─── Multi-Sig Authority Types (Feature 5) ──────────────────────────────────
// (Already defined above: CreateMultiSigAuthorityParams, MultiSigAuthorityResult, AccountKeyInfo)

// ─── Staking Types (Feature 6) ──────────────────────────────────────────────
// (StakingConfig already defined above)

/**
 * Parameters for staking HTS tokens as an authority.
 */
export interface StakeTokensParams {
  /** HTS token address to stake */
  tokenAddress: string;
  /** Amount to stake */
  amount: string;
}

/**
 * Result of a staking operation.
 */
export interface StakeInfo {
  /** Authority address */
  authority: string;
  /** Staked amount */
  stakedAmount: string;
  /** Token address */
  tokenAddress: string;
}

// ─── File Service Schema Types (Feature 7) ──────────────────────────────────
// (SchemaFileResult already defined above)

/**
 * Parameters for uploading a schema to Hedera File Service.
 */
export interface UploadSchemaFileParams {
  /** Schema definition string */
  definition: string;
  /** Optional memo for the file */
  memo?: string;
}

/**
 * Parameters for registering a schema from a Hedera File ID.
 */
export interface RegisterSchemaFromFileParams {
  /** Hedera File ID containing the schema definition */
  fileId: string;
  /** Whether attestations under this schema can be revoked */
  revocable: boolean;
  /** Optional resolver contract address */
  resolver?: string;
}

// ─── Schema Encoder Types ────────────────────────────────────────────────────

/**
 * A single field in a schema definition.
 */
export interface SchemaFieldDefinition {
  /** Field name */
  name: string;
  /** Solidity ABI type (uint256, address, string, bool, bytes, etc.) */
  type: string;
}

// ─── HCS Message Types ───────────────────────────────────────────────────────

/**
 * HCS message for schema registration audit log.
 */
export interface HCSSchemaRegisteredMessage {
  version: '1.0';
  type: 'schema.registered';
  payload: {
    uid: string;
    authority: string;
    resolver: string;
    definition: string;
    revocable: boolean;
    timestamp: number;
  };
}

/**
 * HCS message for attestation creation audit log.
 */
export interface HCSAttestationCreatedMessage {
  version: '1.0';
  type: 'attestation.created';
  payload: {
    attestationUid: string;
    schemaUid: string;
    attester: string;
    subject: string;
    timestamp: number;
  };
}

/**
 * HCS message for attestation revocation audit log.
 */
export interface HCSAttestationRevokedMessage {
  version: '1.0';
  type: 'attestation.revoked';
  payload: {
    attestationUid: string;
    revocationTimestamp: number;
  };
}

/**
 * HCS message for authority registration audit log.
 */
export interface HCSAuthorityRegisteredMessage {
  version: '1.0';
  type: 'authority.registered';
  payload: {
    address: string;
    metadata: string;
    timestamp: number;
  };
}

/**
 * Union type for all HCS messages.
 */
export type HCSMessage =
  | HCSSchemaRegisteredMessage
  | HCSAttestationCreatedMessage
  | HCSAttestationRevokedMessage
  | HCSAuthorityRegisteredMessage;
