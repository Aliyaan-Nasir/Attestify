'use client';

import { useState } from 'react';
import { FileCode2, Search, Loader2, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { indexerApi, type SchemaRecord } from '@/lib/api';

export default function WalletSchemasPage() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [schemas, setSchemas] = useState<SchemaRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!address.trim()) return;
    setLoading(true); setError(null); setSearched(false);
    try {
      const res = await indexerApi.getSchemas({ authority: address.trim(), limit: 100 });
      setSchemas(res.data);
      setSearched(true);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to fetch schemas');
    } finally { setLoading(false); }
  };

  const short = (s: string) => s.length > 16 ? `${s.slice(0, 10)}...${s.slice(-6)}` : s;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
          <FileCode2 className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Wallet Schemas</h1>
            <span className="rounded-full bg-surface-200 px-3 py-0.5 text-xs font-medium text-surface-600">Retrieval</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">Get all schemas registered by a wallet address.</p>
        </div>
      </div>

      <div className="max-w-3xl space-y-4">
        <div className="rounded-lg border border-surface-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-surface-900">Authority Address</h2>
          <div className="flex gap-2">
            <input type="text" placeholder="0x..." value={address} onChange={(e) => setAddress(e.target.value)}
              className="flex-1 rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <button type="button" onClick={handleSearch} disabled={!address.trim() || loading}
              className="flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {searched && (
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-surface-900">Schemas ({schemas.length})</h2>
            {schemas.length === 0 ? (
              <p className="text-xs text-surface-400">No schemas registered by this address.</p>
            ) : (
              <div className="divide-y divide-surface-100">
                {schemas.map((s) => (
                  <div key={s.uid} className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => navigator.clipboard.writeText(s.uid)} className="font-mono text-xs text-brand-500 hover:underline">{short(s.uid)}</button>
                          <Copy className="h-3 w-3 text-surface-300" />
                        </div>
                        <p className="mt-1 font-mono text-xs text-surface-600">{s.definition || 'No definition'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.revocable ? (
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"><XCircle className="h-3 w-3" /> Revocable</span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700"><CheckCircle2 className="h-3 w-3" /> Permanent</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-surface-400">
                      <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                      {s.hcsTopicId && <span>HCS: {s.hcsTopicId}</span>}
                      {s.resolverAddress && s.resolverAddress !== '0x0000000000000000000000000000000000000000' && <span>Resolver: {short(s.resolverAddress)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
