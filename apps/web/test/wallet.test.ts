import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallet, HEDERA_TESTNET } from '@/hooks/useWallet';

function createMockEthereum(overrides: {
  accounts?: string[];
  chainId?: string;
} = {}) {
  const accounts = overrides.accounts ?? [];
  const chainId = overrides.chainId ?? '0x128';
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  return {
    request: vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_accounts') return accounts;
      if (method === 'eth_requestAccounts') return accounts.length > 0 ? accounts : ['0xabc123def456abc123def456abc123def456abc1'];
      if (method === 'eth_chainId') return chainId;
      if (method === 'wallet_switchEthereumChain') return null;
      if (method === 'wallet_addEthereumChain') return null;
      return null;
    }),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    }),
    _emit: (event: string, ...args: unknown[]) => {
      listeners[event]?.forEach((h) => h(...args));
    },
  };
}

describe('useWallet', () => {
  beforeEach(() => {
    // Reset window.ethereum
    (globalThis as Record<string, unknown>).window = {
      ethereum: undefined,
    };
  });

  it('returns disconnected state when no ethereum provider', () => {
    (globalThis as Record<string, unknown>).window = {};
    const { result } = renderHook(() => useWallet());
    expect(result.current.state.isConnected).toBe(false);
    expect(result.current.state.address).toBeNull();
    expect(result.current.state.chainId).toBeNull();
  });

  it('detects existing connection on mount', async () => {
    const mock = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x128',
    });
    (globalThis as Record<string, unknown>).window = { ethereum: mock };

    const { result } = renderHook(() => useWallet());

    // Wait for async effects
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(result.current.state.isConnected).toBe(true);
    expect(result.current.state.chainId).toBe(296);
    expect(result.current.state.isCorrectNetwork).toBe(true);
  });

  it('connects wallet via eth_requestAccounts', async () => {
    const mock = createMockEthereum({ chainId: '0x128' });
    (globalThis as Record<string, unknown>).window = { ethereum: mock };

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(mock.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    expect(result.current.state.isConnected).toBe(true);
    expect(result.current.state.address).toBeTruthy();
  });

  it('prompts network switch when chain is wrong on connect', async () => {
    const mock = createMockEthereum({ chainId: '0x1' }); // Ethereum mainnet
    (globalThis as Record<string, unknown>).window = { ethereum: mock };

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(mock.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x128' }],
    });
  });

  it('adds chain when wallet_switchEthereumChain returns 4902', async () => {
    const mock = createMockEthereum({ chainId: '0x1' });
    mock.request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts') return ['0xabc123def456abc123def456abc123def456abc1'];
      if (method === 'eth_chainId') return '0x1';
      if (method === 'wallet_switchEthereumChain') {
        const err = new Error('Chain not found') as Error & { code: number };
        err.code = 4902;
        throw err;
      }
      if (method === 'wallet_addEthereumChain') return null;
      return null;
    });
    (globalThis as Record<string, unknown>).window = { ethereum: mock };

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(mock.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_addEthereumChain' }),
    );
  });

  it('disconnect clears state', async () => {
    const mock = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x128',
    });
    (globalThis as Record<string, unknown>).window = { ethereum: mock };

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.state.isConnected).toBe(false);
    expect(result.current.state.address).toBeNull();
  });

  it('throws when MetaMask is not installed', async () => {
    (globalThis as Record<string, unknown>).window = {};

    const { result } = renderHook(() => useWallet());

    await expect(
      act(async () => {
        await result.current.connect();
      }),
    ).rejects.toThrow('MetaMask is not installed');
  });

  it('isCorrectNetwork is false when chain is not Hedera testnet', async () => {
    const mock = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x1', // Ethereum mainnet
    });
    (globalThis as Record<string, unknown>).window = { ethereum: mock };

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.isConnected).toBe(true);
    expect(result.current.state.isCorrectNetwork).toBe(false);
    expect(result.current.state.chainId).toBe(1);
  });

  it('HEDERA_TESTNET config has correct values', () => {
    expect(HEDERA_TESTNET.chainId).toBe('0x128');
    expect(HEDERA_TESTNET.chainIdDecimal).toBe(296);
    expect(HEDERA_TESTNET.chainName).toBe('Hedera Testnet');
    expect(HEDERA_TESTNET.rpcUrls).toContain('https://testnet.hashio.io/api');
    expect(HEDERA_TESTNET.nativeCurrency.symbol).toBe('HBAR');
    expect(HEDERA_TESTNET.blockExplorerUrls).toContain('https://hashscan.io/testnet');
  });
});
