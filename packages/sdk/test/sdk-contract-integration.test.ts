/**
 * SDK ↔ Contract Integration Tests
 *
 * Verifies that HederaAttestService correctly interacts with the smart contracts:
 * 1. Calls the right contract methods with correct parameters
 * 2. Handles successful responses and maps them to ServiceResponse
 * 3. Handles contract reverts and maps them to structured errors
 * 4. Correctly computes UIDs that match on-chain derivation
 *
 * Since we can't connect to live Hedera testnet in CI, these tests mock the
 * ethers.js contract layer and verify the SDK's behavior end-to-end.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { HederaAttestService } from '../src/HederaAttestService';
import { AttestifyErrorType } from '../src/types';
import { computeSchemaUid, computeAttestationUid } from '../src/uid';
import type { HederaAttestServiceConfig } from '../src/types';

// ─── Mock ethers + @hashgraph/sdk ───────────────────────────────────────────

const mockSchemaRegistry = {
  register: vi.fn(),
  getSchema: vi.fn(),
  interface: {
    parseLog: vi.fn(),
    parseError: vi.fn().mockReturnValue(null),
  },
};

const mockAttestationService = {
  attest: vi.fn(),
  revoke: vi.fn(),
  getAttestation: vi.fn(),
  registerAuthority: vi.fn(),
  getAuthority: vi.fn(),
  setAuthorityVerification: vi.fn(),
  interface: {
    parseLog: vi.fn(),
    parseError: vi.fn().mockReturnValue(null),
  },
};

let contractCallCount = 0;

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
      Wallet: vi.fn().mockImplementation(() => ({})),
      Contract: vi.fn().mockImplementation(() => {
        // First call = SchemaRegistry, second = AttestationService
        contractCallCount++;
        if (contractCallCount % 2 === 1) return mockSchemaRegistry;
        return mockAttestationService;
      }),
      ZeroAddress: actual.ethers.ZeroAddress,
    },
  };
});

vi.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: vi.fn().mockReturnValue({ setOperator: vi.fn() }),
  },
  AccountId: { fromString: vi.fn().mockReturnValue({}) },
  PrivateKey: { fromStringECDSA: vi.fn().mockReturnValue({}) },
}));

// ─── Test Config ────────────────────────────────────────────────────────────

const TEST_CONFIG: HederaAttestServiceConfig = {
  network: 'testnet',
  operatorAccountId: '0.0.12345',
  operatorPrivateKey: '0x' + 'ab'.repeat(32),
  contractAddresses: {
    schemaRegistry: '0x' + '11'.repeat(20),
    attestationService: '0x' + '22'.repeat(20),
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTxReceipt(logs: Array<{ name: string; args: Record<string, unknown> }>) {
  return {
    logs: logs.map((log) => ({
      topics: ['0x' + 'ff'.repeat(32)],
      data: '0x',
    })),
  };
}


// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SDK ↔ Contract Integration', () => {
  let service: HederaAttestService;

  beforeEach(() => {
    vi.clearAllMocks();
    contractCallCount = 0;
    service = new HederaAttestService(TEST_CONFIG);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Correct contract method calls with correct parameters
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Schema operations — correct contract calls', () => {
    it('registerSchema calls register() with definition, resolver, revocable', async () => {
      const schemaUid = '0x' + 'aa'.repeat(32);
      const tx = { wait: vi.fn().mockResolvedValue({ logs: [] }) };
      mockSchemaRegistry.register.mockResolvedValue(tx);
      mockSchemaRegistry.interface.parseLog.mockReturnValue(null);

      await service.registerSchema({
        definition: 'string name, uint256 age',
        resolver: '0x' + 'cc'.repeat(20),
        revocable: true,
      });

      expect(mockSchemaRegistry.register).toHaveBeenCalledWith(
        'string name, uint256 age',
        '0x' + 'cc'.repeat(20),
        true,
      );
    });

    it('registerSchema defaults resolver to ZeroAddress when omitted', async () => {
      const tx = { wait: vi.fn().mockResolvedValue({ logs: [] }) };
      mockSchemaRegistry.register.mockResolvedValue(tx);
      mockSchemaRegistry.interface.parseLog.mockReturnValue(null);

      await service.registerSchema({
        definition: 'bool active',
        revocable: false,
      });

      expect(mockSchemaRegistry.register).toHaveBeenCalledWith(
        'bool active',
        ethers.ZeroAddress,
        false,
      );
    });

    it('getSchema calls getSchema() with the provided UID', async () => {
      const uid = '0x' + 'dd'.repeat(32);
      mockSchemaRegistry.getSchema.mockResolvedValue({
        uid,
        definition: 'string x',
        authority: '0x' + 'aa'.repeat(20),
        resolver: ethers.ZeroAddress,
        revocable: true,
        timestamp: BigInt(1700000000),
      });

      await service.getSchema(uid);

      expect(mockSchemaRegistry.getSchema).toHaveBeenCalledWith(uid);
    });
  });

  describe('Attestation operations — correct contract calls', () => {
    it('createAttestation calls attest() with schemaUid, subject, data, expirationTime', async () => {
      const tx = { wait: vi.fn().mockResolvedValue({ logs: [] }) };
      mockAttestationService.attest.mockResolvedValue(tx);
      mockAttestationService.interface.parseLog.mockReturnValue(null);

      const params = {
        schemaUid: '0x' + 'aa'.repeat(32),
        subject: '0x' + 'bb'.repeat(20),
        data: '0x1234',
        expirationTime: 1800000000,
      };

      await service.createAttestation(params);

      expect(mockAttestationService.attest).toHaveBeenCalledWith(
        params.schemaUid,
        params.subject,
        params.data,
        params.expirationTime,
      );
    });

    it('createAttestation defaults expirationTime to 0 when omitted', async () => {
      const tx = { wait: vi.fn().mockResolvedValue({ logs: [] }) };
      mockAttestationService.attest.mockResolvedValue(tx);
      mockAttestationService.interface.parseLog.mockReturnValue(null);

      await service.createAttestation({
        schemaUid: '0x' + 'aa'.repeat(32),
        subject: '0x' + 'bb'.repeat(20),
        data: '0x',
      });

      expect(mockAttestationService.attest).toHaveBeenCalledWith(
        '0x' + 'aa'.repeat(32),
        '0x' + 'bb'.repeat(20),
        '0x',
        0,
      );
    });

    it('revokeAttestation calls revoke() with the attestation UID', async () => {
      const uid = '0x' + 'ee'.repeat(32);
      const tx = { wait: vi.fn().mockResolvedValue({}) };
      mockAttestationService.revoke.mockResolvedValue(tx);

      await service.revokeAttestation(uid);

      expect(mockAttestationService.revoke).toHaveBeenCalledWith(uid);
    });

    it('getAttestation calls getAttestation() with the provided UID', async () => {
      const uid = '0x' + 'ff'.repeat(32);
      mockAttestationService.getAttestation.mockResolvedValue({
        uid,
        schemaUid: '0x' + 'aa'.repeat(32),
        attester: '0x' + 'bb'.repeat(20),
        subject: '0x' + 'cc'.repeat(20),
        data: '0x1234',
        timestamp: BigInt(1700000000),
        expirationTime: BigInt(0),
        revoked: false,
        revocationTime: BigInt(0),
        nonce: BigInt(0),
      });

      await service.getAttestation(uid);

      expect(mockAttestationService.getAttestation).toHaveBeenCalledWith(uid);
    });
  });

  describe('Authority operations — correct contract calls', () => {
    it('registerAuthority calls registerAuthority() with metadata', async () => {
      const tx = { wait: vi.fn().mockResolvedValue({}) };
      mockAttestationService.registerAuthority.mockResolvedValue(tx);

      await service.registerAuthority('My Authority');

      expect(mockAttestationService.registerAuthority).toHaveBeenCalledWith('My Authority');
    });

    it('getAuthority calls getAuthority() with the address', async () => {
      const addr = '0x' + 'ab'.repeat(20);
      mockAttestationService.getAuthority.mockResolvedValue({
        addr,
        metadata: 'test',
        isVerified: false,
        registeredAt: BigInt(1700000000),
      });

      await service.getAuthority(addr);

      expect(mockAttestationService.getAuthority).toHaveBeenCalledWith(addr);
    });

    it('setAuthorityVerification calls setAuthorityVerification() with address and verified flag', async () => {
      const tx = { wait: vi.fn().mockResolvedValue({}) };
      mockAttestationService.setAuthorityVerification.mockResolvedValue(tx);

      const addr = '0x' + 'cd'.repeat(20);
      await service.setAuthorityVerification(addr, true);

      expect(mockAttestationService.setAuthorityVerification).toHaveBeenCalledWith(addr, true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Successful responses mapped to ServiceResponse
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Successful responses → ServiceResponse mapping', () => {
    it('registerSchema returns success with schemaUid from event', async () => {
      const schemaUid = '0x' + 'aa'.repeat(32);
      const receipt = {
        logs: [{ topics: ['0x' + 'ff'.repeat(32)], data: '0x' }],
      };
      const tx = { wait: vi.fn().mockResolvedValue(receipt) };
      mockSchemaRegistry.register.mockResolvedValue(tx);
      mockSchemaRegistry.interface.parseLog.mockReturnValue({
        name: 'SchemaRegistered',
        args: { uid: schemaUid, authority: '0x' + 'bb'.repeat(20), resolver: ethers.ZeroAddress },
      });

      const response = await service.registerSchema({
        definition: 'string name',
        revocable: true,
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ schemaUid });
      expect(response.error).toBeUndefined();
    });

    it('getSchema returns success with mapped SchemaRecord', async () => {
      const uid = '0x' + 'dd'.repeat(32);
      const authority = '0x' + 'aa'.repeat(20);
      mockSchemaRegistry.getSchema.mockResolvedValue({
        uid,
        definition: 'string name, uint256 age',
        authority,
        resolver: ethers.ZeroAddress,
        revocable: true,
        timestamp: BigInt(1700000000),
      });

      const response = await service.getSchema(uid);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        uid,
        definition: 'string name, uint256 age',
        authority,
        resolver: ethers.ZeroAddress,
        revocable: true,
        timestamp: 1700000000,
      });
    });

    it('createAttestation returns success with attestationUid from event', async () => {
      const attestationUid = '0x' + 'bb'.repeat(32);
      const receipt = {
        logs: [{ topics: ['0x' + 'ff'.repeat(32)], data: '0x' }],
      };
      const tx = { wait: vi.fn().mockResolvedValue(receipt) };
      mockAttestationService.attest.mockResolvedValue(tx);
      mockAttestationService.interface.parseLog.mockReturnValue({
        name: 'AttestationCreated',
        args: {
          uid: attestationUid,
          schemaUid: '0x' + 'aa'.repeat(32),
          attester: '0x' + 'cc'.repeat(20),
          subject: '0x' + 'dd'.repeat(20),
        },
      });

      const response = await service.createAttestation({
        schemaUid: '0x' + 'aa'.repeat(32),
        subject: '0x' + 'dd'.repeat(20),
        data: '0x1234',
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ attestationUid });
      expect(response.error).toBeUndefined();
    });

    it('getAttestation returns success with mapped AttestationRecord', async () => {
      const uid = '0x' + 'ee'.repeat(32);
      const schemaUid = '0x' + 'aa'.repeat(32);
      const attester = '0x' + 'bb'.repeat(20);
      const subject = '0x' + 'cc'.repeat(20);

      mockAttestationService.getAttestation.mockResolvedValue({
        uid,
        schemaUid,
        attester,
        subject,
        data: '0xabcd',
        timestamp: BigInt(1700000000),
        expirationTime: BigInt(1800000000),
        revoked: false,
        revocationTime: BigInt(0),
        nonce: BigInt(5),
      });

      const response = await service.getAttestation(uid);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        uid,
        schemaUid,
        attester,
        subject,
        data: '0xabcd',
        timestamp: 1700000000,
        expirationTime: 1800000000,
        revoked: false,
        revocationTime: 0,
        nonce: 5,
      });
    });

    it('getAttestation maps revoked attestation correctly', async () => {
      const uid = '0x' + 'ff'.repeat(32);
      mockAttestationService.getAttestation.mockResolvedValue({
        uid,
        schemaUid: '0x' + 'aa'.repeat(32),
        attester: '0x' + 'bb'.repeat(20),
        subject: '0x' + 'cc'.repeat(20),
        data: '0x',
        timestamp: BigInt(1700000000),
        expirationTime: BigInt(0),
        revoked: true,
        revocationTime: BigInt(1700001000),
        nonce: BigInt(0),
      });

      const response = await service.getAttestation(uid);

      expect(response.success).toBe(true);
      expect(response.data!.revoked).toBe(true);
      expect(response.data!.revocationTime).toBe(1700001000);
    });

    it('revokeAttestation returns success with no data', async () => {
      const tx = { wait: vi.fn().mockResolvedValue({}) };
      mockAttestationService.revoke.mockResolvedValue(tx);

      const response = await service.revokeAttestation('0x' + 'aa'.repeat(32));

      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
    });

    it('registerAuthority returns success with no data', async () => {
      const tx = { wait: vi.fn().mockResolvedValue({}) };
      mockAttestationService.registerAuthority.mockResolvedValue(tx);

      const response = await service.registerAuthority('Test Authority');

      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
    });

    it('getAuthority returns success with mapped AuthorityRecord', async () => {
      const addr = '0x' + 'ab'.repeat(20);
      mockAttestationService.getAuthority.mockResolvedValue({
        addr,
        metadata: 'Verified Issuer',
        isVerified: true,
        registeredAt: BigInt(1700000000),
      });

      const response = await service.getAuthority(addr);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        addr,
        metadata: 'Verified Issuer',
        isVerified: true,
        registeredAt: 1700000000,
      });
    });

    it('setAuthorityVerification returns success with no data', async () => {
      const tx = { wait: vi.fn().mockResolvedValue({}) };
      mockAttestationService.setAuthorityVerification.mockResolvedValue(tx);

      const response = await service.setAuthorityVerification('0x' + 'ab'.repeat(20), true);

      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Contract reverts mapped to structured errors
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Contract reverts → structured error mapping', () => {
    it('SchemaAlreadyExists revert → ALREADY_EXISTS on registerSchema', async () => {
      const error = Object.assign(new Error('call revert'), {
        code: 'CALL_EXCEPTION',
        revert: { name: 'SchemaAlreadyExists', args: [] },
      });
      mockSchemaRegistry.register.mockRejectedValue(error);

      const response = await service.registerSchema({
        definition: 'string name',
        revocable: true,
      });

      expect(response.success).toBe(false);
      expect(response.error!.type).toBe(AttestifyErrorType.ALREADY_EXISTS);
      expect(response.error!.message).toContain('SchemaAlreadyExists');
    });

    it('SchemaNotFound revert → NOT_FOUND on getSchema', async () => {
      const error = Object.assign(new Error('call revert'), {
        code: 'CALL_EXCEPTION',
        revert: { name: 'SchemaNotFound', args: [] },
      });
      mockSchemaRegistry.getSchema.mockRejectedValue(error);

      const response = await service.getSchema('0x' + '00'.repeat(32));

      expect(response.success).toBe(false);
      expect(response.error!.type).toBe(AttestifyErrorType.NOT_FOUND);
    });

    it('UnauthorizedRevoker revert → UNAUTHORIZED on revokeAttestation', async () => {
      const error = Object.assign(new Error('call revert'), {
        code: 'CALL_EXCEPTION',
        revert: { name: 'UnauthorizedRevoker', args: [] },
      });
      mockAttestationService.revoke.mockRejectedValue(error);

      const response = await service.revokeAttestation('0x' + 'aa'.repeat(32));

      expect(response.success).toBe(false);
      expect(response.error!.type).toBe(AttestifyErrorType.UNAUTHORIZED);
    });

    it('AttestationAlreadyRevoked revert → ALREADY_REVOKED on revokeAttestation', async () => {
      const error = Object.assign(new Error('call revert'), {
        code: 'CALL_EXCEPTION',
        revert: { name: 'AttestationAlreadyRevoked', args: [] },
      });
      mockAttestationService.revoke.mockRejectedValue(error);

      const response = await service.revokeAttestation('0x' + 'bb'.repeat(32));

      expect(response.success).toBe(false);
      expect(response.error!.type).toBe(AttestifyErrorType.ALREADY_REVOKED);
    });

    it('SchemaNotRevocable revert → VALIDATION_ERROR on revokeAttestation', async () => {
      const error = Object.assign(new Error('call revert'), {
        code: 'CALL_EXCEPTION',
        revert: { name: 'SchemaNotRevocable', args: [] },
      });
      mockAttestationService.revoke.mockRejectedValue(error);

      const response = await service.revokeAttestation('0x' + 'cc'.repeat(32));

      expect(response.success).toBe(false);
      expect(response.error!.type).toBe(AttestifyErrorType.VALIDATION_ERROR);
    });

    it('ResolverRejected revert → RESOLVER_REJECTED on createAttestation', async () => {
      const error = Object.assign(new Error('call revert'), {
        code: 'CALL_EXCEPTION',
        revert: { name: 'ResolverRejected', args: [] },
      });
      mockAttestationService.attest.mockRejectedValue(error);

      const response = await service.createAttestation({
        schemaUid: '0x' + 'aa'.repeat(32),
        subject: '0x' + 'bb'.repeat(20),
        data: '0x',
      });

      expect(response.success).toBe(false);
      expect(response.error!.type).toBe(AttestifyErrorType.RESOLVER_REJECTED);
    });

    it('InvalidResolver revert → VALIDATION_ERROR on registerSchema', async () => {
      const error = Object.assign(new Error('call revert'), {
        code: 'CALL_EXCEPTION',
        revert: { name: 'InvalidResolver', args: [] },
      });
      mockSchemaRegistry.register.mockRejectedValue(error);

      const response = await service.registerSchema({
        definition: 'string x',
        resolver: '0x' + 'ff'.repeat(20),
        revocable: true,
      });

      expect(response.success).toBe(false);
      expect(response.error!.type).toBe(AttestifyErrorType.VALIDATION_ERROR);
    });

    it('network error → NETWORK_ERROR', async () => {
      const error = Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'NETWORK_ERROR',
      });
      mockSchemaRegistry.getSchema.mockRejectedValue(error);

      const response = await service.getSchema('0x' + 'aa'.repeat(32));

      expect(response.success).toBe(false);
      expect(response.error!.type).toBe(AttestifyErrorType.NETWORK_ERROR);
    });

    it('unknown error → UNKNOWN_ERROR', async () => {
      mockAttestationService.getAttestation.mockRejectedValue(
        new Error('something unexpected'),
      );

      const response = await service.getAttestation('0x' + 'aa'.repeat(32));

      expect(response.success).toBe(false);
      expect(response.error!.type).toBe(AttestifyErrorType.UNKNOWN_ERROR);
      expect(response.error!.message).toContain('something unexpected');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. UID computation consistency (off-chain matches on-chain derivation)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('UID computation — SDK matches on-chain derivation', () => {
    it('computeSchemaUid matches keccak256(abi.encode(definition, resolver, revocable))', () => {
      const definition = 'string name, uint256 age';
      const resolver = '0x' + 'ab'.repeat(20);
      const revocable = true;

      const coder = ethers.AbiCoder.defaultAbiCoder();
      const expected = ethers.keccak256(
        coder.encode(['string', 'address', 'bool'], [definition, resolver, revocable]),
      );

      expect(computeSchemaUid(definition, resolver, revocable)).toBe(expected);
    });

    it('computeSchemaUid with zero resolver matches on-chain default', () => {
      const definition = 'bool active';
      const revocable = false;

      const coder = ethers.AbiCoder.defaultAbiCoder();
      const expected = ethers.keccak256(
        coder.encode(['string', 'address', 'bool'], [definition, ethers.ZeroAddress, revocable]),
      );

      expect(computeSchemaUid(definition, undefined, revocable)).toBe(expected);
    });

    it('computeAttestationUid matches keccak256(abi.encode(schemaUid, subject, attester, data, nonce))', () => {
      const schemaUid = '0x' + 'aa'.repeat(32);
      const subject = '0x' + 'bb'.repeat(20);
      const attester = '0x' + 'cc'.repeat(20);
      const data = '0x1234abcd';
      const nonce = 42;

      const coder = ethers.AbiCoder.defaultAbiCoder();
      const expected = ethers.keccak256(
        coder.encode(
          ['bytes32', 'address', 'address', 'bytes', 'uint256'],
          [schemaUid, subject, attester, data, nonce],
        ),
      );

      expect(computeAttestationUid(schemaUid, subject, attester, data, nonce)).toBe(expected);
    });

    it('different nonces produce different attestation UIDs (uniqueness)', () => {
      const schemaUid = '0x' + 'aa'.repeat(32);
      const subject = '0x' + 'bb'.repeat(20);
      const attester = '0x' + 'cc'.repeat(20);
      const data = '0x1234';

      const uid0 = computeAttestationUid(schemaUid, subject, attester, data, 0);
      const uid1 = computeAttestationUid(schemaUid, subject, attester, data, 1);
      const uid2 = computeAttestationUid(schemaUid, subject, attester, data, 2);

      expect(uid0).not.toBe(uid1);
      expect(uid1).not.toBe(uid2);
      expect(uid0).not.toBe(uid2);
    });

    it('identical inputs produce identical UIDs (determinism)', () => {
      const schemaUid = '0x' + 'dd'.repeat(32);
      const subject = '0x' + 'ee'.repeat(20);
      const attester = '0x' + 'ff'.repeat(20);
      const data = '0xdeadbeef';
      const nonce = 7;

      const uid1 = computeAttestationUid(schemaUid, subject, attester, data, nonce);
      const uid2 = computeAttestationUid(schemaUid, subject, attester, data, nonce);

      expect(uid1).toBe(uid2);
    });

    it('schema UID is deterministic for same inputs', () => {
      const definition = 'address wallet, string label';
      const resolver = '0x' + '12'.repeat(20);
      const revocable = true;

      const uid1 = computeSchemaUid(definition, resolver, revocable);
      const uid2 = computeSchemaUid(definition, resolver, revocable);

      expect(uid1).toBe(uid2);
    });

    it('different definitions produce different schema UIDs', () => {
      const resolver = ethers.ZeroAddress;
      const uid1 = computeSchemaUid('string name', resolver, true);
      const uid2 = computeSchemaUid('uint256 score', resolver, true);

      expect(uid1).not.toBe(uid2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Full lifecycle: register → attest → verify → revoke → verify revoked
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Full attestation lifecycle (mocked)', () => {
    it('register schema → create attestation → get → revoke → get revoked', async () => {
      const schemaUid = '0x' + 'aa'.repeat(32);
      const attestationUid = '0x' + 'bb'.repeat(32);
      const attester = '0x' + 'cc'.repeat(20);
      const subject = '0x' + 'dd'.repeat(20);

      // Step 1: Register schema
      const registerTx = {
        wait: vi.fn().mockResolvedValue({
          logs: [{ topics: ['0x' + 'ff'.repeat(32)], data: '0x' }],
        }),
      };
      mockSchemaRegistry.register.mockResolvedValue(registerTx);
      mockSchemaRegistry.interface.parseLog.mockReturnValue({
        name: 'SchemaRegistered',
        args: { uid: schemaUid, authority: attester, resolver: ethers.ZeroAddress },
      });

      const schemaRes = await service.registerSchema({
        definition: 'string name',
        revocable: true,
      });
      expect(schemaRes.success).toBe(true);
      expect(schemaRes.data!.schemaUid).toBe(schemaUid);

      // Step 2: Create attestation
      const attestTx = {
        wait: vi.fn().mockResolvedValue({
          logs: [{ topics: ['0x' + 'ff'.repeat(32)], data: '0x' }],
        }),
      };
      mockAttestationService.attest.mockResolvedValue(attestTx);
      mockAttestationService.interface.parseLog.mockReturnValue({
        name: 'AttestationCreated',
        args: { uid: attestationUid, schemaUid, attester, subject },
      });

      const attestRes = await service.createAttestation({
        schemaUid,
        subject,
        data: '0x1234',
      });
      expect(attestRes.success).toBe(true);
      expect(attestRes.data!.attestationUid).toBe(attestationUid);

      // Step 3: Get attestation (active)
      mockAttestationService.getAttestation.mockResolvedValue({
        uid: attestationUid,
        schemaUid,
        attester,
        subject,
        data: '0x1234',
        timestamp: BigInt(1700000000),
        expirationTime: BigInt(0),
        revoked: false,
        revocationTime: BigInt(0),
        nonce: BigInt(0),
      });

      const getRes = await service.getAttestation(attestationUid);
      expect(getRes.success).toBe(true);
      expect(getRes.data!.revoked).toBe(false);
      expect(getRes.data!.attester).toBe(attester);
      expect(getRes.data!.subject).toBe(subject);

      // Step 4: Revoke attestation
      const revokeTx = { wait: vi.fn().mockResolvedValue({}) };
      mockAttestationService.revoke.mockResolvedValue(revokeTx);

      const revokeRes = await service.revokeAttestation(attestationUid);
      expect(revokeRes.success).toBe(true);

      // Step 5: Get attestation (revoked)
      mockAttestationService.getAttestation.mockResolvedValue({
        uid: attestationUid,
        schemaUid,
        attester,
        subject,
        data: '0x1234',
        timestamp: BigInt(1700000000),
        expirationTime: BigInt(0),
        revoked: true,
        revocationTime: BigInt(1700001000),
        nonce: BigInt(0),
      });

      const revokedRes = await service.getAttestation(attestationUid);
      expect(revokedRes.success).toBe(true);
      expect(revokedRes.data!.revoked).toBe(true);
      expect(revokedRes.data!.revocationTime).toBe(1700001000);
    });
  });
});
