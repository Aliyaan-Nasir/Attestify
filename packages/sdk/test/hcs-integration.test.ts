/**
 * HCS Integration Tests
 *
 * Verifies that HCS messages are correctly submitted after attestation operations
 * through the HederaAttestService integration layer:
 *
 * 1. HCS messages are submitted after successful attestation creation
 * 2. HCS messages are submitted after successful attestation revocation
 * 3. HCS message format follows the structured JSON schema (version, type, payload)
 * 4. HCS retry logic works (3 attempts with exponential backoff)
 * 5. HCS failures don't fail the parent attestation operation
 *
 * Since we can't connect to live Hedera testnet in CI, these tests mock the
 * @hashgraph/sdk and ethers.js layers and verify the integration behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock setup ──────────────────────────────────────────────────────────────

const mockExecute = vi.fn();
let capturedMessages: string[] = [];

vi.mock('@hashgraph/sdk', () => {
  return {
    Client: {
      forTestnet: vi.fn().mockReturnValue({ setOperator: vi.fn() }),
    },
    AccountId: { fromString: vi.fn().mockReturnValue({}) },
    PrivateKey: { fromStringECDSA: vi.fn().mockReturnValue({}) },
    TopicId: {
      fromString: vi.fn().mockReturnValue({ toString: () => '0.0.99999' }),
    },
    TopicMessageSubmitTransaction: vi.fn().mockImplementation(() => {
      return {
        setTopicId: vi.fn().mockReturnThis(),
        setMessage: vi.fn().mockImplementation(function (this: any, msg: string) {
          capturedMessages.push(msg);
          return this;
        }),
        execute: mockExecute,
      };
    }),
  };
});

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
        contractCallCount++;
        if (contractCallCount % 2 === 1) return mockSchemaRegistry;
        return mockAttestationService;
      }),
      ZeroAddress: actual.ethers.ZeroAddress,
    },
  };
});

import { HederaAttestService } from '../src/HederaAttestService';
import type { HederaAttestServiceConfig } from '../src/types';

// ─── Test Config (with HCS topic ID to enable HCS logging) ──────────────────

const TEST_CONFIG: HederaAttestServiceConfig = {
  network: 'testnet',
  operatorAccountId: '0.0.12345',
  operatorPrivateKey: '0x' + 'ab'.repeat(32),
  contractAddresses: {
    schemaRegistry: '0x' + '11'.repeat(20),
    attestationService: '0x' + '22'.repeat(20),
  },
  hcsTopicId: '0.0.99999',
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SCHEMA_UID = '0x' + 'aa'.repeat(32);
const ATTESTATION_UID = '0x' + 'bb'.repeat(32);
const ATTESTER = '0x' + 'cc'.repeat(20);
const SUBJECT = '0x' + 'dd'.repeat(20);

function setupAttestMocks() {
  const attestTx = {
    wait: vi.fn().mockResolvedValue({
      logs: [{ topics: ['0x' + 'ff'.repeat(32)], data: '0x' }],
    }),
  };
  mockAttestationService.attest.mockResolvedValue(attestTx);
  mockAttestationService.interface.parseLog.mockReturnValue({
    name: 'AttestationCreated',
    args: { uid: ATTESTATION_UID, schemaUid: SCHEMA_UID, attester: ATTESTER, subject: SUBJECT },
  });

  // Mock getAttestation for the fire-and-forget HCS log call
  mockAttestationService.getAttestation.mockResolvedValue({
    uid: ATTESTATION_UID,
    schemaUid: SCHEMA_UID,
    attester: ATTESTER,
    subject: SUBJECT,
    data: '0x1234',
    timestamp: BigInt(1700000000),
    expirationTime: BigInt(0),
    revoked: false,
    revocationTime: BigInt(0),
    nonce: BigInt(0),
  });
}

function setupRevokeMocks() {
  const revokeTx = { wait: vi.fn().mockResolvedValue({}) };
  mockAttestationService.revoke.mockResolvedValue(revokeTx);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HCS Integration — Messages after attestation operations', () => {
  let service: HederaAttestService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    contractCallCount = 0;
    capturedMessages = [];
    mockExecute.mockResolvedValue({ transactionId: 'tx-hcs' });
    service = new HederaAttestService(TEST_CONFIG);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. HCS messages submitted after successful attestation creation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('HCS message after attestation creation', () => {
    it('submits an HCS message after a successful createAttestation call', async () => {
      setupAttestMocks();

      const response = await service.createAttestation({
        schemaUid: SCHEMA_UID,
        subject: SUBJECT,
        data: '0x1234',
      });

      // Let the fire-and-forget HCS log resolve
      await vi.runAllTimersAsync();
      // Allow microtasks (promise chains) to flush
      await vi.advanceTimersByTimeAsync(0);

      expect(response.success).toBe(true);
      expect(mockExecute).toHaveBeenCalled();
      expect(capturedMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('HCS created message contains correct attestation.created type', async () => {
      setupAttestMocks();

      await service.createAttestation({
        schemaUid: SCHEMA_UID,
        subject: SUBJECT,
        data: '0x1234',
      });

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      const lastMsg = capturedMessages[capturedMessages.length - 1];
      const parsed = JSON.parse(lastMsg);
      expect(parsed.type).toBe('attestation.created');
      expect(parsed.version).toBe('1.0');
    });

    it('HCS created message payload contains attestationUid, schemaUid, attester, subject', async () => {
      setupAttestMocks();

      await service.createAttestation({
        schemaUid: SCHEMA_UID,
        subject: SUBJECT,
        data: '0x1234',
      });

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      const lastMsg = capturedMessages[capturedMessages.length - 1];
      const parsed = JSON.parse(lastMsg);
      expect(parsed.payload.attestationUid).toBe(ATTESTATION_UID);
      expect(parsed.payload.schemaUid).toBe(SCHEMA_UID);
      expect(parsed.payload.attester).toBe(ATTESTER);
      expect(parsed.payload.subject).toBe(SUBJECT);
      expect(typeof parsed.payload.timestamp).toBe('number');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. HCS messages submitted after successful attestation revocation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('HCS message after attestation revocation', () => {
    it('submits an HCS message after a successful revokeAttestation call', async () => {
      setupRevokeMocks();

      const response = await service.revokeAttestation(ATTESTATION_UID);

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      expect(response.success).toBe(true);
      expect(mockExecute).toHaveBeenCalled();
      expect(capturedMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('HCS revoked message contains correct attestation.revoked type', async () => {
      setupRevokeMocks();

      await service.revokeAttestation(ATTESTATION_UID);

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      const lastMsg = capturedMessages[capturedMessages.length - 1];
      const parsed = JSON.parse(lastMsg);
      expect(parsed.type).toBe('attestation.revoked');
      expect(parsed.version).toBe('1.0');
    });

    it('HCS revoked message payload contains attestationUid and revocationTimestamp', async () => {
      setupRevokeMocks();

      await service.revokeAttestation(ATTESTATION_UID);

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      const lastMsg = capturedMessages[capturedMessages.length - 1];
      const parsed = JSON.parse(lastMsg);
      expect(parsed.payload.attestationUid).toBe(ATTESTATION_UID);
      expect(typeof parsed.payload.revocationTimestamp).toBe('number');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. HCS message format follows structured JSON schema
  // ═══════════════════════════════════════════════════════════════════════════

  describe('HCS message format validation', () => {
    it('created message is valid JSON with version, type, and payload keys', async () => {
      setupAttestMocks();

      await service.createAttestation({
        schemaUid: SCHEMA_UID,
        subject: SUBJECT,
        data: '0x1234',
      });

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      const lastMsg = capturedMessages[capturedMessages.length - 1];
      const parsed = JSON.parse(lastMsg);
      expect(Object.keys(parsed).sort()).toEqual(['payload', 'type', 'version']);
    });

    it('revoked message is valid JSON with version, type, and payload keys', async () => {
      setupRevokeMocks();

      await service.revokeAttestation(ATTESTATION_UID);

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      const lastMsg = capturedMessages[capturedMessages.length - 1];
      const parsed = JSON.parse(lastMsg);
      expect(Object.keys(parsed).sort()).toEqual(['payload', 'type', 'version']);
    });

    it('created message payload has exactly 5 fields', async () => {
      setupAttestMocks();

      await service.createAttestation({
        schemaUid: SCHEMA_UID,
        subject: SUBJECT,
        data: '0x1234',
      });

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      const lastMsg = capturedMessages[capturedMessages.length - 1];
      const parsed = JSON.parse(lastMsg);
      expect(Object.keys(parsed.payload).sort()).toEqual(
        ['attestationUid', 'attester', 'schemaUid', 'subject', 'timestamp'].sort(),
      );
    });

    it('revoked message payload has exactly 2 fields', async () => {
      setupRevokeMocks();

      await service.revokeAttestation(ATTESTATION_UID);

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      const lastMsg = capturedMessages[capturedMessages.length - 1];
      const parsed = JSON.parse(lastMsg);
      expect(Object.keys(parsed.payload).sort()).toEqual(
        ['attestationUid', 'revocationTimestamp'].sort(),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. HCS retry logic (3 attempts with exponential backoff)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('HCS retry logic through attestation operations', () => {
    it('retries HCS submission and succeeds on second attempt after creation', async () => {
      setupAttestMocks();
      mockExecute
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockResolvedValueOnce({ transactionId: 'tx-retry' });

      const response = await service.createAttestation({
        schemaUid: SCHEMA_UID,
        subject: SUBJECT,
        data: '0x1234',
      });

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      expect(response.success).toBe(true);
      // execute called at least twice (1 fail + 1 success)
      expect(mockExecute.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('retries HCS submission and succeeds on second attempt after revocation', async () => {
      setupRevokeMocks();
      mockExecute
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockResolvedValueOnce({ transactionId: 'tx-retry-2' });

      const response = await service.revokeAttestation(ATTESTATION_UID);

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      expect(response.success).toBe(true);
      expect(mockExecute.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('exhausts all 3 retry attempts and logs warning', async () => {
      setupRevokeMocks();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockExecute
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockRejectedValueOnce(new Error('UNAVAILABLE'));

      const response = await service.revokeAttestation(ATTESTATION_UID);

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      expect(response.success).toBe(true);
      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. HCS failures don't fail the parent attestation operation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('HCS failures do not fail parent operations', () => {
    it('createAttestation succeeds even when HCS submission fails completely', async () => {
      setupAttestMocks();
      mockExecute.mockRejectedValue(new Error('HCS topic not found'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const response = await service.createAttestation({
        schemaUid: SCHEMA_UID,
        subject: SUBJECT,
        data: '0x1234',
      });

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      // Parent operation still succeeds
      expect(response.success).toBe(true);
      expect(response.data?.attestationUid).toBe(ATTESTATION_UID);

      warnSpy.mockRestore();
    });

    it('revokeAttestation succeeds even when HCS submission fails completely', async () => {
      setupRevokeMocks();
      mockExecute.mockRejectedValue(new Error('HCS topic not found'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const response = await service.revokeAttestation(ATTESTATION_UID);

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      // Parent operation still succeeds
      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();

      warnSpy.mockRestore();
    });

    it('no HCS message is submitted when hcsTopicId is not configured', async () => {
      // Create service without HCS topic
      contractCallCount = 0;
      const serviceNoHcs = new HederaAttestService({
        ...TEST_CONFIG,
        hcsTopicId: undefined,
      });

      setupRevokeMocks();

      const response = await serviceNoHcs.revokeAttestation(ATTESTATION_UID);

      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(0);

      expect(response.success).toBe(true);
      // mockExecute should not have been called for HCS
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });
});
