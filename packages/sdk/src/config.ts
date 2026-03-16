/**
 * Attestify SDK — Default Configuration
 *
 * Hedera testnet defaults, chain metadata for MetaMask, deployed contract
 * addresses, and a configuration validator.
 */

import type { HederaAttestServiceConfig, ContractAddresses, ResolverAddresses } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default Hedera testnet JSON-RPC relay URL. */
export const DEFAULT_RPC_URL = 'https://testnet.hashio.io/api';

/** Default indexer API URL. */
export const DEFAULT_INDEXER_URL = 'http://localhost:3001/api';

/** Default network identifier. */
export const DEFAULT_NETWORK = 'testnet' as const;

/** Hedera testnet EVM chain ID (decimal). */
export const HEDERA_TESTNET_CHAIN_ID = 296;

// ─── MetaMask Chain Config ───────────────────────────────────────────────────

/**
 * Chain parameters for adding / switching to Hedera testnet in MetaMask.
 * Follows the EIP-3085 `wallet_addEthereumChain` parameter shape.
 */
export const HEDERA_TESTNET_CHAIN = {
  chainId: '0x128',
  chainName: 'Hedera Testnet',
  rpcUrls: [DEFAULT_RPC_URL],
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  blockExplorerUrls: ['https://hashscan.io/testnet'],
} as const;

// ─── Deployed Contract Addresses (testnet) ───────────────────────────────────

/**
 * Contract addresses deployed on Hedera testnet.
 */
export const TESTNET_CONTRACT_ADDRESSES: ContractAddresses = {
  schemaRegistry: '0x8320Ae819556C449825F8255e92E7e1bc06c2e80',
  attestationService: '0xce573F82e73F49721255088C7b4D849ad0F64331',
};

/**
 * Resolver contract addresses deployed on Hedera testnet.
 */
export const TESTNET_RESOLVER_ADDRESSES: ResolverAddresses = {
  whitelistResolver: '0x461349A8aEfB220A48b61923095DfF237465c27A',
  feeResolver: '0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C',
  tokenGatedResolver: '0x7d04a83cF73CD4853dB4E378DD127440d444718c',
};

/**
 * Default HCS topic IDs for audit logging on Hedera testnet.
 */
export const TESTNET_HCS_TOPICS = {
  schemas: '0.0.8221945',
  attestations: '0.0.8221946',
  authorities: '0.0.8221947',
} as const;

// ─── Default Config ──────────────────────────────────────────────────────────

/**
 * Sensible defaults for HederaAttestServiceConfig.
 * Provides network, rpcUrl, and contractAddresses — callers still need to
 * supply operatorAccountId and operatorPrivateKey.
 */
export const DEFAULT_CONFIG: Omit<
  HederaAttestServiceConfig,
  'operatorAccountId' | 'operatorPrivateKey'
> = {
  network: DEFAULT_NETWORK,
  rpcUrl: DEFAULT_RPC_URL,
  contractAddresses: TESTNET_CONTRACT_ADDRESSES,
};

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates that all required fields are present in the given config.
 * Returns `null` when valid, or a descriptive error string when invalid.
 */
export function validateConfig(
  config: Partial<HederaAttestServiceConfig>,
): string | null {
  const missing: string[] = [];

  if (!config.operatorAccountId) {
    missing.push('operatorAccountId');
  }
  if (!config.operatorPrivateKey) {
    missing.push('operatorPrivateKey');
  }
  if (!config.contractAddresses?.schemaRegistry) {
    missing.push('contractAddresses.schemaRegistry');
  }
  if (!config.contractAddresses?.attestationService) {
    missing.push('contractAddresses.attestationService');
  }

  if (missing.length > 0) {
    return `Missing required configuration fields: ${missing.join(', ')}`;
  }

  return null;
}
