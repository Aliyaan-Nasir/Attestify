/**
 * Configuration Validation Tests
 *
 * Tests for validateConfig(), HederaAttestService constructor config validation,
 * and DEFAULT_CONFIG / chain constant correctness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateConfig,
  DEFAULT_CONFIG,
  DEFAULT_RPC_URL,
  DEFAULT_NETWORK,
  HEDERA_TESTNET_CHAIN_ID,
  HEDERA_TESTNET_CHAIN,
  TESTNET_CONTRACT_ADDRESSES,
} from '../src/config';
import type { HederaAttestServiceConfig } from '../src/types';

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

const VALID_CONFIG: HederaAttestServiceConfig = {
  network: 'testnet',
  operatorAccountId: '0.0.12345',
  operatorPrivateKey: '0x' + 'ab'.repeat(32),
  contractAddresses: {
    schemaRegistry: '0x' + '11'.repeat(20),
    attestationService: '0x' + '22'.repeat(20),
  },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('validateConfig()', () => {
  it('returns null for a valid complete config', () => {
    expect(validateConfig(VALID_CONFIG)).toBeNull();
  });

  it('returns error listing missing operatorAccountId when absent', () => {
    const { operatorAccountId, ...rest } = VALID_CONFIG;
    const result = validateConfig(rest);
    expect(result).toBeTypeOf('string');
    expect(result).toContain('operatorAccountId');
  });

  it('returns error listing missing operatorPrivateKey when absent', () => {
    const { operatorPrivateKey, ...rest } = VALID_CONFIG;
    const result = validateConfig(rest);
    expect(result).toBeTypeOf('string');
    expect(result).toContain('operatorPrivateKey');
  });

  it('returns error listing missing contractAddresses.schemaRegistry when absent', () => {
    const config = {
      ...VALID_CONFIG,
      contractAddresses: {
        schemaRegistry: '',
        attestationService: VALID_CONFIG.contractAddresses.attestationService,
      },
    };
    const result = validateConfig(config);
    expect(result).toBeTypeOf('string');
    expect(result).toContain('contractAddresses.schemaRegistry');
  });

  it('returns error listing missing contractAddresses.attestationService when absent', () => {
    const config = {
      ...VALID_CONFIG,
      contractAddresses: {
        schemaRegistry: VALID_CONFIG.contractAddresses.schemaRegistry,
        attestationService: '',
      },
    };
    const result = validateConfig(config);
    expect(result).toBeTypeOf('string');
    expect(result).toContain('contractAddresses.attestationService');
  });

  it('returns error listing ALL missing fields when config is empty', () => {
    const result = validateConfig({});
    expect(result).toBeTypeOf('string');
    expect(result).toContain('operatorAccountId');
    expect(result).toContain('operatorPrivateKey');
    expect(result).toContain('contractAddresses.schemaRegistry');
    expect(result).toContain('contractAddresses.attestationService');
  });

  it('returns null when optional fields (hcsTopicId, rpcUrl) are omitted', () => {
    const { hcsTopicId, rpcUrl, ...rest } = VALID_CONFIG as HederaAttestServiceConfig & {
      hcsTopicId?: string;
      rpcUrl?: string;
    };
    expect(validateConfig(rest)).toBeNull();
  });
});

describe('HederaAttestService constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when config is missing required fields', async () => {
    const { HederaAttestService } = await import('../src/HederaAttestService');
    expect(
      () => new HederaAttestService({ network: 'testnet' } as HederaAttestServiceConfig),
    ).toThrow(/Missing required configuration fields/);
  });

  it('does NOT throw when config has all required fields', async () => {
    const { HederaAttestService } = await import('../src/HederaAttestService');
    expect(() => new HederaAttestService(VALID_CONFIG)).not.toThrow();
  });
});

describe('Default config values', () => {
  it('DEFAULT_CONFIG has correct network (testnet)', () => {
    expect(DEFAULT_CONFIG.network).toBe('testnet');
  });

  it('DEFAULT_CONFIG has correct rpcUrl', () => {
    expect(DEFAULT_CONFIG.rpcUrl).toBe('https://testnet.hashio.io/api');
  });

  it('DEFAULT_CONFIG has correct contract addresses matching deployed testnet addresses', () => {
    expect(DEFAULT_CONFIG.contractAddresses.schemaRegistry).toBe(
      '0x8320Ae819556C449825F8255e92E7e1bc06c2e80',
    );
    expect(DEFAULT_CONFIG.contractAddresses.attestationService).toBe(
      '0xce573F82e73F49721255088C7b4D849ad0F64331',
    );
  });

  it('HEDERA_TESTNET_CHAIN_ID is 296', () => {
    expect(HEDERA_TESTNET_CHAIN_ID).toBe(296);
  });

  it('HEDERA_TESTNET_CHAIN.chainId is 0x128', () => {
    expect(HEDERA_TESTNET_CHAIN.chainId).toBe('0x128');
  });
});
