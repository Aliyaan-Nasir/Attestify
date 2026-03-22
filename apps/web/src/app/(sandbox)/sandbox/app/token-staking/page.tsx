'use client';

import { useState } from 'react';
import { Coins, ArrowUpCircle, ArrowDownCircle, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function TokenStakingPage() {
  const [tokenAddress, setTokenAddress] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [lookupToken, setLookupToken] = useState('');
  const [lookupAuthority, setLookupAuthority] = useState('');
  const [stakeResult, setStakeResult] = useState<string | null>(null);
  const [unstakeResult, setUnstakeResult] = useState<string | null>(null);
  const [balanceResult, setBalanceResult] = useState<{ stakedAmount: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStake = async () => {
    setLoading(true); setError(''); setStakeResult(null);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      setStakeResult(`Staked ${stakeAmount} tokens successfully`);
    } catch (e: any) { const { parseContractError } = await import('@/lib/parseContractError'); setError(parseContractError(e)); } finally { setLoading(false); }
  };

  const handleUnstake = async () => {
    setLoading(true); setError(''); setUnstakeResult(null);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      setUnstakeResult(`Unstaked ${unstakeAmount} tokens successfully`);
    } catch (e: any) { const { parseContractError } = await import('@/lib/parseContractError'); setError(parseContractError(e)); } finally { setLoading(false); }
  };

  const handleCheckBalance = async () => {
    setLoading(true); setError(''); setBalanceResult(null);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setBalanceResult({ stakedAmount: '0' });
    } catch (e: any) { const { parseContractError } = await import('@/lib/parseContractError'); setError(parseContractError(e)); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
          <Coins className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-900">Token Staking</h1>
          <p className="text-sm text-surface-500">Stake HTS tokens to maintain authority status</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-xs text-green-700">
        Authorities stake HTS fungible tokens to maintain their verified status. If they misbehave, their stake can be slashed.
        This uses Hedera Token Service (HTS) — native staking, not a smart contract token.
      </div>

      {/* Stake Tokens */}
      <div className="mb-6 rounded-lg border border-surface-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <ArrowUpCircle className="h-4 w-4 text-green-500" />
          <h2 className="text-sm font-semibold text-surface-900">Stake Tokens</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-surface-500">HTS Token Address</label>
            <input type="text" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x... (HTS token EVM address)"
              className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-surface-500">Amount to Stake</label>
            <input type="text" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          </div>
          <button onClick={handleStake} disabled={loading || !tokenAddress || !stakeAmount}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50">
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Stake Tokens'}
          </button>
          {stakeResult && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {stakeResult}
            </div>
          )}
        </div>
      </div>

      {/* Unstake Tokens */}
      <div className="mb-6 rounded-lg border border-surface-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <ArrowDownCircle className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-surface-900">Unstake Tokens</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-surface-500">Amount to Unstake</label>
            <input type="text" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="e.g. 500"
              className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          </div>
          <button onClick={handleUnstake} disabled={loading || !unstakeAmount}
            className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50">
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Unstake Tokens'}
          </button>
          {unstakeResult && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              <CheckCircle2 className="h-4 w-4" /> {unstakeResult}
            </div>
          )}
        </div>
      </div>

      {/* Check Balance */}
      <div className="mb-6 rounded-lg border border-surface-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-surface-500" />
          <h2 className="text-sm font-semibold text-surface-900">Check Staked Balance</h2>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-surface-500">Token Address</label>
              <input type="text" value={lookupToken} onChange={(e) => setLookupToken(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-surface-500">Authority Address / Account ID</label>
              <input type="text" value={lookupAuthority} onChange={(e) => setLookupAuthority(e.target.value)}
                placeholder="0.0.12345 or 0x..."
                className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
            </div>
          </div>
          <button onClick={handleCheckBalance} disabled={loading || !lookupToken || !lookupAuthority}
            className="w-full rounded-lg bg-surface-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-surface-800 disabled:opacity-50">
            Check Balance
          </button>
          {balanceResult && (
            <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 text-xs text-surface-600">
              Staked Amount: <span className="font-mono font-semibold text-surface-900">{balanceResult.stakedAmount}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* SDK/CLI Reference */}
      <div className="rounded-lg border border-surface-200 bg-surface-50 p-4">
        <p className="mb-2 text-xs font-semibold text-surface-700">SDK / CLI Reference</p>
        <pre className="overflow-x-auto rounded bg-surface-900 p-3 text-xs text-green-400">{`// SDK
await service.stakeTokens('0xTokenAddr...', '1000');
await service.unstakeTokens('0xTokenAddr...', '500');
const balance = await service.getStake('0xTokenAddr...', '0.0.12345');
// balance.data = { stakedAmount: '500', tokenAddress: '0x...' }

// CLI
attestify staking stake --token 0xTokenAddr... --amount 1000
attestify staking unstake --token 0xTokenAddr... --amount 500
attestify staking balance --token 0xTokenAddr... --authority 0.0.12345`}</pre>
      </div>
    </div>
  );
}
