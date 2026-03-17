'use client';

import { useState, useRef, useEffect } from 'react';
import { Wallet, LogOut, AlertTriangle, User, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useWalletContext } from './WalletProvider';

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectButton() {
  const { state, connect, disconnect, switchToHederaTestnet } = useWalletContext();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      await connect();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  if (state.isConnected && !state.isCorrectNetwork) {
    return (
      <button
        onClick={switchToHederaTestnet}
        className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-50 px-3 py-1.5 text-sm text-yellow-700 transition-colors hover:bg-yellow-100"
      >
        <AlertTriangle className="h-4 w-4" />
        Switch to Hedera
      </button>
    );
  }

  if (state.isConnected && state.address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 rounded-md bg-surface-100 px-3 py-1.5 font-mono text-sm text-surface-700 transition-colors hover:bg-surface-200"
        >
          <Wallet className="h-3.5 w-3.5 text-surface-400" />
          {truncateAddress(state.address)}
          <ChevronDown className={`h-3.5 w-3.5 text-surface-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-lg border border-surface-200 bg-white shadow-lg">
            <Link
              href="/profile"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-surface-700 transition-colors hover:bg-surface-50"
            >
              <User className="h-4 w-4 text-surface-400" />
              My Profile
            </Link>
            <div className="border-t border-surface-100" />
            <button
              onClick={() => { disconnect(); setDropdownOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 rounded-md border border-surface-200 px-3 py-1.5 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50 disabled:opacity-50"
      >
        <Wallet className="h-4 w-4" />
        {connecting ? 'Connecting...' : 'Connect'}
      </button>
      {error && (
        <span className="mt-1 text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}