'use client';

import { useMemo } from 'react';
import { ethers } from 'ethers';
import {
  DEPLOYED_ADDRESSES,
  SCHEMA_REGISTRY_ABI,
  ATTESTATION_SERVICE_ABI,
  WHITELIST_RESOLVER_ABI,
  FEE_RESOLVER_ABI,
  TOKEN_GATED_RESOLVER_ABI,
  TOKEN_REWARD_RESOLVER_ABI,
  CROSS_CONTRACT_RESOLVER_ABI,
} from '@/lib/contracts';

function getProvider(): ethers.BrowserProvider | null {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
  }
  return null;
}

export function useContract() {
  const contracts = useMemo(() => {
    const provider = getProvider();
    if (!provider) return null;

    return {
      provider,
      async getSigner() {
        return provider.getSigner();
      },
      async getSchemaRegistry(writable = false) {
        const signerOrProvider = writable ? await provider.getSigner() : provider;
        return new ethers.Contract(
          DEPLOYED_ADDRESSES.SchemaRegistry,
          SCHEMA_REGISTRY_ABI,
          signerOrProvider,
        );
      },
      async getAttestationService(writable = false) {
        const signerOrProvider = writable ? await provider.getSigner() : provider;
        return new ethers.Contract(
          DEPLOYED_ADDRESSES.AttestationService,
          ATTESTATION_SERVICE_ABI,
          signerOrProvider,
        );
      },
      async getWhitelistResolver(writable = false) {
        const signerOrProvider = writable ? await provider.getSigner() : provider;
        return new ethers.Contract(
          DEPLOYED_ADDRESSES.WhitelistResolver,
          WHITELIST_RESOLVER_ABI,
          signerOrProvider,
        );
      },
      async getFeeResolver(writable = false) {
        const signerOrProvider = writable ? await provider.getSigner() : provider;
        return new ethers.Contract(
          DEPLOYED_ADDRESSES.FeeResolver,
          FEE_RESOLVER_ABI,
          signerOrProvider,
        );
      },
      async getTokenGatedResolver(writable = false) {
        const signerOrProvider = writable ? await provider.getSigner() : provider;
        return new ethers.Contract(
          DEPLOYED_ADDRESSES.TokenGatedResolver,
          TOKEN_GATED_RESOLVER_ABI,
          signerOrProvider,
        );
      },
      async getTokenRewardResolver(address: string, writable = false) {
        const signerOrProvider = writable ? await provider.getSigner() : provider;
        return new ethers.Contract(address, TOKEN_REWARD_RESOLVER_ABI, signerOrProvider);
      },
      async getCrossContractResolver(address: string, writable = false) {
        const signerOrProvider = writable ? await provider.getSigner() : provider;
        return new ethers.Contract(address, CROSS_CONTRACT_RESOLVER_ABI, signerOrProvider);
      },
    };
  }, []);

  return contracts;
}
