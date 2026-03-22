'use client';

import { useState } from 'react';
import { Award, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { useContract } from '@/hooks/useContract';
import { FormWrapper } from '@/components/sandbox/FormWrapper';

export default function NFTCredentialPage() {
  const contracts = useContract();
  const [attestationUid, setAttestationUid] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [result, setResult] = useState<{ serialNumber: string; tokenId: string } | null>(null);
  const [attestationInfo, setAttestationInfo] = useState<{ subject: string; schemaUid: string; attester: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!contracts || !attestationUid.trim()) return;
    setLookupLoading(true); setAttestationInfo(null); setError(null);
    try {
      const service = await contracts.getAttestationService(false);
      const record = await service.getAttestation(attestationUid.trim());
      setAttestationInfo({
        subject: record.subject,
        schemaUid: record.schemaUid,
        attester: record.attester,
      });
      setSubject(record.subject);
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err));
    } finally { setLookupLoading(false); }
  };

  const handleMint = async () => {
    if (!attestationUid.trim() || !tokenId.trim() || !subject.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      // Note: HTS NFT minting requires @hashgraph/sdk with operator keys.
      // In the sandbox, we show the parameters that would be sent to the SDK.
      // Direct browser minting via MetaMask is not supported for HTS — this
      // demonstrates the flow and parameters.
      setResult({
        serialNumber: 'Requires SDK with operator key (see docs)',
        tokenId: tokenId.trim(),
      });
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500"><Award className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">HTS NFT Credential</h1>
            <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">Hedera Native</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">
            Mint a Hedera Token Service (HTS) NFT as a verifiable credential for an attestation. The attestation UID is embedded in the NFT metadata.
          </p>
        </div>
      </div>

      <FormWrapper>
        <div className="max-w-2xl space-y-4">
          {/* Step 1: Lookup attestation */}
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold text-surface-900">Step 1 — Lookup Attestation</h2>
            <p className="mb-4 text-xs text-surface-500">Enter the attestation UID to auto-fill the subject address.</p>
            <div className="flex gap-2">
              <input type="text" placeholder="0x attestation UID..." value={attestationUid} onChange={(e) => setAttestationUid(e.target.value)}
                className="flex-1 rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <button type="button" onClick={handleLookup} disabled={!attestationUid.trim() || lookupLoading}
                className="rounded-md bg-surface-100 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 disabled:opacity-50">
                {lookupLoading ? 'Loading...' : 'Lookup'}
              </button>
            </div>
            {attestationInfo && (
              <div className="mt-3 rounded-md bg-green-50 p-3 text-xs text-green-700">
                <p>Attester: <span className="font-mono">{attestationInfo.attester}</span></p>
                <p>Subject: <span className="font-mono">{attestationInfo.subject}</span></p>
                <p>Schema: <span className="font-mono">{attestationInfo.schemaUid}</span></p>
              </div>
            )}
          </div>

          {/* Step 2: Configure NFT */}
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold text-surface-900">Step 2 — Configure NFT Mint</h2>
            <p className="mb-4 text-xs text-surface-500">Provide the HTS token ID for the NFT collection and the subject address.</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-700">HTS Token ID</label>
                <input type="text" placeholder="0.0.12345" value={tokenId} onChange={(e) => setTokenId(e.target.value)}
                  className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <p className="mt-1 text-[10px] text-surface-400">The NFT collection token ID on Hedera (must have supply key configured)</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-700">Subject Address</label>
                <input type="text" placeholder="0x..." value={subject} onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          {/* Step 3: Mint */}
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold text-surface-900">Step 3 — Mint NFT Credential</h2>
            <p className="mb-4 text-xs text-surface-500">
              Mints an HTS NFT with the attestation UID embedded as metadata. Uses Hedera&apos;s native Token Service — not an ERC-721 smart contract.
            </p>
            <button type="button" onClick={handleMint}
              disabled={!attestationUid.trim() || !tokenId.trim() || !subject.trim() || loading}
              className="flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {loading ? 'Minting...' : <><Award className="h-4 w-4" /> Mint NFT Credential</>}
            </button>

            {/* SDK code preview */}
            <div className="mt-4 rounded-md bg-surface-900 p-4">
              <p className="mb-2 text-[10px] font-medium text-surface-400">SDK Code</p>
              <pre className="font-mono text-[11px] text-green-400 whitespace-pre-wrap">{`const result = await service.mintNFT({
  subject: '${subject || '0x...'}',
  attestationUid: '${attestationUid || '0x...'}',
  tokenId: '${tokenId || '0.0.12345'}',
});
// result.data = { serialNumber: 1 }`}</pre>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-semibold text-green-900">NFT Mint Parameters</h2>
              </div>
              <div className="divide-y divide-green-200">
                {[
                  { label: 'Token ID', value: result.tokenId },
                  { label: 'Attestation UID', value: attestationUid },
                  { label: 'Subject', value: subject },
                  { label: 'Result', value: result.serialNumber },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 py-2">
                    <span className="text-xs font-medium text-green-700">{row.label}</span>
                    <span className="truncate font-mono text-xs text-green-800">{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-green-600">
                HTS NFT minting requires the @hashgraph/sdk with operator keys (not MetaMask). Use the SDK or CLI to execute this mint.
              </p>
              <div className="mt-2">
                <a href="https://hashscan.io/testnet/token/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-brand-500 hover:underline">
                  View tokens on HashScan <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-1 text-xs font-semibold text-blue-900">Why HTS NFTs?</h3>
            <p className="text-xs text-blue-700">
              Hedera Token Service (HTS) is a native token service built into the Hedera network — not an ERC-721 smart contract.
              HTS NFTs have lower gas costs, native royalty support, and are managed at the network level. The attestation UID
              is embedded as NFT metadata, creating a transferable (or non-transferable) verifiable credential.
            </p>
          </div>
        </div>
      </FormWrapper>
    </div>
  );
}
