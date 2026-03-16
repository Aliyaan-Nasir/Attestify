/**
 * Unit tests for CLI credential loading and default network configuration
 * Validates: Requirements 11.2, 11.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load credentials from HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY env vars', () => {
    process.env.HEDERA_ACCOUNT_ID = '0.0.12345';
    process.env.HEDERA_PRIVATE_KEY = 'abc123def456';

    const config = loadConfig();

    expect(config.operatorAccountId).toBe('0.0.12345');
    expect(config.operatorPrivateKey).toBe('abc123def456');
  });

  it('should throw when HEDERA_ACCOUNT_ID is missing', () => {
    delete process.env.HEDERA_ACCOUNT_ID;
    process.env.HEDERA_PRIVATE_KEY = 'abc123def456';

    expect(() => loadConfig()).toThrow('Missing HEDERA_ACCOUNT_ID');
  });

  it('should throw when HEDERA_PRIVATE_KEY is missing', () => {
    process.env.HEDERA_ACCOUNT_ID = '0.0.12345';
    delete process.env.HEDERA_PRIVATE_KEY;

    expect(() => loadConfig()).toThrow('Missing HEDERA_PRIVATE_KEY');
  });

  it('should throw when both env vars are missing', () => {
    delete process.env.HEDERA_ACCOUNT_ID;
    delete process.env.HEDERA_PRIVATE_KEY;

    expect(() => loadConfig()).toThrow('Missing HEDERA_ACCOUNT_ID');
  });

  it('should default to Hedera testnet network', () => {
    process.env.HEDERA_ACCOUNT_ID = '0.0.12345';
    process.env.HEDERA_PRIVATE_KEY = 'abc123def456';

    const config = loadConfig();

    expect(config.network).toBe('testnet');
  });

  it('should use default RPC URL for testnet', () => {
    process.env.HEDERA_ACCOUNT_ID = '0.0.12345';
    process.env.HEDERA_PRIVATE_KEY = 'abc123def456';

    const config = loadConfig();

    expect(config.rpcUrl).toBe('https://testnet.hashio.io/api');
  });

  it('should include default contract addresses', () => {
    process.env.HEDERA_ACCOUNT_ID = '0.0.12345';
    process.env.HEDERA_PRIVATE_KEY = 'abc123def456';

    const config = loadConfig();

    expect(config.contractAddresses).toBeDefined();
    expect(config.contractAddresses.schemaRegistry).toBeTruthy();
    expect(config.contractAddresses.attestationService).toBeTruthy();
  });
});
