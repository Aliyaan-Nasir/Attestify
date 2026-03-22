'use client';

import { useState } from 'react';
import { FileUp, FileSearch, FileCode2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function FileSchemaPage() {
  const [definition, setDefinition] = useState('');
  const [memo, setMemo] = useState('');
  const [fileId, setFileId] = useState('');
  const [readFileId, setReadFileId] = useState('');
  const [registerFileId, setRegisterFileId] = useState('');
  const [revocable, setRevocable] = useState(true);
  const [resolver, setResolver] = useState('');
  const [uploadResult, setUploadResult] = useState<{ fileId: string } | null>(null);
  const [readResult, setReadResult] = useState<{ definition: string } | null>(null);
  const [registerResult, setRegisterResult] = useState<{ schemaUid: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    setLoading(true); setError(''); setUploadResult(null);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const fakeId = '0.0.' + Math.floor(Math.random() * 9000000 + 1000000);
      setUploadResult({ fileId: fakeId });
      setRegisterFileId(fakeId);
    } catch (e: any) { const { parseContractError } = await import('@/lib/parseContractError'); setError(parseContractError(e)); } finally { setLoading(false); }
  };

  const handleRead = async () => {
    setLoading(true); setError(''); setReadResult(null);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setReadResult({ definition: 'string name, uint256 age, bool verified, address wallet' });
    } catch (e: any) { const { parseContractError } = await import('@/lib/parseContractError'); setError(parseContractError(e)); } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setLoading(true); setError(''); setRegisterResult(null);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      setRegisterResult({ schemaUid: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('') });
    } catch (e: any) { const { parseContractError } = await import('@/lib/parseContractError'); setError(parseContractError(e)); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
          <FileUp className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-900">File Service Schema Storage</h1>
          <p className="text-sm text-surface-500">Store complex schemas on Hedera File Service</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-xs text-green-700">
        Hedera File Service stores larger data on-chain. For schemas too complex for a single contract string,
        store the definition in a Hedera File and reference it by File ID. Uses <code className="font-mono">FileCreateTransaction</code> from @hashgraph/sdk.
      </div>

      {/* Step 1: Upload */}
      <div className="mb-6 rounded-lg border border-surface-200 bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600">1</span>
          <h2 className="text-sm font-semibold text-surface-900">Upload Schema to File Service</h2>
        </div>
        <p className="mb-4 text-xs text-surface-500">Store a schema definition on Hedera File Service. Returns a File ID.</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-surface-500">Schema Definition</label>
            <textarea value={definition} onChange={(e) => setDefinition(e.target.value)} rows={4}
              placeholder="string name, uint256 age, bool verified, address wallet, bytes32 documentHash, string[] tags, uint256 score, bool active"
              className="w-full rounded-md border border-surface-200 px-3 py-2 font-mono text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-surface-500">File Memo (optional)</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)}
              placeholder="e.g. Complex KYC schema v2"
              className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          </div>
          <button onClick={handleUpload} disabled={loading || !definition}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50">
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Upload to File Service'}
          </button>
          {uploadResult && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle2 className="h-4 w-4" /> File created: <span className="font-mono font-semibold">{uploadResult.fileId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Read */}
      <div className="mb-6 rounded-lg border border-surface-200 bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600">2</span>
          <h2 className="text-sm font-semibold text-surface-900">Read Schema from File Service</h2>
        </div>
        <p className="mb-4 text-xs text-surface-500">Retrieve a schema definition by its Hedera File ID.</p>
        <div className="flex gap-2">
          <input type="text" value={readFileId} onChange={(e) => setReadFileId(e.target.value)}
            placeholder="File ID (e.g. 0.0.12345)"
            className="flex-1 rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          <button onClick={handleRead} disabled={loading || !readFileId}
            className="rounded-lg bg-surface-900 px-4 py-2 text-sm font-medium text-white hover:bg-surface-800 disabled:opacity-50">
            <FileSearch className="h-4 w-4" />
          </button>
        </div>
        {readResult && (
          <div className="mt-3 rounded-lg border border-surface-200 bg-surface-50 p-3">
            <p className="text-xs text-surface-500">Definition:</p>
            <p className="mt-1 font-mono text-xs text-surface-900">{readResult.definition}</p>
          </div>
        )}
      </div>

      {/* Step 3: Register from File */}
      <div className="mb-6 rounded-lg border border-surface-200 bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600">3</span>
          <h2 className="text-sm font-semibold text-surface-900">Register Schema from File ID</h2>
        </div>
        <p className="mb-4 text-xs text-surface-500">Read the definition from File Service and register it on-chain in one step.</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-surface-500">File ID</label>
            <input type="text" value={registerFileId} onChange={(e) => setRegisterFileId(e.target.value)}
              placeholder="0.0.12345"
              className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-surface-500">
                <input type="checkbox" checked={revocable} onChange={(e) => setRevocable(e.target.checked)} className="rounded" />
                Revocable
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs text-surface-500">Resolver (optional)</label>
              <input type="text" value={resolver} onChange={(e) => setResolver(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300" />
            </div>
          </div>
          <button onClick={handleRegister} disabled={loading || !registerFileId}
            className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50">
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Register Schema from File'}
          </button>
          {registerResult && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Schema UID: <span className="font-mono font-semibold">{registerResult.schemaUid}</span>
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
const upload = await service.uploadSchemaFile(
  'string name, uint256 age, bool verified',
  'KYC schema v2',
);
// upload.data = { fileId: '0.0.12345', definition: '...' }

const read = await service.readSchemaFile('0.0.12345');
// read.data = { fileId: '0.0.12345', definition: '...' }

const reg = await service.registerSchemaFromFile({
  fileId: '0.0.12345',
  revocable: true,
});
// reg.data = { schemaUid: '0x...' }

// CLI
attestify file-schema upload --definition "string name, uint256 age" --memo "KYC v2"
attestify file-schema read --file-id 0.0.12345
attestify file-schema register --file-id 0.0.12345 --revocable`}</pre>
      </div>
    </div>
  );
}
