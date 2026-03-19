'use client';

import { useState } from 'react';
import { Users, Plus, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function MultiSigAuthorityPage() {
  const [keys, setKeys] = useState(['', '']);
  const [threshold, setThreshold] = useState('2');
  const [initialBalance, setInitialBalance] = useState('10');
  const [lookupAccount, setLookupAccount] = useState('');
  const [result, setResult] = useState<{ accountId?: string; threshold?: number; totalKeys?: number } | null>(null);
  const [keyInfo, setKeyInfo] = useState<{ accountId?: string; keyType?: string; threshold?: number; keyCount?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addKey = () => setKeys([...keys, '']);
  const removeKey = (i: number) => setKeys(keys.filter((_, idx) => idx !== i));
  const updateKey = (i: number, v: string) => { const n = [...keys]; n[i] = v; setKeys(n); };

  const handleCreate = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      // Demo: simulate the SDK call
      await new Promise((r) => setTimeout(r, 2000));
      setResult({ accountId: '0.0.' + Math.floor(Math.random() * 9000000 + 1000000), threshold: parseInt(threshold), totalKeys: keys.filter(Boolean).length });
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const handleLookup = async () => {
    setLoading(true); setError(''); setKeyInfo(null);
    try {
      const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${lookupAccount}`);
      if (!res.ok) throw new Error('Account not found');
      const data = await res.json();
      const key = data.key;
      if (key?._type === 'ThresholdKey') {
        setKeyInfo({ accountId: lookupAccount, keyType: 'threshold', threshold: key.threshold, keyCount: key.keys?.length });
      } else if (key?._type === 'KeyList') {
        setKeyInfo({ accountId: lookupAccount, keyType: 'keylist', keyCount: key.keys?.length });
      } else {
        setKeyInfo({ accountId: lookupAccount, keyType: key?._type || 'single' });
      }
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
          <Users className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-900">Multi-Sig Authority</h1>
          <p className="text-sm text-surface-500">Create a multi-sig authority using Hedera native threshold keys</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-xs text-green-700">
        Hedera accounts natively support multi-sig via threshold keys. No smart contract multi-sig needed — it&apos;s built into the account model.
        A 2-of-3 authority means 2 out of 3 signers must approve before any attestation is created.
      </div>

      {/* Create Multi-Sig */}
      <div className="mb-8 rounded-lg border border-surface-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-surface-900">Create Multi-Sig Authority Account</h2>

        <div className="space-y-3">
          {keys.map((key, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className="w-16 text-xs text-surface-500">Key {i + 1}</label>
              <input
                type="text"
                value={key}
                onChange={(e) => updateKey(i, e.target.value)}
                placeholder="ECDSA public key (hex or DER)"
                className="flex-1 rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300"
              />
              {keys.length > 2 && (
                <button onClick={() => removeKey(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              )}
            </div>
          ))}
          <button onClick={addKey} className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700">
            <Plus className="h-3 w-3" /> Add Key
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-surface-500">Threshold (required signatures)</label>
            <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} min={1} max={keys.length}
              className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-surface-500">Initial Balance (HBAR)</label>
            <input type="text" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)}
              className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          </div>
        </div>

        <button onClick={handleCreate} disabled={loading || keys.filter(Boolean).length < 2}
          className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50">
          {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : `Create ${threshold}-of-${keys.filter(Boolean).length} Multi-Sig Account`}
        </button>

        {result && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Multi-Sig Account Created</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-green-600">
              <p>Account ID: <span className="font-mono">{result.accountId}</span></p>
              <p>Threshold: {result.threshold}-of-{result.totalKeys}</p>
            </div>
          </div>
        )}
      </div>

      {/* Lookup Account Key Info */}
      <div className="rounded-lg border border-surface-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-surface-900">Lookup Account Key Structure</h2>
        <div className="flex gap-2">
          <input type="text" value={lookupAccount} onChange={(e) => setLookupAccount(e.target.value)}
            placeholder="Hedera Account ID (e.g. 0.0.12345)"
            className="flex-1 rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          <button onClick={handleLookup} disabled={loading || !lookupAccount}
            className="rounded-lg bg-surface-900 px-4 py-2 text-sm font-medium text-white hover:bg-surface-800 disabled:opacity-50">
            <Search className="h-4 w-4" />
          </button>
        </div>

        {keyInfo && (
          <div className="mt-4 rounded-lg border border-surface-200 bg-surface-50 p-4">
            <p className="text-xs text-surface-500">Account: <span className="font-mono text-surface-700">{keyInfo.accountId}</span></p>
            <p className="text-xs text-surface-500">Key Type: <span className="font-semibold text-surface-700">{keyInfo.keyType}</span></p>
            {keyInfo.threshold && <p className="text-xs text-surface-500">Threshold: <span className="font-semibold text-surface-700">{keyInfo.threshold}</span></p>}
            {keyInfo.keyCount && <p className="text-xs text-surface-500">Total Keys: <span className="font-semibold text-surface-700">{keyInfo.keyCount}</span></p>}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* SDK/CLI Reference */}
      <div className="mt-8 rounded-lg border border-surface-200 bg-surface-50 p-4">
        <p className="mb-2 text-xs font-semibold text-surface-700">SDK / CLI Reference</p>
        <pre className="overflow-x-auto rounded bg-surface-900 p-3 text-xs text-green-400">{`// SDK
const result = await service.createMultiSigAuthority({
  publicKeys: ['302a300506...', '302a300506...', '302a300506...'],
  threshold: 2,
  initialBalance: '10',
});
// result.data = { accountId: '0.0.12345', threshold: 2, totalKeys: 3 }

const info = await service.getAccountKeyInfo('0.0.12345');
// info.data = { accountId: '0.0.12345', keyType: 'threshold', threshold: 2, keyCount: 3 }

// CLI
attestify multisig create --keys key1,key2,key3 --threshold 2
attestify multisig info --account 0.0.12345`}</pre>
      </div>
    </div>
  );
}
