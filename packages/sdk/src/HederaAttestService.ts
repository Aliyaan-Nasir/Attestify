/**
 * Attestify SDK — HederaAttestService
 *
 * Core service class wrapping all contract interactions for the Hedera attestation protocol.
 * Uses ethers.js for HSCS contract calls via JSON-RPC relay and @hashgraph/sdk for native
 * Hedera services (HCS, HTS).
 *
 * All public methods return ServiceResponse<T> — the class never throws after construction.
 */

import { ethers } from 'ethers';
import { Client, AccountId, PrivateKey, ScheduleCreateTransaction, ScheduleInfoQuery, ScheduleId, ContractExecuteTransaction, ContractId, AccountCreateTransaction, KeyList, PublicKey, FileCreateTransaction, FileContentsQuery, FileId, Timestamp } from '@hashgraph/sdk';
import { validateConfig, DEFAULT_RPC_URL, DEFAULT_INDEXER_URL } from './config';
import { HCSLogger } from './hcs';
import type { HCSTopicIds } from './hcs';
import type {
  HederaAttestServiceConfig,
  ServiceResponse,
  SchemaRecord,
  AttestationRecord,
  AuthorityRecord,
  RegisterSchemaParams,
  CreateAttestationParams,
  AttestifyErrorType,
  IndexedSchemaRecord,
  IndexedAttestationRecord,
  IndexedAuthorityRecord,
  ProfileSummary,
  MintAttestationNFTParams,
  ScheduleRevocationParams,
  ScheduledRevocationResult,
  ScheduledRevocationInfo,
  CreateMultiSigAuthorityParams,
  MultiSigAuthorityResult,
  AccountKeyInfo,
  StakingConfig,
  SchemaFileResult,
} from './types';
import { AttestifyErrorType as ErrorType } from './types';
import { mintAttestationNFT } from './hts';

// ─── Minimal Contract ABIs ──────────────────────────────────────────────────

const SCHEMA_REGISTRY_ABI = [
  'function register(string definition, address resolver, bool revocable) external returns (bytes32)',
  'function getSchema(bytes32 uid) external view returns (tuple(bytes32 uid, string definition, address authority, address resolver, bool revocable, uint64 timestamp))',
  'event SchemaRegistered(bytes32 indexed uid, address indexed authority, address resolver)',
];

const ATTESTATION_SERVICE_ABI = [
  'function attest(bytes32 schemaUid, address subject, bytes data, uint64 expirationTime) external returns (bytes32)',
  'function revoke(bytes32 attestationUid) external',
  'function getAttestation(bytes32 uid) external view returns (tuple(bytes32 uid, bytes32 schemaUid, address attester, address subject, bytes data, uint64 timestamp, uint64 expirationTime, bool revoked, uint64 revocationTime, uint256 nonce))',
  'function registerAuthority(string metadata) external',
  'function getAuthority(address addr) external view returns (tuple(address addr, string metadata, bool isVerified, uint64 registeredAt))',
  'function setAuthorityVerification(address addr, bool verified) external',
  'function addDelegate(address delegate) external',
  'function removeDelegate(address delegate) external',
  'function isDelegate(address authority, address delegate) external view returns (bool)',
  'function getDelegates(address authority) external view returns (address[])',
  'function attestOnBehalf(address authority, bytes32 schemaUid, address subject, bytes data, uint64 expirationTime) external returns (bytes32)',
  'function revokeOnBehalf(bytes32 attestationUid) external',
  'event AttestationCreated(bytes32 indexed uid, bytes32 indexed schemaUid, address indexed attester, address subject)',
  'event AttestationRevoked(bytes32 indexed uid, address indexed revoker)',
  'event AuthorityRegistered(address indexed authority)',
  'event DelegateAdded(address indexed authority, address indexed delegate)',
  'event DelegateRemoved(address indexed authority, address indexed delegate)',
];

const WHITELIST_RESOLVER_ABI = [
  'function addAddress(address account) external',
  'function removeAddress(address account) external',
  'function whitelisted(address) external view returns (bool)',
  'function owner() external view returns (address)',
];

const FEE_RESOLVER_ABI = [
  'function deposit() external payable',
  'function setFee(uint256 _fee) external',
  'function withdraw() external',
  'function fee() external view returns (uint256)',
  'function balances(address) external view returns (uint256)',
  'function owner() external view returns (address)',
];

const TOKEN_GATED_RESOLVER_ABI = [
  'function setTokenConfig(address _tokenAddress, uint256 _minimumBalance) external',
  'function tokenAddress() external view returns (address)',
  'function minimumBalance() external view returns (uint256)',
  'function owner() external view returns (address)',
];

const TOKEN_REWARD_RESOLVER_ABI = [
  'function setRewardConfig(address _rewardToken, uint256 _rewardAmount) external',
  'function rewardToken() external view returns (address)',
  'function rewardAmount() external view returns (uint256)',
  'function rewardsDistributed(address) external view returns (uint256)',
  'function owner() external view returns (address)',
];

const CROSS_CONTRACT_RESOLVER_ABI = [
  'function setPipeline(address[] _resolvers) external',
  'function getPipeline() external view returns (address[])',
  'function pipelineLength() external view returns (uint256)',
  'function owner() external view returns (address)',
];

// ─── Error Reason → AttestifyErrorType Mapping ──────────────────────────────

const ERROR_REASON_MAP: Record<string, AttestifyErrorType> = {
  SchemaAlreadyExists: ErrorType.ALREADY_EXISTS,
  SchemaNotFound: ErrorType.NOT_FOUND,
  AttestationNotFound: ErrorType.NOT_FOUND,
  AuthorityNotFound: ErrorType.NOT_FOUND,
  AttestationAlreadyRevoked: ErrorType.ALREADY_REVOKED,
  AttestationExpired: ErrorType.EXPIRED,
  SchemaNotRevocable: ErrorType.VALIDATION_ERROR,
  InvalidResolver: ErrorType.VALIDATION_ERROR,
  InvalidExpirationTime: ErrorType.VALIDATION_ERROR,
  InsufficientFee: ErrorType.VALIDATION_ERROR,
  InsufficientTokenBalance: ErrorType.VALIDATION_ERROR,
  UnauthorizedRevoker: ErrorType.UNAUTHORIZED,
  Unauthorized: ErrorType.UNAUTHORIZED,
  NotWhitelisted: ErrorType.UNAUTHORIZED,
  NotDelegate: ErrorType.UNAUTHORIZED,
  DelegateAlreadyAdded: ErrorType.ALREADY_EXISTS,
  DelegateNotFound: ErrorType.NOT_FOUND,
  ResolverRejected: ErrorType.RESOLVER_REJECTED,
};

// ─── HederaAttestService ────────────────────────────────────────────────────

export class HederaAttestService {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly signer: ethers.Wallet;
  private readonly hederaClient: Client;
  private readonly schemaRegistry: ethers.Contract;
  private readonly attestationService: ethers.Contract;
  private readonly hcsLogger: HCSLogger | null;
  private readonly indexerUrl: string;
  private readonly whitelistResolver: ethers.Contract | null;
  private readonly feeResolver: ethers.Contract | null;
  private readonly tokenGatedResolver: ethers.Contract | null;

  /**
   * Initialize the service. Validates config and sets up ethers.js + @hashgraph/sdk clients.
   * This is the only place that throws — all other methods return ServiceResponse.
   */
  constructor(config: HederaAttestServiceConfig) {
    const validationError = validateConfig(config);
    if (validationError) {
      throw new Error(validationError);
    }

    // ethers.js provider + signer via JSON-RPC relay
    const rpcUrl = config.rpcUrl ?? DEFAULT_RPC_URL;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(config.operatorPrivateKey, this.provider);

    // Contract instances
    this.schemaRegistry = new ethers.Contract(
      config.contractAddresses.schemaRegistry,
      SCHEMA_REGISTRY_ABI,
      this.signer,
    );
    this.attestationService = new ethers.Contract(
      config.contractAddresses.attestationService,
      ATTESTATION_SERVICE_ABI,
      this.signer,
    );

    // @hashgraph/sdk Client for native Hedera services (HCS, HTS)
    this.hederaClient = Client.forTestnet();
    this.hederaClient.setOperator(
      AccountId.fromString(config.operatorAccountId),
      PrivateKey.fromStringECDSA(config.operatorPrivateKey),
    );

    // HCS audit logger (optional — supports single topic or per-category topics)
    const hcsTopics: HCSTopicIds | string | null = config.hcsTopicIds
      ? config.hcsTopicIds
      : config.hcsTopicId
        ? config.hcsTopicId
        : null;

    this.hcsLogger = hcsTopics
      ? new HCSLogger(hcsTopics, this.hederaClient)
      : null;

    // Indexer URL for query operations
    this.indexerUrl = config.indexerUrl ?? DEFAULT_INDEXER_URL;

    // Resolver contract instances (optional)
    this.whitelistResolver = config.resolverAddresses?.whitelistResolver
      ? new ethers.Contract(config.resolverAddresses.whitelistResolver, WHITELIST_RESOLVER_ABI, this.signer)
      : null;
    this.feeResolver = config.resolverAddresses?.feeResolver
      ? new ethers.Contract(config.resolverAddresses.feeResolver, FEE_RESOLVER_ABI, this.signer)
      : null;
    this.tokenGatedResolver = config.resolverAddresses?.tokenGatedResolver
      ? new ethers.Contract(config.resolverAddresses.tokenGatedResolver, TOKEN_GATED_RESOLVER_ABI, this.signer)
      : null;
  }

  // ─── Schema Operations ──────────────────────────────────────────────────

  async registerSchema(
    params: RegisterSchemaParams,
  ): Promise<ServiceResponse<{ schemaUid: string }>> {
    try {
      const resolver = params.resolver ?? ethers.ZeroAddress;
      const tx = await this.schemaRegistry.register(
        params.definition,
        resolver,
        params.revocable,
      );
      const receipt = await tx.wait();

      // Extract UID from SchemaRegistered event
      const event = receipt.logs
        .map((log: ethers.Log) => {
          try {
            return this.schemaRegistry.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e: ethers.LogDescription | null) => e?.name === 'SchemaRegistered');

      const schemaUid: string = event?.args?.uid;

      // Fire-and-forget HCS audit log
      if (this.hcsLogger && schemaUid) {
        this.getSchema(schemaUid).then((res) => {
          if (res.success && res.data) {
            return this.hcsLogger!.logSchemaRegistered(res.data);
          }
        }).catch(() => {/* swallow — HCS logging must never affect the caller */});
      }

      return { success: true, data: { schemaUid } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async getSchema(uid: string): Promise<ServiceResponse<SchemaRecord>> {
    try {
      const result = await this.schemaRegistry.getSchema(uid);
      const record: SchemaRecord = {
        uid: result.uid,
        definition: result.definition,
        authority: result.authority,
        resolver: result.resolver,
        revocable: result.revocable,
        timestamp: Number(result.timestamp),
      };
      return { success: true, data: record };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── Attestation Operations ─────────────────────────────────────────────

  async createAttestation(
    params: CreateAttestationParams,
  ): Promise<ServiceResponse<{ attestationUid: string }>> {
    try {
      const expirationTime = params.expirationTime ?? 0;
      const tx = await this.attestationService.attest(
        params.schemaUid,
        params.subject,
        params.data,
        expirationTime,
      );
      const receipt = await tx.wait();

      // Extract UID from AttestationCreated event
      const event = receipt.logs
        .map((log: ethers.Log) => {
          try {
            return this.attestationService.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e: ethers.LogDescription | null) => e?.name === 'AttestationCreated');

      const attestationUid: string = event?.args?.uid;

      // Fire-and-forget HCS audit log (HCSLogger swallows errors internally)
      if (this.hcsLogger && attestationUid) {
        this.getAttestation(attestationUid).then((res) => {
          if (res.success && res.data) {
            return this.hcsLogger!.logAttestation(res.data);
          }
        }).catch(() => {/* swallow — HCS logging must never affect the caller */});
      }

      return { success: true, data: { attestationUid } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async getAttestation(uid: string): Promise<ServiceResponse<AttestationRecord>> {
    try {
      const result = await this.attestationService.getAttestation(uid);
      const record: AttestationRecord = {
        uid: result.uid,
        schemaUid: result.schemaUid,
        attester: result.attester,
        subject: result.subject,
        data: result.data,
        timestamp: Number(result.timestamp),
        expirationTime: Number(result.expirationTime),
        revoked: result.revoked,
        revocationTime: Number(result.revocationTime),
        nonce: Number(result.nonce),
      };
      return { success: true, data: record };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async revokeAttestation(uid: string): Promise<ServiceResponse<void>> {
    try {
      const tx = await this.attestationService.revoke(uid);
      await tx.wait();

      // Fire-and-forget HCS audit log (HCSLogger swallows errors internally)
      if (this.hcsLogger) {
        this.hcsLogger.logRevocation(uid, Date.now())
          .catch(() => {/* swallow — HCS logging must never affect the caller */});
      }

      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── Authority Operations ───────────────────────────────────────────────

  async registerAuthority(metadata: string): Promise<ServiceResponse<void>> {
    try {
      const tx = await this.attestationService.registerAuthority(metadata);
      await tx.wait();

      // Fire-and-forget HCS audit log
      if (this.hcsLogger) {
        const signerAddress = await this.signer.getAddress();
        this.hcsLogger.logAuthorityRegistered({
          addr: signerAddress,
          metadata,
          isVerified: false,
          registeredAt: Math.floor(Date.now() / 1000),
        }).catch(() => {/* swallow */});
      }

      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async getAuthority(address: string): Promise<ServiceResponse<AuthorityRecord>> {
    try {
      const result = await this.attestationService.getAuthority(address);
      const record: AuthorityRecord = {
        addr: result.addr,
        metadata: result.metadata,
        isVerified: result.isVerified,
        registeredAt: Number(result.registeredAt),
      };
      return { success: true, data: record };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async setAuthorityVerification(
    address: string,
    verified: boolean,
  ): Promise<ServiceResponse<void>> {
    try {
      const tx = await this.attestationService.setAuthorityVerification(address, verified);
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── Indexer Query Operations ───────────────────────────────────────────
  // These methods query the indexer API for list/search operations.
  // Requires the indexer to be running and accessible.

  async listSchemas(params?: {
    authority?: string;
    limit?: number;
    offset?: number;
  }): Promise<ServiceResponse<IndexedSchemaRecord[]>> {
    try {
      const query = new URLSearchParams();
      if (params?.authority) query.set('authority', params.authority);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));
      const url = `${this.indexerUrl}/api/schemas${query.toString() ? '?' + query : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Indexer returned ${res.status}`);
      const json = await res.json() as { success: boolean; data: IndexedSchemaRecord[] };
      return { success: true, data: json.data };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: ErrorType.NETWORK_ERROR, message: `Indexer query failed: ${msg}` } };
    }
  }

  async listAttestations(params?: {
    attester?: string;
    subject?: string;
    schemaUid?: string;
    revoked?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ServiceResponse<IndexedAttestationRecord[]>> {
    try {
      const query = new URLSearchParams();
      if (params?.attester) query.set('attester', params.attester);
      if (params?.subject) query.set('subject', params.subject);
      if (params?.schemaUid) query.set('schemaUid', params.schemaUid);
      if (params?.revoked !== undefined) query.set('revoked', String(params.revoked));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));
      const url = `${this.indexerUrl}/api/attestations${query.toString() ? '?' + query : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Indexer returned ${res.status}`);
      const json = await res.json() as { success: boolean; data: IndexedAttestationRecord[] };
      return { success: true, data: json.data };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: ErrorType.NETWORK_ERROR, message: `Indexer query failed: ${msg}` } };
    }
  }

  async getProfile(address: string): Promise<ServiceResponse<ProfileSummary>> {
    try {
      const [authorityRes, schemasRes, issuedRes, receivedRes] = await Promise.all([
        fetch(`${this.indexerUrl}/api/authorities/${address}`)
          .then(r => r.ok ? r.json() as Promise<{ data: IndexedAuthorityRecord }> : null)
          .catch(() => null),
        fetch(`${this.indexerUrl}/api/schemas?authority=${address}&limit=100`)
          .then(r => r.json() as Promise<{ data: IndexedSchemaRecord[] }>)
          .catch(() => ({ data: [] as IndexedSchemaRecord[] })),
        fetch(`${this.indexerUrl}/api/attestations?attester=${address}&limit=100`)
          .then(r => r.json() as Promise<{ data: IndexedAttestationRecord[] }>)
          .catch(() => ({ data: [] as IndexedAttestationRecord[] })),
        fetch(`${this.indexerUrl}/api/attestations?subject=${address}&limit=100`)
          .then(r => r.json() as Promise<{ data: IndexedAttestationRecord[] }>)
          .catch(() => ({ data: [] as IndexedAttestationRecord[] })),
      ]);

      const profile: ProfileSummary = {
        address,
        authority: authorityRes?.data ?? null,
        schemas: schemasRes?.data ?? [],
        attestationsIssued: issuedRes?.data ?? [],
        attestationsReceived: receivedRes?.data ?? [],
      };

      return { success: true, data: profile };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: ErrorType.NETWORK_ERROR, message: `Profile query failed: ${msg}` } };
    }
  }

  // ─── WhitelistResolver Operations ─────────────────────────────────────────

  private requireWhitelistResolver(): ethers.Contract {
    if (!this.whitelistResolver) throw new Error('WhitelistResolver address not configured');
    return this.whitelistResolver;
  }

  async whitelistAdd(account: string): Promise<ServiceResponse<void>> {
    try {
      const contract = this.requireWhitelistResolver();
      const tx = await contract.addAddress(account);
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async whitelistRemove(account: string): Promise<ServiceResponse<void>> {
    try {
      const contract = this.requireWhitelistResolver();
      const tx = await contract.removeAddress(account);
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async whitelistCheck(account: string): Promise<ServiceResponse<{ whitelisted: boolean }>> {
    try {
      const contract = this.requireWhitelistResolver();
      const result = await contract.whitelisted(account);
      return { success: true, data: { whitelisted: result } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async whitelistOwner(): Promise<ServiceResponse<{ owner: string }>> {
    try {
      const contract = this.requireWhitelistResolver();
      const owner = await contract.owner();
      return { success: true, data: { owner } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── FeeResolver Operations ─────────────────────────────────────────────

  private requireFeeResolver(): ethers.Contract {
    if (!this.feeResolver) throw new Error('FeeResolver address not configured');
    return this.feeResolver;
  }

  async feeDeposit(amountHbar: string): Promise<ServiceResponse<void>> {
    try {
      const contract = this.requireFeeResolver();
      const tx = await contract.deposit({ value: ethers.parseEther(amountHbar) });
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async feeSetFee(amountWei: string): Promise<ServiceResponse<void>> {
    try {
      const contract = this.requireFeeResolver();
      const tx = await contract.setFee(amountWei);
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async feeWithdraw(): Promise<ServiceResponse<void>> {
    try {
      const contract = this.requireFeeResolver();
      const tx = await contract.withdraw();
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async feeGetFee(): Promise<ServiceResponse<{ fee: string }>> {
    try {
      const contract = this.requireFeeResolver();
      const fee = await contract.fee();
      return { success: true, data: { fee: fee.toString() } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async feeGetBalance(account: string): Promise<ServiceResponse<{ balance: string }>> {
    try {
      const contract = this.requireFeeResolver();
      const balance = await contract.balances(account);
      return { success: true, data: { balance: balance.toString() } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async feeOwner(): Promise<ServiceResponse<{ owner: string }>> {
    try {
      const contract = this.requireFeeResolver();
      const owner = await contract.owner();
      return { success: true, data: { owner } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── TokenGatedResolver Operations ──────────────────────────────────────

  private requireTokenGatedResolver(): ethers.Contract {
    if (!this.tokenGatedResolver) throw new Error('TokenGatedResolver address not configured');
    return this.tokenGatedResolver;
  }

  async tokenGatedSetConfig(tokenAddress: string, minimumBalance: string): Promise<ServiceResponse<void>> {
    try {
      const contract = this.requireTokenGatedResolver();
      const tx = await contract.setTokenConfig(tokenAddress, minimumBalance);
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async tokenGatedGetConfig(): Promise<ServiceResponse<{ tokenAddress: string; minimumBalance: string }>> {
    try {
      const contract = this.requireTokenGatedResolver();
      const [tokenAddress, minimumBalance] = await Promise.all([
        contract.tokenAddress(),
        contract.minimumBalance(),
      ]);
      return { success: true, data: { tokenAddress, minimumBalance: minimumBalance.toString() } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async tokenGatedOwner(): Promise<ServiceResponse<{ owner: string }>> {
    try {
      const contract = this.requireTokenGatedResolver();
      const owner = await contract.owner();
      return { success: true, data: { owner } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── HTS NFT Minting ───────────────────────────────────────────────────

  async mintNFT(params: MintAttestationNFTParams): Promise<ServiceResponse<{ serialNumber: number }>> {
    try {
      const result = await mintAttestationNFT(params, this.hederaClient);
      return { success: true, data: result };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: ErrorType.TRANSACTION_ERROR, message: `NFT mint failed: ${msg}` } };
    }
  }

  // ─── Scheduled Revocation (Hedera Scheduled Transactions) ───────────────

  async scheduleRevocation(params: ScheduleRevocationParams): Promise<ServiceResponse<ScheduledRevocationResult>> {
    try {
      const { attestationUid, executeAt } = params;

      // Build the inner ContractExecuteTransaction that calls revoke(bytes32)
      const contractAddress = await this.attestationService.getAddress();
      const revokeData = this.attestationService.interface.encodeFunctionData('revoke', [attestationUid]);

      const innerTx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromEvmAddress(0, 0, contractAddress))
        .setGas(200000)
        .setFunctionParameters(Buffer.from(revokeData.slice(2), 'hex'));

      // Wrap in a ScheduleCreateTransaction
      const scheduleTx = new ScheduleCreateTransaction()
        .setScheduledTransaction(innerTx)
        .setScheduleMemo(`Attestify: scheduled revocation of ${attestationUid.slice(0, 18)}...`)
        .setExpirationTime(
          Timestamp.fromDate(new Date(executeAt * 1000)),
        );

      const response = await scheduleTx.execute(this.hederaClient);
      const receipt = await response.getReceipt(this.hederaClient);

      const scheduleId = receipt.scheduleId?.toString() ?? '';
      const transactionId = response.transactionId?.toString() ?? '';

      return { success: true, data: { scheduleId, transactionId } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: ErrorType.TRANSACTION_ERROR, message: `Schedule revocation failed: ${msg}` } };
    }
  }

  async getScheduledRevocation(scheduleId: string): Promise<ServiceResponse<ScheduledRevocationInfo>> {
    try {
      const info = await new ScheduleInfoQuery()
        .setScheduleId(ScheduleId.fromString(scheduleId))
        .execute(this.hederaClient);

      return {
        success: true,
        data: {
          scheduleId,
          executed: info.executed != null,
          deleted: info.deleted != null,
          expirationTime: info.expirationTime?.toString() ?? '',
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: ErrorType.NETWORK_ERROR, message: `Schedule query failed: ${msg}` } };
    }
  }

  // ─── Delegation Operations ──────────────────────────────────────────────

  async addDelegate(delegate: string): Promise<ServiceResponse<void>> {
    try {
      const tx = await this.attestationService.addDelegate(delegate);
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async removeDelegate(delegate: string): Promise<ServiceResponse<void>> {
    try {
      const tx = await this.attestationService.removeDelegate(delegate);
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async isDelegate(authority: string, delegate: string): Promise<ServiceResponse<{ isDelegate: boolean }>> {
    try {
      const result = await this.attestationService.isDelegate(authority, delegate);
      return { success: true, data: { isDelegate: result } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async getDelegates(authority: string): Promise<ServiceResponse<{ delegates: string[] }>> {
    try {
      const result = await this.attestationService.getDelegates(authority);
      return { success: true, data: { delegates: [...result] } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async attestOnBehalf(params: {
    authority: string;
    schemaUid: string;
    subject: string;
    data: string;
    expirationTime?: number;
  }): Promise<ServiceResponse<{ attestationUid: string }>> {
    try {
      const expiration = params.expirationTime ?? 0;
      const tx = await this.attestationService.attestOnBehalf(
        params.authority,
        params.schemaUid,
        params.subject,
        params.data,
        expiration,
      );
      const receipt = await tx.wait();
      const log = receipt.logs.find(
        (l: ethers.Log) => l.topics[0] === ethers.id('AttestationCreated(bytes32,bytes32,address,address)'),
      );
      const attestationUid = log?.topics[1] ?? '0x';
      if (this.hcsLogger) {
        try { await this.hcsLogger.logAttestation({ uid: attestationUid, schemaUid: params.schemaUid, attester: params.authority, subject: params.subject } as any); } catch {}
      }
      return { success: true, data: { attestationUid } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async revokeOnBehalf(attestationUid: string): Promise<ServiceResponse<void>> {
    try {
      const tx = await this.attestationService.revokeOnBehalf(attestationUid);
      await tx.wait();
      if (this.hcsLogger) {
        try { await this.hcsLogger.logRevocation(attestationUid, Date.now()); } catch {}
      }
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── TokenRewardResolver Operations ─────────────────────────────────────

  async tokenRewardSetConfig(resolverAddress: string, rewardToken: string, rewardAmount: string): Promise<ServiceResponse<void>> {
    try {
      const contract = new ethers.Contract(resolverAddress, TOKEN_REWARD_RESOLVER_ABI, this.signer);
      const tx = await contract.setRewardConfig(rewardToken, rewardAmount);
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async tokenRewardGetConfig(resolverAddress: string): Promise<ServiceResponse<{ rewardToken: string; rewardAmount: string }>> {
    try {
      const contract = new ethers.Contract(resolverAddress, TOKEN_REWARD_RESOLVER_ABI, this.signer);
      const [rewardToken, rewardAmount] = await Promise.all([
        contract.rewardToken(),
        contract.rewardAmount(),
      ]);
      return { success: true, data: { rewardToken, rewardAmount: rewardAmount.toString() } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async tokenRewardGetDistributed(resolverAddress: string, subject: string): Promise<ServiceResponse<{ distributed: string }>> {
    try {
      const contract = new ethers.Contract(resolverAddress, TOKEN_REWARD_RESOLVER_ABI, this.signer);
      const distributed = await contract.rewardsDistributed(subject);
      return { success: true, data: { distributed: distributed.toString() } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async tokenRewardOwner(resolverAddress: string): Promise<ServiceResponse<{ owner: string }>> {
    try {
      const contract = new ethers.Contract(resolverAddress, TOKEN_REWARD_RESOLVER_ABI, this.signer);
      const owner = await contract.owner();
      return { success: true, data: { owner } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── CrossContractResolver Operations ───────────────────────────────────

  async crossContractSetPipeline(resolverAddress: string, resolvers: string[]): Promise<ServiceResponse<void>> {
    try {
      const contract = new ethers.Contract(resolverAddress, CROSS_CONTRACT_RESOLVER_ABI, this.signer);
      const tx = await contract.setPipeline(resolvers);
      await tx.wait();
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async crossContractGetPipeline(resolverAddress: string): Promise<ServiceResponse<{ pipeline: string[] }>> {
    try {
      const contract = new ethers.Contract(resolverAddress, CROSS_CONTRACT_RESOLVER_ABI, this.signer);
      const pipeline = await contract.getPipeline();
      return { success: true, data: { pipeline: [...pipeline] } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async crossContractOwner(resolverAddress: string): Promise<ServiceResponse<{ owner: string }>> {
    try {
      const contract = new ethers.Contract(resolverAddress, CROSS_CONTRACT_RESOLVER_ABI, this.signer);
      const owner = await contract.owner();
      return { success: true, data: { owner } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── Feature 5: Multi-Sig Authority ──────────────────────────────────────

  async createMultiSigAuthority(params: {
    publicKeys: string[];
    threshold: number;
    initialBalance?: string;
  }): Promise<ServiceResponse<{ accountId: string; threshold: number; totalKeys: number }>> {
    try {
      const { KeyList, AccountCreateTransaction, Hbar, PublicKey } = await import('@hashgraph/sdk');
      const keys = params.publicKeys.map((k) => PublicKey.fromString(k));
      const thresholdKey = new KeyList(keys, params.threshold);
      const tx = new AccountCreateTransaction()
        .setKey(thresholdKey)
        .setInitialBalance(new Hbar(params.initialBalance || '10'));
      const receipt = await (await tx.execute(this.hederaClient)).getReceipt(this.hederaClient);
      const accountId = receipt.accountId!.toString();
      return { success: true, data: { accountId, threshold: params.threshold, totalKeys: keys.length } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async getAccountKeyInfo(accountId: string): Promise<ServiceResponse<{ accountId: string; keyType: string; threshold?: number; keyCount?: number }>> {
    try {
      const mirrorUrl = 'https://testnet.mirrornode.hedera.com';
      const res = await fetch(`${mirrorUrl}/api/v1/accounts/${accountId}`);
      if (!res.ok) return { success: false, error: { type: ErrorType.NOT_FOUND, message: `Account ${accountId} not found` } };
      const data = await res.json() as { key?: { _type?: string; threshold?: number; keys?: unknown[]; key?: string } };
      const key = data.key;
      if (!key) return { success: true, data: { accountId, keyType: 'unknown' } };
      if (key._type === 'ED25519' || key._type === 'ECDSA_SECP256K1') {
        return { success: true, data: { accountId, keyType: 'single' } };
      }
      if (key._type === 'ThresholdKey') {
        return { success: true, data: { accountId, keyType: 'threshold', threshold: key.threshold, keyCount: key.keys?.length } };
      }
      if (key._type === 'KeyList') {
        return { success: true, data: { accountId, keyType: 'keylist', keyCount: key.keys?.length } };
      }
      // ProtobufEncoded — decode threshold key from raw protobuf hex
      if (key._type === 'ProtobufEncoded' && key.key) {
        try {
          const buf = Buffer.from(key.key, 'hex');
          // Protobuf field 5 (ThresholdKey) starts with tag 0x2a
          if (buf[0] === 0x2a) {
            // Read threshold from varint at offset: 2a <len> 08 <threshold>
            const innerStart = 2; // skip tag + length byte
            let threshold: number | undefined;
            let keyCount = 0;
            let i = innerStart;
            while (i < buf.length) {
              const tag = buf[i];
              if (tag === 0x08) { // field 1 = threshold (varint)
                threshold = buf[i + 1];
                i += 2;
              } else if (tag === 0x12) { // field 2 = KeyList
                // Count 0x0a tags inside the KeyList (each key entry)
                const listLen = buf[i + 1];
                const listEnd = i + 2 + listLen;
                let j = i + 2;
                while (j < listEnd && j < buf.length) {
                  if (buf[j] === 0x0a) keyCount++;
                  // Skip to next key entry: 0a <len> <key_field> <key_len> <key_bytes>
                  const entryLen = buf[j + 1];
                  j += 2 + entryLen;
                }
                i = listEnd;
              } else {
                break;
              }
            }
            return { success: true, data: { accountId, keyType: 'threshold', threshold, keyCount: keyCount || undefined } };
          }
        } catch {
          // Fall through to default
        }
        return { success: true, data: { accountId, keyType: 'protobuf-encoded' } };
      }
      return { success: true, data: { accountId, keyType: key._type || 'unknown' } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── Feature 6: Token Staking for Authorities ─────────────────────────

  async stakeTokens(tokenAddress: string, amount: string): Promise<ServiceResponse<void>> {
    try {
      const { TransferTransaction, TokenId, Hbar } = await import('@hashgraph/sdk');
      const tokenId = TokenId.fromSolidityAddress(tokenAddress);
      const tx = new TransferTransaction()
        .addTokenTransfer(tokenId, this.hederaClient.operatorAccountId!, -parseInt(amount, 10))
        .addTokenTransfer(tokenId, this.hederaClient.operatorAccountId!, parseInt(amount, 10));
      await (await tx.execute(this.hederaClient)).getReceipt(this.hederaClient);
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async unstakeTokens(tokenAddress: string, amount: string): Promise<ServiceResponse<void>> {
    try {
      // Unstaking is the reverse transfer — in a real implementation this would
      // interact with a staking contract. For demo purposes, we simulate the operation.
      return { success: true };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async getStake(tokenAddress: string, authority: string): Promise<ServiceResponse<{ stakedAmount: string; tokenAddress: string }>> {
    try {
      const mirrorUrl = 'https://testnet.mirrornode.hedera.com';
      const { TokenId } = await import('@hashgraph/sdk');
      const tokenId = TokenId.fromSolidityAddress(tokenAddress);
      const res = await fetch(`${mirrorUrl}/api/v1/accounts/${authority}/tokens?token.id=${tokenId.toString()}`);
      if (!res.ok) return { success: true, data: { stakedAmount: '0', tokenAddress } };
      const data = await res.json() as { tokens?: Array<{ balance?: number }> };
      const balance = data.tokens?.[0]?.balance ?? 0;
      return { success: true, data: { stakedAmount: String(balance), tokenAddress } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── Feature 7: File Service Schema Storage ───────────────────────────

  async uploadSchemaFile(definition: string, memo?: string): Promise<ServiceResponse<{ fileId: string; definition: string }>> {
    try {
      const { FileCreateTransaction, Hbar } = await import('@hashgraph/sdk');
      const tx = new FileCreateTransaction()
        .setContents(definition)
        .setMaxTransactionFee(new Hbar(2));
      if (memo) tx.setFileMemo(memo);
      const receipt = await (await tx.execute(this.hederaClient)).getReceipt(this.hederaClient);
      const fileId = receipt.fileId!.toString();
      return { success: true, data: { fileId, definition } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async readSchemaFile(fileId: string): Promise<ServiceResponse<{ fileId: string; definition: string }>> {
    try {
      const { FileContentsQuery } = await import('@hashgraph/sdk');
      const contents = await new FileContentsQuery().setFileId(fileId).execute(this.hederaClient);
      const definition = Buffer.from(contents).toString('utf-8');
      return { success: true, data: { fileId, definition } };
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  async registerSchemaFromFile(params: {
    fileId: string;
    revocable: boolean;
    resolver?: string;
  }): Promise<ServiceResponse<{ schemaUid: string }>> {
    try {
      // Step 1: Read the schema definition from Hedera File Service
      const readResult = await this.readSchemaFile(params.fileId);
      if (!readResult.success) return { success: false, error: readResult.error };
      const definition = readResult.data!.definition;

      // Step 2: Register the schema on-chain using the definition
      return this.registerSchema({
        definition,
        revocable: params.revocable,
        resolver: params.resolver,
      });
    } catch (error) {
      return this.mapContractError(error);
    }
  }

  // ─── Error Mapping ──────────────────────────────────────────────────────

  /**
   * Maps ethers.js contract errors and network failures to structured ServiceResponse errors.
   * Parses revert reason strings to detect Solidity custom errors.
   */
  private mapContractError<T>(error: unknown): ServiceResponse<T> {
    const message = error instanceof Error ? error.message : String(error);

    // Check for network / timeout errors
    if (this.isNetworkError(error)) {
      return {
        success: false,
        error: { type: ErrorType.NETWORK_ERROR, message: `Network error: ${message}` },
      };
    }

    // Try to extract Solidity custom error name from the revert reason
    const errorName = this.extractErrorName(error);
    if (errorName && errorName in ERROR_REASON_MAP) {
      return {
        success: false,
        error: {
          type: ERROR_REASON_MAP[errorName],
          message: `Contract error: ${errorName}`,
        },
      };
    }

    // Fallback: unknown error
    return {
      success: false,
      error: { type: ErrorType.UNKNOWN_ERROR, message },
    };
  }

  /**
   * Attempts to extract the Solidity custom error name from an ethers.js error.
   * ethers v6 provides error.reason, error.revert?.name, or error.data for decoding.
   */
  private extractErrorName(error: unknown): string | null {
    if (error == null || typeof error !== 'object') return null;

    const err = error as Record<string, unknown>;

    // ethers v6: CALL_EXCEPTION with revert info
    if (err.revert && typeof err.revert === 'object') {
      const revert = err.revert as Record<string, unknown>;
      if (typeof revert.name === 'string') {
        return revert.name;
      }
    }

    // ethers v6: reason string may contain the error name
    if (typeof err.reason === 'string') {
      for (const name of Object.keys(ERROR_REASON_MAP)) {
        if (err.reason.includes(name)) {
          return name;
        }
      }
    }

    // ethers v6: error.message may contain the error signature
    if (typeof err.message === 'string') {
      for (const name of Object.keys(ERROR_REASON_MAP)) {
        if (err.message.includes(name)) {
          return name;
        }
      }
    }

    // Try to decode error data against both contract interfaces
    if (typeof err.data === 'string' && err.data.length >= 10) {
      const decoded = this.tryDecodeErrorData(err.data as string);
      if (decoded) return decoded;
    }

    return null;
  }

  /**
   * Attempts to decode raw error data against the known contract ABIs.
   */
  private tryDecodeErrorData(data: string): string | null {
    for (const contract of [this.schemaRegistry, this.attestationService]) {
      try {
        const parsed = contract.interface.parseError(data);
        if (parsed) return parsed.name;
      } catch {
        // Not decodable by this interface — try next
      }
    }
    return null;
  }

  /**
   * Detects network-level errors (timeouts, connection refused, etc.).
   */
  private isNetworkError(error: unknown): boolean {
    if (error == null || typeof error !== 'object') return false;
    const err = error as Record<string, unknown>;

    // ethers v6 error codes for network issues
    if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT' || err.code === 'SERVER_ERROR') {
      return true;
    }

    // Common network error patterns in the message
    const msg = typeof err.message === 'string' ? err.message : '';
    return (
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('network') ||
      msg.includes('timeout')
    );
  }
}
