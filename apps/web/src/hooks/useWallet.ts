'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export const HEDERA_TESTNET = {
  chainId: '0x128',
  chainIdDecimal: 296,
  chainName: 'Hedera Testnet',
  rpcUrls: ['https://testnet.hashio.io/api'],
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  blockExplorerUrls: ['https://hashscan.io/testnet'],
} as const;

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  chainId: number | null;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

function getEthereum(): EthereumProvider | null {
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum as unknown as EthereumProvider;
  }
  return null;
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const isConnected = address !== null;
  const isCorrectNetwork = chainId === HEDERA_TESTNET.chainIdDecimal;

  const state: WalletState = useMemo(
    () => ({ address, isConnected, isCorrectNetwork, chainId }),
    [address, isConnected, isCorrectNetwork, chainId],
  );

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      setAddress(accs.length > 0 ? accs[0] : null);
    };

    const handleChainChanged = (chain: unknown) => {
      setChainId(parseInt(chain as string, 16));
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    // Check existing connection
    ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        const accs = accounts as string[];
        if (accs.length > 0) setAddress(accs[0]);
      })
      .catch(() => {});

    ethereum
      .request({ method: 'eth_chainId' })
      .then((chain) => {
        setChainId(parseInt(chain as string, 16));
      })
      .catch(() => {});

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error('MetaMask is not installed');
    }

    const accounts = (await ethereum.request({
      method: 'eth_requestAccounts',
    })) as string[];

    if (accounts.length > 0) {
      setAddress(accounts[0]);
    }

    const chain = (await ethereum.request({ method: 'eth_chainId' })) as string;
    const currentChainId = parseInt(chain, 16);
    setChainId(currentChainId);

    if (currentChainId !== HEDERA_TESTNET.chainIdDecimal) {
      await switchToHederaTestnet();
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  const switchToHederaTestnet = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HEDERA_TESTNET.chainId }],
      });
    } catch (err: unknown) {
      const error = err as { code?: number };
      // Chain not added — add it
      if (error.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: HEDERA_TESTNET.chainId,
              chainName: HEDERA_TESTNET.chainName,
              rpcUrls: HEDERA_TESTNET.rpcUrls,
              nativeCurrency: HEDERA_TESTNET.nativeCurrency,
              blockExplorerUrls: HEDERA_TESTNET.blockExplorerUrls,
            },
          ],
        });
      } else {
        throw err;
      }
    }

    setChainId(HEDERA_TESTNET.chainIdDecimal);
  }, []);

  return { state, connect, disconnect, switchToHederaTestnet };
}
