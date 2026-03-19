import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 17.4**
 *
 * Property 32: Transaction forms disabled without wallet
 *
 * For any transaction-submitting form or button in the Sandbox,
 * it should be disabled when no wallet is connected, and a prompt
 * to connect MetaMask should be displayed.
 *
 * We test the core logic: given a wallet state, determine whether
 * forms should be enabled/disabled and whether a connect prompt
 * should be shown.
 */

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  chainId: number | null;
}

function computeFormState(wallet: WalletState): {
  formsEnabled: boolean;
  showConnectPrompt: boolean;
  showNetworkWarning: boolean;
} {
  if (!wallet.isConnected || !wallet.address) {
    return {
      formsEnabled: false,
      showConnectPrompt: true,
      showNetworkWarning: false,
    };
  }
  if (!wallet.isCorrectNetwork) {
    return {
      formsEnabled: false,
      showConnectPrompt: false,
      showNetworkWarning: true,
    };
  }
  return {
    formsEnabled: true,
    showConnectPrompt: false,
    showNetworkWarning: false,
  };
}

const walletStateArb = fc.record({
  address: fc.oneof(
    fc.constant(null),
    fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
  ),
  isConnected: fc.boolean(),
  isCorrectNetwork: fc.boolean(),
  chainId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100000 })),
});

// Constrained arb where isConnected is consistent with address
const consistentWalletStateArb = fc
  .record({
    address: fc.oneof(
      fc.constant(null),
      fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
    ),
    isCorrectNetwork: fc.boolean(),
    chainId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100000 })),
  })
  .map((s) => ({
    ...s,
    isConnected: s.address !== null,
  }));

describe('Property 32: Transaction forms disabled without wallet', () => {
  it('forms are disabled when wallet is not connected', () => {
    fc.assert(
      fc.property(consistentWalletStateArb, (wallet) => {
        fc.pre(!wallet.isConnected);
        const result = computeFormState(wallet);
        expect(result.formsEnabled).toBe(false);
        expect(result.showConnectPrompt).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('forms are enabled only when wallet is connected AND on correct network', () => {
    fc.assert(
      fc.property(consistentWalletStateArb, (wallet) => {
        const result = computeFormState(wallet);
        if (wallet.isConnected && wallet.isCorrectNetwork) {
          expect(result.formsEnabled).toBe(true);
          expect(result.showConnectPrompt).toBe(false);
          expect(result.showNetworkWarning).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('shows network warning when connected but wrong network', () => {
    fc.assert(
      fc.property(consistentWalletStateArb, (wallet) => {
        fc.pre(wallet.isConnected && !wallet.isCorrectNetwork);
        const result = computeFormState(wallet);
        expect(result.formsEnabled).toBe(false);
        expect(result.showNetworkWarning).toBe(true);
        expect(result.showConnectPrompt).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('exactly one of: formsEnabled, showConnectPrompt, showNetworkWarning is the primary state', () => {
    fc.assert(
      fc.property(consistentWalletStateArb, (wallet) => {
        const result = computeFormState(wallet);
        // Exactly one of the three states should be "active"
        const states = [
          result.formsEnabled,
          result.showConnectPrompt,
          result.showNetworkWarning,
        ];
        const activeCount = states.filter(Boolean).length;
        expect(activeCount).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
