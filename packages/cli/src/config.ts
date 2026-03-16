/**
 * CLI Configuration — loads credentials from env vars or config file
 */

import { config as loadDotenv } from 'dotenv';
import { DEFAULT_CONFIG, TESTNET_RESOLVER_ADDRESSES } from '@attestify/sdk';
import type { HederaAttestServiceConfig } from '@attestify/sdk';

// Load .env file if present
loadDotenv();

/**
 * Loads CLI configuration from environment variables.
 * Requires HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY.
 * Defaults to Hedera testnet with standard contract addresses and RPC URL.
 */
export function loadConfig(): HederaAttestServiceConfig {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;

  if (!accountId) {
    throw new Error(
      'Missing HEDERA_ACCOUNT_ID environment variable. ' +
      'Set it in your environment or in a .env file.',
    );
  }

  if (!privateKey) {
    throw new Error(
      'Missing HEDERA_PRIVATE_KEY environment variable. ' +
      'Set it in your environment or in a .env file.',
    );
  }

  // Build HCS topic config from env vars
  const hcsTopicSchemas = process.env.HCS_TOPIC_SCHEMAS;
  const hcsTopicAttestations = process.env.HCS_TOPIC_ATTESTATIONS;
  const hcsTopicAuthorities = process.env.HCS_TOPIC_AUTHORITIES;
  const hcsTopicId = process.env.HCS_TOPIC_ID; // legacy single topic

  const hcsTopicIds = (hcsTopicSchemas || hcsTopicAttestations || hcsTopicAuthorities)
    ? {
        schemas: hcsTopicSchemas,
        attestations: hcsTopicAttestations,
        authorities: hcsTopicAuthorities,
      }
    : undefined;

  return {
    ...DEFAULT_CONFIG,
    operatorAccountId: accountId,
    operatorPrivateKey: privateKey,
    indexerUrl: process.env.INDEXER_URL || undefined,
    resolverAddresses: TESTNET_RESOLVER_ADDRESSES,
    ...(hcsTopicIds ? { hcsTopicIds } : {}),
    ...(hcsTopicId && !hcsTopicIds ? { hcsTopicId } : {}),
  };
}
