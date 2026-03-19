import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallet, HEDERA_TESTNET } from '@/hooks/useWallet';
import {
  DEPLOYED_ADDRESSES,
  SCHEMA_REGISTRY_ABI,
  ATTESTATION_SERVICE_ABI,
} from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Mock ethereum provider factory
// ---------------------------------------------------------------------------

interface MockEthereumOptions {
  accounts?: string[];
  chainId?: string;
  rejectConnect?: boolean;
  rejectSwitch?: boolean;
  switchError?: { code: number; message: string };
}

function createMockEthereum(opts: MockEthereumOptions = {}) {
  const accounts = opts.accounts ?? [];
  const chainId = opts.chainId ?? '0x128';
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  const mock = {
    request: vi.fn(async ({ method }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_accounts') return accounts;
      if (method === 'eth_requestAccounts') {
        if (opts.rejectConnect) {
          const err = new Error('User rejected the request') as Error & { code: number };
          err.code = 4001;
          throw err;
        }
        return accounts.length > 0
          ? accounts
          : ['0xabc123def456abc123def456abc123def456abc1'];
      }
      if (method === 'eth_chainId') return chainId;
      if (method === 'wallet_switchEthereumChain') {
        if (opts.rejectSwitch) {
          const err = new Error('User rejected') as Error & { code: number };
          err.code = 4001;
          throw err;
        }
        if (opts.switchError) {
          const err = new Error(opts.switchError.message) as Error & { code: number };
          err.code = opts.switchError.code;
          throw err;
        }
        return null;
      }
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
    _emit(event: string, ...args: unknown[]) {
      listeners[event]?.forEach((h) => h(...args));
    },
  };

  return mock;
}

function setWindowEthereum(mock: ReturnType<typeof createMockEthereum> | undefined) {
  (globalThis as Record<string, unknown>).window = mock
    ? { ethereum: mock }
    : {};
}

// ---------------------------------------------------------------------------
// 1. MetaMask connection flow
// ---------------------------------------------------------------------------

describe('MetaMask connection flow', () => {
  beforeEach(() => {
    setWindowEthereum(undefined);
  });

  it('requests accounts and reads chainId on connect', async () => {
    const mock = createMockEthereum({ chainId: '0x128' });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(mock.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    expect(mock.request).toHaveBeenCalledWith({ method: 'eth_chainId' });
    expect(result.current.state.isConnected).toBe(true);
    expect(result.current.state.address).toBeTruthy();
    expect(result.current.state.chainId).toBe(296);
  });

  it('picks up already-connected accounts on mount', async () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    const mock = createMockEthereum({ accounts: [addr], chainId: '0x128' });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.address).toBe(addr);
    expect(result.current.state.isConnected).toBe(true);
  });

  it('registers accountsChanged and chainChanged listeners', () => {
    const mock = createMockEthereum();
    setWindowEthereum(mock);

    renderHook(() => useWallet());

    expect(mock.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    expect(mock.on).toHaveBeenCalledWith('chainChanged', expect.any(Function));
  });

  it('updates address when accountsChanged fires', async () => {
    const mock = createMockEthereum({
      accounts: ['0xaaaa567890abcdef1234567890abcdef12345678'],
      chainId: '0x128',
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const newAddr = '0xbbbb567890abcdef1234567890abcdef12345678';
    await act(async () => {
      mock._emit('accountsChanged', [newAddr]);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.address).toBe(newAddr);
  });

  it('clears address when accountsChanged fires with empty array', async () => {
    const mock = createMockEthereum({
      accounts: ['0xaaaa567890abcdef1234567890abcdef12345678'],
      chainId: '0x128',
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.isConnected).toBe(true);

    await act(async () => {
      mock._emit('accountsChanged', []);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.isConnected).toBe(false);
    expect(result.current.state.address).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Network detection and switch to Hedera testnet
// ---------------------------------------------------------------------------

describe('Network detection and switch to Hedera testnet', () => {
  beforeEach(() => {
    setWindowEthereum(undefined);
  });

  it('detects correct Hedera testnet chainId (296 / 0x128)', async () => {
    const mock = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x128',
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.chainId).toBe(296);
    expect(result.current.state.isCorrectNetwork).toBe(true);
  });

  it('detects wrong network and marks isCorrectNetwork false', async () => {
    const mock = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x1', // Ethereum mainnet
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.chainId).toBe(1);
    expect(result.current.state.isCorrectNetwork).toBe(false);
  });

  it('auto-switches to Hedera testnet when connecting on wrong network', async () => {
    const mock = createMockEthereum({ chainId: '0x89' }); // Polygon
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(mock.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x128' }],
    });
  });

  it('adds Hedera testnet chain when switch returns 4902 (chain not added)', async () => {
    const mock = createMockEthereum({
      chainId: '0x89',
      switchError: { code: 4902, message: 'Chain not found' },
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(mock.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_addEthereumChain' }),
    );
  });

  it('switchToHederaTestnet sends correct chain params', async () => {
    const mock = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x1',
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.switchToHederaTestnet();
    });

    expect(mock.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HEDERA_TESTNET.chainId }],
    });
  });

  it('updates chainId when chainChanged event fires', async () => {
    const mock = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x128',
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.chainId).toBe(296);

    await act(async () => {
      mock._emit('chainChanged', '0x1');
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.chainId).toBe(1);
    expect(result.current.state.isCorrectNetwork).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Transaction signing flow via ethers.js + MetaMask signer
// ---------------------------------------------------------------------------

describe('Transaction signing flow', () => {
  beforeEach(() => {
    setWindowEthereum(undefined);
  });

  it('useContract returns null when no ethereum provider', async () => {
    setWindowEthereum(undefined);

    // Import dynamically to pick up the current window state
    const { useContract } = await import('@/hooks/useContract');
    const { result } = renderHook(() => useContract());

    expect(result.current).toBeNull();
  });

  it('useContract provides getSigner, getSchemaRegistry, getAttestationService', async () => {
    // Mock window.ethereum with a minimal provider that ethers.BrowserProvider accepts
    const mockProvider = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x128',
    });
    setWindowEthereum(mockProvider);

    const { useContract } = await import('@/hooks/useContract');
    const { result } = renderHook(() => useContract());

    expect(result.current).not.toBeNull();
    expect(result.current!.getSigner).toBeInstanceOf(Function);
    expect(result.current!.getSchemaRegistry).toBeInstanceOf(Function);
    expect(result.current!.getAttestationService).toBeInstanceOf(Function);
    expect(result.current!.provider).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Wallet disconnect flow
// ---------------------------------------------------------------------------

describe('Wallet disconnect flow', () => {
  beforeEach(() => {
    setWindowEthereum(undefined);
  });

  it('disconnect clears address and chainId', async () => {
    const mock = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x128',
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.isConnected).toBe(true);
    expect(result.current.state.chainId).toBe(296);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.state.isConnected).toBe(false);
    expect(result.current.state.address).toBeNull();
    expect(result.current.state.chainId).toBeNull();
  });

  it('disconnect is idempotent — calling twice does not error', async () => {
    const mock = createMockEthereum({
      accounts: ['0x1234567890abcdef1234567890abcdef12345678'],
      chainId: '0x128',
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    act(() => {
      result.current.disconnect();
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.state.isConnected).toBe(false);
    expect(result.current.state.address).toBeNull();
  });

  it('can reconnect after disconnect', async () => {
    const mock = createMockEthereum({ chainId: '0x128' });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.state.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.state.isConnected).toBe(false);

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.state.isConnected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Error handling (user rejection, network errors)
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  beforeEach(() => {
    setWindowEthereum(undefined);
  });

  it('throws when MetaMask is not installed', async () => {
    setWindowEthereum(undefined);

    const { result } = renderHook(() => useWallet());

    await expect(
      act(async () => {
        await result.current.connect();
      }),
    ).rejects.toThrow('MetaMask is not installed');
  });

  it('propagates user rejection error (code 4001) on connect', async () => {
    const mock = createMockEthereum({ rejectConnect: true });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await expect(
      act(async () => {
        await result.current.connect();
      }),
    ).rejects.toThrow('User rejected the request');
  });

  it('propagates user rejection error on network switch', async () => {
    const mock = createMockEthereum({
      chainId: '0x1',
      rejectSwitch: true,
    });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    await expect(
      act(async () => {
        await result.current.connect();
      }),
    ).rejects.toThrow('User rejected');
  });

  it('state remains disconnected after failed connect', async () => {
    const mock = createMockEthereum({ rejectConnect: true });
    setWindowEthereum(mock);

    const { result } = renderHook(() => useWallet());

    try {
      await act(async () => {
        await result.current.connect();
      });
    } catch {
      // expected
    }

    expect(result.current.state.isConnected).toBe(false);
    expect(result.current.state.address).toBeNull();
  });

  it('handles switchToHederaTestnet gracefully when no provider', async () => {
    setWindowEthereum(undefined);

    const { result } = renderHook(() => useWallet());

    // switchToHederaTestnet returns early without throwing when no provider
    await act(async () => {
      await result.current.switchToHederaTestnet();
    });

    expect(result.current.state.isCorrectNetwork).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Contract interaction hook — correct ABIs and addresses
// ---------------------------------------------------------------------------

describe('Contract ABIs and addresses', () => {
  it('DEPLOYED_ADDRESSES contains all required contract addresses', () => {
    expect(DEPLOYED_ADDRESSES.SchemaRegistry).toBeTruthy();
    expect(DEPLOYED_ADDRESSES.AttestationService).toBeTruthy();
    expect(DEPLOYED_ADDRESSES.WhitelistResolver).toBeTruthy();
    expect(DEPLOYED_ADDRESSES.TokenGatedResolver).toBeTruthy();
    expect(DEPLOYED_ADDRESSES.FeeResolver).toBeTruthy();
  });

  it('all addresses are valid hex strings starting with 0x', () => {
    for (const [, addr] of Object.entries(DEPLOYED_ADDRESSES)) {
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it('SCHEMA_REGISTRY_ABI contains register, getSchema, and SchemaRegistered event', () => {
    const abiStr = SCHEMA_REGISTRY_ABI.join(' ');
    expect(abiStr).toContain('register');
    expect(abiStr).toContain('getSchema');
    expect(abiStr).toContain('SchemaRegistered');
  });

  it('ATTESTATION_SERVICE_ABI contains attest, revoke, getAttestation, authority methods, and events', () => {
    const abiStr = ATTESTATION_SERVICE_ABI.join(' ');
    expect(abiStr).toContain('attest');
    expect(abiStr).toContain('revoke');
    expect(abiStr).toContain('getAttestation');
    expect(abiStr).toContain('registerAuthority');
    expect(abiStr).toContain('getAuthority');
    expect(abiStr).toContain('setAuthorityVerification');
    expect(abiStr).toContain('AttestationCreated');
    expect(abiStr).toContain('AttestationRevoked');
    expect(abiStr).toContain('AuthorityRegistered');
  });

  it('HEDERA_TESTNET config matches expected Hedera testnet values', () => {
    expect(HEDERA_TESTNET.chainId).toBe('0x128');
    expect(HEDERA_TESTNET.chainIdDecimal).toBe(296);
    expect(parseInt(HEDERA_TESTNET.chainId, 16)).toBe(HEDERA_TESTNET.chainIdDecimal);
    expect(HEDERA_TESTNET.chainName).toBe('Hedera Testnet');
    expect(HEDERA_TESTNET.rpcUrls).toContain('https://testnet.hashio.io/api');
    expect(HEDERA_TESTNET.nativeCurrency).toEqual({
      name: 'HBAR',
      symbol: 'HBAR',
      decimals: 18,
    });
    expect(HEDERA_TESTNET.blockExplorerUrls).toContain('https://hashscan.io/testnet');
  });
});
