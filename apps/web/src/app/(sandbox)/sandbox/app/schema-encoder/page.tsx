'use client';

import { useState } from 'react';
import { Hash, ArrowRightLeft, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ethers } from 'ethers';

function parseSchemaFields(definition: string): { name: string; type: string }[] {
  return definition
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => {
      const parts = f.split(/\s+/);
      if (parts.length < 2) throw new Error(`Invalid field: "${f}"`);
      return { type: parts[0], name: parts.slice(1).join(' ') };
    });
}

function getDefaultValue(type: string): string {
  if (type === 'bool') return 'false';
  if (type === 'address') return '0x0000000000000000000000000000000000000000';
  if (type === 'string') return '';
  if (type.startsWith('bytes')) return '0x';
  if (type.startsWith('uint') || type.startsWith('int')) return '0';
  return '';
}

export default function SchemaEncoderPage() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [definition, setDefinition] = useState('string name, uint256 age, bool verified');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [hexInput, setHexInput] = useState('');
  const [result, setResult] = useState<string | Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleEncode = () => {
    setResult(null); setError(null);
    try {
      const fields = parseSchemaFields(definition);
      const types = fields.map((f) => f.type);
      const values = fields.map((f) => {
        const raw = fieldValues[f.name] ?? getDefaultValue(f.type);
        if (f.type === 'bool') return raw === 'true';
        if (f.type.startsWith('uint') || f.type.startsWith('int')) return raw;
        return raw;
      });
      const coder = ethers.AbiCoder.defaultAbiCoder();
      const encoded = coder.encode(types, values);
      setResult(encoded);
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err));
    }
  };

  const handleDecode = () => {
    setResult(null); setError(null);
    try {
      const fields = parseSchemaFields(definition);
      const types = fields.map((f) => f.type);
      const names = fields.map((f) => f.name);
      const coder = ethers.AbiCoder.defaultAbiCoder();
      const decoded = coder.decode(types, hexInput.trim());
      const out: Record<string, string> = {};
      for (let i = 0; i < names.length; i++) {
        out[names[i]] = String(decoded[i]);
      }
      setResult(out);
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  let fields: { name: string; type: string }[] = [];
  try { fields = parseSchemaFields(definition); } catch { /* ignore */ }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
          <Hash className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Schema Encoder / Decoder</h1>
            <span className="rounded-full bg-surface-200 px-3 py-0.5 text-xs font-medium text-surface-600">Tool</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">
            Encode attestation data to ABI hex, or decode hex back to readable field values.
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Mode Toggle */}
        <div className="flex gap-1 rounded-lg border border-surface-200 bg-white p-1">
          {(['encode', 'decode'] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setResult(null); setError(null); }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${mode === m ? 'bg-brand-500 text-white' : 'text-surface-600 hover:bg-surface-50'}`}>
              {m === 'encode' ? 'Encode → Hex' : 'Decode ← Hex'}
            </button>
          ))}
        </div>

        {/* Schema Definition */}
        <div className="rounded-lg border border-surface-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-surface-900">Schema Definition</h2>
          <input type="text" value={definition} onChange={(e) => { setDefinition(e.target.value); setResult(null); }}
            placeholder="string name, uint256 age, bool verified"
            className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          {fields.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {fields.map((f) => (
                <span key={f.name} className="rounded bg-surface-100 px-2 py-0.5 font-mono text-[10px] text-surface-600">
                  {f.type} {f.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Encode Mode */}
        {mode === 'encode' && fields.length > 0 && (
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-surface-900">Field Values</h2>
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.name}>
                  <label className="mb-1 block text-xs font-medium text-surface-500">
                    {f.name} <span className="font-mono text-brand-500">({f.type})</span>
                  </label>
                  <input type="text" value={fieldValues[f.name] ?? getDefaultValue(f.type)}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
              ))}
            </div>
            <button type="button" onClick={handleEncode}
              className="mt-4 flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
              <ArrowRightLeft className="h-4 w-4" /> Encode to Hex
            </button>
          </div>
        )}

        {/* Decode Mode */}
        {mode === 'decode' && (
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-surface-900">Hex Data</h2>
            <textarea value={hexInput} onChange={(e) => setHexInput(e.target.value)}
              placeholder="0x0000000000000000..."
              rows={4}
              className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <button type="button" onClick={handleDecode} disabled={!hexInput.trim()}
              className="mt-4 flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              <ArrowRightLeft className="h-4 w-4" /> Decode from Hex
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && typeof result === 'string' && (
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-semibold text-surface-900">Encoded Hex</h2>
              </div>
              <button type="button" onClick={() => copyToClipboard(result)}
                className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700">
                <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="break-all rounded-md bg-surface-50 p-3 font-mono text-xs text-surface-700">{result}</p>
          </div>
        )}

        {result && typeof result === 'object' && (
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <h2 className="text-sm font-semibold text-surface-900">Decoded Values</h2>
            </div>
            <div className="divide-y divide-surface-100">
              {Object.entries(result).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-4 py-2.5">
                  <span className="text-xs font-medium text-surface-500">{key}</span>
                  <span className="font-mono text-xs text-surface-700">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
