/**
 * Error Mapping Tests — Property 26
 *
 * **Validates: Requirements 10.6**
 *
 * For any Solidity custom error thrown by the contracts, the SDK should map it
 * to the correct AttestifyErrorType enum value and return a structured
 * ServiceResponse with success: false.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { HederaAttestService } from '../src/HederaAttestService';
import { AttestifyErrorType } from '../src/types';
import type { ServiceResponse, HederaAttestServiceConfig } from '../src/types';

// ─── Mock ethers + @hashgraph/sdk so constructor doesn't hit the network ────

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  const mockContract = {
    register: vi.fn(),
    getSchema: vi.fn(),
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

  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
      Wallet: vi.fn().mockImplementation(() => ({})),
      Contract: vi.fn().mockImplementation(() => mockContract),
      ZeroAddress: actual.ethers.ZeroAddress,
    },
  };
});

vi.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: vi.fn().mockReturnValue({
      setOperator: vi.fn(),
    }),
  },
  AccountId: {
    fromString: vi.fn().mockReturnValue({}),
  },
  PrivateKey: {
    fromStringECDSA: vi.fn().mockReturnValue({}),
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const TEST_CONFIG: HederaAttestServiceConfig = {
  network: 'testnet',
  operatorAccountId: '0.0.12345',
  operatorPrivateKey: '0x' + 'ab'.repeat(32),
  contractAddresses: {
    schemaRegistry: '0x' + '11'.repeat(20),
    attestationService: '0x' + '22'.repeat(20),
  },
};

function getContractMock(): Record<string, ReturnType<typeof vi.fn>> {
  // The mock Contract constructor always returns the same mock object
  const calls = vi.mocked(ethers.Contract).mock.results;
  return calls[calls.length - 1]?.value;
}

/**
 * Asserts the standard error response shape: { success: false, error: { type, message } }
 */
function assertErrorShape(
  response: ServiceResponse<unknown>,
  expectedType: AttestifyErrorType,
) {
  expect(response.success).toBe(false);
  expect(response.data).toBeUndefined();
  expect(response.error).toBeDefined();
  expect(response.error!.type).toBe(expectedType);
  expect(typeof response.error!.message).toBe('string');
  expect(response.error!.message.length).toBeGreaterThan(0);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Property 26: SDK error response structure — error mapping correctness', () => {
  let service: HederaAttestService;
  let contractMock: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HederaAttestService(TEST_CONFIG);
    contractMock = getContractMock();
  });

  // ── 1. Solidity custom error → AttestifyErrorType mapping ───────────────

  describe('Solidity custom error mapping', () => {
    const ERROR_MAPPINGS: Array<{
      solidityError: string;
      expectedType: AttestifyErrorType;
    }> = [
      { solidityError: 'SchemaAlreadyExists', expectedType: AttestifyErrorType.ALREADY_EXISTS },
      { solidityError: 'SchemaNotFound', expectedType: AttestifyErrorType.NOT_FOUND },
      { solidityError: 'AttestationNotFound', expectedType: AttestifyErrorType.NOT_FOUND },
      { solidityError: 'AuthorityNotFound', expectedType: AttestifyErrorType.NOT_FOUND },
      { solidityError: 'AttestationAlreadyRevoked', expectedType: AttestifyErrorType.ALREADY_REVOKED },
      { solidityError: 'AttestationExpired', expectedType: AttestifyErrorType.EXPIRED },
      { solidityError: 'SchemaNotRevocable', expectedType: AttestifyErrorType.VALIDATION_ERROR },
      { solidityError: 'InvalidResolver', expectedType: AttestifyErrorType.VALIDATION_ERROR },
      { solidityError: 'InvalidExpirationTime', expectedType: AttestifyErrorType.VALIDATION_ERROR },
      { solidityError: 'UnauthorizedRevoker', expectedType: AttestifyErrorType.UNAUTHORIZED },
      { solidityError: 'Unauthorized', expectedType: AttestifyErrorType.UNAUTHORIZED },
      { solidityError: 'ResolverRejected', expectedType: AttestifyErrorType.RESOLVER_REJECTED },
    ];

    describe('via revert.name (ethers v6 CALL_EXCEPTION)', () => {
      for (const { solidityError, expectedType } of ERROR_MAPPINGS) {
        it(`maps ${solidityError} → ${expectedType}`, async () => {
          const error = Object.assign(new Error(`call revert exception`), {
            code: 'CALL_EXCEPTION',
            revert: { name: solidityError, args: [] },
          });
          contractMock.getSchema.mockRejectedValueOnce(error);

          const response = await service.getSchema('0x' + 'aa'.repeat(32));
          assertErrorShape(response, expectedType);
        });
      }
    });

    describe('via reason string', () => {
      for (const { solidityError, expectedType } of ERROR_MAPPINGS) {
        it(`maps reason containing "${solidityError}" → ${expectedType}`, async () => {
          const error = Object.assign(new Error(`execution reverted`), {
            code: 'CALL_EXCEPTION',
            reason: `execution reverted: ${solidityError}(0x...)`,
          });
          contractMock.revoke.mockRejectedValueOnce(error);

          const response = await service.revokeAttestation('0x' + 'bb'.repeat(32));
          assertErrorShape(response, expectedType);
        });
      }
    });

    describe('via error message string', () => {
      for (const { solidityError, expectedType } of ERROR_MAPPINGS) {
        it(`maps message containing "${solidityError}" → ${expectedType}`, async () => {
          const error = new Error(`Transaction failed: ${solidityError}`);
          contractMock.registerAuthority.mockRejectedValueOnce(error);

          const response = await service.registerAuthority('test metadata');
          assertErrorShape(response, expectedType);
        });
      }
    });
  });

  // ── 2. Network error detection ──────────────────────────────────────────

  describe('network error detection', () => {
    it('detects ECONNREFUSED as NETWORK_ERROR', async () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:7546');
      contractMock.getSchema.mockRejectedValueOnce(error);

      const response = await service.getSchema('0x' + 'cc'.repeat(32));
      assertErrorShape(response, AttestifyErrorType.NETWORK_ERROR);
    });

    it('detects ETIMEDOUT as NETWORK_ERROR', async () => {
      const error = new Error('connect ETIMEDOUT 10.0.0.1:443');
      contractMock.getAttestation.mockRejectedValueOnce(error);

      const response = await service.getAttestation('0x' + 'dd'.repeat(32));
      assertErrorShape(response, AttestifyErrorType.NETWORK_ERROR);
    });

    it('detects NETWORK_ERROR code as NETWORK_ERROR', async () => {
      const error = Object.assign(new Error('network error'), {
        code: 'NETWORK_ERROR',
      });
      contractMock.register.mockRejectedValueOnce(error);

      const response = await service.registerSchema({
        definition: 'string name',
        revocable: true,
      });
      assertErrorShape(response, AttestifyErrorType.NETWORK_ERROR);
    });

    it('detects TIMEOUT code as NETWORK_ERROR', async () => {
      const error = Object.assign(new Error('request timed out'), {
        code: 'TIMEOUT',
      });
      contractMock.getAuthority.mockRejectedValueOnce(error);

      const response = await service.getAuthority('0x' + 'ee'.repeat(20));
      assertErrorShape(response, AttestifyErrorType.NETWORK_ERROR);
    });

    it('detects SERVER_ERROR code as NETWORK_ERROR', async () => {
      const error = Object.assign(new Error('server error'), {
        code: 'SERVER_ERROR',
      });
      contractMock.setAuthorityVerification.mockRejectedValueOnce(error);

      const response = await service.setAuthorityVerification('0x' + 'ff'.repeat(20), true);
      assertErrorShape(response, AttestifyErrorType.NETWORK_ERROR);
    });
  });

  // ── 3. Unknown error fallback ───────────────────────────────────────────

  describe('unknown error fallback', () => {
    it('maps unrecognized Error to UNKNOWN_ERROR', async () => {
      const error = new Error('something completely unexpected happened');
      contractMock.getSchema.mockRejectedValueOnce(error);

      const response = await service.getSchema('0x' + '00'.repeat(32));
      assertErrorShape(response, AttestifyErrorType.UNKNOWN_ERROR);
      expect(response.error!.message).toContain('something completely unexpected');
    });

    it('maps non-Error thrown value to UNKNOWN_ERROR', async () => {
      contractMock.revoke.mockRejectedValueOnce('raw string error');

      const response = await service.revokeAttestation('0x' + '11'.repeat(32));
      assertErrorShape(response, AttestifyErrorType.UNKNOWN_ERROR);
    });

    it('maps null thrown value to UNKNOWN_ERROR', async () => {
      contractMock.registerAuthority.mockRejectedValueOnce(null);

      const response = await service.registerAuthority('metadata');
      assertErrorShape(response, AttestifyErrorType.UNKNOWN_ERROR);
    });
  });

  // ── 4. ServiceResponse error shape validation ───────────────────────────

  describe('ServiceResponse error shape', () => {
    it('error response has success: false', async () => {
      contractMock.getSchema.mockRejectedValueOnce(new Error('fail'));
      const response = await service.getSchema('0x' + 'ab'.repeat(32));
      expect(response.success).toBe(false);
    });

    it('error response has no data field', async () => {
      contractMock.getSchema.mockRejectedValueOnce(new Error('fail'));
      const response = await service.getSchema('0x' + 'ab'.repeat(32));
      expect(response.data).toBeUndefined();
    });

    it('error response has error.type as a valid AttestifyErrorType', async () => {
      const error = Object.assign(new Error('revert'), {
        revert: { name: 'SchemaNotFound', args: [] },
      });
      contractMock.getSchema.mockRejectedValueOnce(error);
      const response = await service.getSchema('0x' + 'ab'.repeat(32));

      const validTypes = Object.values(AttestifyErrorType);
      expect(validTypes).toContain(response.error!.type);
    });

    it('error response has error.message as a non-empty string', async () => {
      contractMock.getSchema.mockRejectedValueOnce(new Error('some error'));
      const response = await service.getSchema('0x' + 'ab'.repeat(32));
      expect(typeof response.error!.message).toBe('string');
      expect(response.error!.message.length).toBeGreaterThan(0);
    });

    it('all public methods return consistent error shape on failure', async () => {
      const error = Object.assign(new Error('revert'), {
        revert: { name: 'Unauthorized', args: [] },
      });

      // Test each public method
      contractMock.register.mockRejectedValueOnce(error);
      const r1 = await service.registerSchema({ definition: 'x', revocable: true });
      assertErrorShape(r1, AttestifyErrorType.UNAUTHORIZED);

      contractMock.getSchema.mockRejectedValueOnce(error);
      const r2 = await service.getSchema('0x00');
      assertErrorShape(r2, AttestifyErrorType.UNAUTHORIZED);

      contractMock.attest.mockRejectedValueOnce(error);
      const r3 = await service.createAttestation({
        schemaUid: '0x00',
        subject: '0x00',
        data: '0x',
      });
      assertErrorShape(r3, AttestifyErrorType.UNAUTHORIZED);

      contractMock.getAttestation.mockRejectedValueOnce(error);
      const r4 = await service.getAttestation('0x00');
      assertErrorShape(r4, AttestifyErrorType.UNAUTHORIZED);

      contractMock.revoke.mockRejectedValueOnce(error);
      const r5 = await service.revokeAttestation('0x00');
      assertErrorShape(r5, AttestifyErrorType.UNAUTHORIZED);

      contractMock.registerAuthority.mockRejectedValueOnce(error);
      const r6 = await service.registerAuthority('meta');
      assertErrorShape(r6, AttestifyErrorType.UNAUTHORIZED);

      contractMock.getAuthority.mockRejectedValueOnce(error);
      const r7 = await service.getAuthority('0x00');
      assertErrorShape(r7, AttestifyErrorType.UNAUTHORIZED);

      contractMock.setAuthorityVerification.mockRejectedValueOnce(error);
      const r8 = await service.setAuthorityVerification('0x00', true);
      assertErrorShape(r8, AttestifyErrorType.UNAUTHORIZED);
    });
  });
});
