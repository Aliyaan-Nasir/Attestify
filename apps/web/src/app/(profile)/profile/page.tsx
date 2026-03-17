'use client';

import Link from 'next/link';
import {
  User, ShieldCheck, FileCode2, Fingerprint, CheckCircle2, XCircle,
  ExternalLink, ScrollText, Wallet, Copy, Hash, Clock, Send, Inbox,
} from 'lucide-react';
import { indexerApi } from '@/lib/api';
import { HCS_TOPICS } from '@/lib/contracts';
import { useWallet } from '@/hooks/useWallet';
import { useIndexer } from '@/hooks/useIndexer';
import { usePaginatedIndexer } from '@/hooks/usePaginatedIndexer';
import { truncateHex, formatDate } from '@/lib/format';
import { DataTable } from '@/components/explorer/DataTable';
import { StatusBadge } from '@/components/explorer/StatusBadge';
import { computeAttestationStatus } from '@/lib/attestation-status';
import type { SchemaRecord, AttestationRecord } from '@/lib/api';
import { useState } from 'react';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="rounded p-1 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600"
      title="Copy"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-surface-200 bg-white px-5 py-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-surface-900">{value}</p>
        <p className="text-xs text-surface-500">{label}</p>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 pb-3">
      {icon}
      <h2 className="text-sm font-semibold text-surface-900">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-500">{count}</span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50/50 py-8 text-center text-sm text-surface-400">
      {message}
    </div>
  );
}

export default function ProfilePage() {
  const { state, connect } = useWallet();
  const address = state.address;

  const { data: authority, loading: authLoading } = useIndexer(
    () => address
      ? indexerApi.getAuthority(address)
      : Promise.resolve({ success: false as const, data: null as any }),
    [address],
  );

  const { data: schemas, loading: schemasLoading } = usePaginatedIndexer<SchemaRecord>(
    () => address
      ? indexerApi.getSchemas({ authority: address, limit: 50 })
      : Promise.resolve({ success: true as const, data: [] as SchemaRecord[], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } }),
    [address],
  );

  const { data: issued, loading: issuedLoading } = usePaginatedIndexer<AttestationRecord>(
    () => address
      ? indexerApi.getAttestations({ attester: address, limit: 50 })
      : Promise.resolve({ success: true as const, data: [] as AttestationRecord[], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } }),
    [address],
  );

  const { data: received, loading: receivedLoading } = usePaginatedIndexer<AttestationRecord>(
    () => address
      ? indexerApi.getAttestations({ subject: address, limit: 50 })
      : Promise.resolve({ success: true as const, data: [] as AttestationRecord[], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } }),
    [address],
  );

  const loading = authLoading || schemasLoading || issuedLoading || receivedLoading;

  // Not connected
  if (!address) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <div className="rounded-2xl border border-surface-200 bg-white px-12 py-14 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
            <Wallet className="h-8 w-8 text-brand-500" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-surface-900">Connect Your Wallet</h2>
          <p className="mb-8 max-w-xs text-sm leading-relaxed text-surface-500">
            Connect MetaMask to view your schemas, attestations, authority status, and HCS audit trail.
          </p>
          <button
            onClick={connect}
            className="rounded-lg bg-brand-500 px-8 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-600 hover:shadow-md"
          >
            Connect MetaMask
          </button>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-2xl bg-surface-100" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-100" />)}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-surface-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-sm">
              <User className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900">My Profile</h1>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-surface-500">{address}</span>
                <CopyButton text={address} />
              </div>
            </div>
          </div>

          {/* Authority badge */}
          {authority ? (
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${
              authority.isVerified
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-yellow-200 bg-yellow-50 text-yellow-700'
            }`}>
              {authority.isVerified
                ? <><CheckCircle2 className="h-4 w-4" /> Verified Authority</>
                : <><ShieldCheck className="h-4 w-4" /> Registered Authority</>
              }
            </div>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-surface-50 px-4 py-1.5 text-sm text-surface-500">
              <XCircle className="h-4 w-4" /> Not an Authority
            </span>
          )}
        </div>

        {/* Authority metadata row */}
        {authority && (
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-surface-100 pt-4 text-sm">
            <div className="flex items-center gap-2 text-surface-500">
              <Hash className="h-3.5 w-3.5" />
              <span className="text-surface-400">Metadata:</span>
              <span className="text-surface-700">{authority.metadata || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-surface-500">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-surface-400">Since:</span>
              <span className="text-surface-700">{formatDate(authority.createdAt)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<FileCode2 className="h-5 w-5 text-brand-600" />}
          label="Schemas Created"
          value={schemas.length}
          color="bg-brand-50"
        />
        <StatCard
          icon={<Send className="h-5 w-5 text-blue-600" />}
          label="Attestations Issued"
          value={issued.length}
          color="bg-blue-50"
        />
        <StatCard
          icon={<Inbox className="h-5 w-5 text-purple-600" />}
          label="Attestations Received"
          value={received.length}
          color="bg-purple-50"
        />
        <StatCard
          icon={<ScrollText className="h-5 w-5 text-emerald-600" />}
          label="HCS Topics"
          value={schemas.filter(s => s.hcsTopicId).length + 1}
          color="bg-emerald-50"
        />
      </div>

      {/* My Schemas */}
      <div className="rounded-xl border border-surface-200 bg-white shadow-sm">
        <div className="border-b border-surface-100 px-5 pt-5">
          <SectionHeader
            icon={<FileCode2 className="h-4 w-4 text-brand-500" />}
            title="My Schemas"
            count={schemas.length}
          />
        </div>
        <div className="p-5">
          {schemas.length === 0 ? (
            <EmptyState message="No schemas created yet. Deploy one from the Sandbox." />
          ) : (
            <DataTable<SchemaRecord>
              columns={[
                {
                  header: 'UID',
                  accessor: (row) => (
                    <Link href={`/schemas/${row.uid}`} className="font-mono text-xs text-brand-500 hover:underline">
                      {truncateHex(row.uid)}
                    </Link>
                  ),
                },
                {
                  header: 'Definition',
                  accessor: (row) => <span className="block max-w-xs truncate text-xs text-surface-700">{row.definition}</span>,
                },
                {
                  header: 'Revocable',
                  accessor: (row) => (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      row.revocable ? 'bg-green-50 text-green-600' : 'bg-surface-100 text-surface-500'
                    }`}>
                      {row.revocable ? 'Yes' : 'No'}
                    </span>
                  ),
                },
                {
                  header: 'HCS Topic',
                  accessor: (row) => row.hcsTopicId ? (
                    <a href={`https://hashscan.io/testnet/topic/${row.hcsTopicId}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-brand-500 hover:underline">
                      {row.hcsTopicId} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : <span className="text-xs text-surface-400">—</span>,
                },
                {
                  header: 'Created',
                  accessor: (row) => <span className="text-xs text-surface-500">{formatDate(row.createdAt)}</span>,
                },
              ]}
              data={schemas}
              keyExtractor={(row) => row.uid}
              onRowClick={(row) => { window.location.href = `/schemas/${row.uid}`; }}
            />
          )}
        </div>
      </div>

      {/* Attestations — two columns on large screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Issued */}
        <div className="rounded-xl border border-surface-200 bg-white shadow-sm">
          <div className="border-b border-surface-100 px-5 pt-5">
            <SectionHeader
              icon={<Send className="h-4 w-4 text-blue-500" />}
              title="Attestations Issued"
              count={issued.length}
            />
          </div>
          <div className="p-5">
            {issued.length === 0 ? (
              <EmptyState message="No attestations issued yet" />
            ) : (
              <div className="space-y-2">
                {issued.map((a) => (
                  <Link
                    key={a.uid}
                    href={`/attestations/${a.uid}`}
                    className="flex items-center justify-between rounded-lg border border-surface-100 px-4 py-3 transition-colors hover:bg-surface-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-brand-500">{truncateHex(a.uid, 12)}</p>
                      <p className="mt-0.5 text-[11px] text-surface-400">
                        To: <span className="font-mono">{truncateHex(a.subjectAddress, 6)}</span>
                        <span className="mx-2">·</span>
                        {formatDate(a.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={computeAttestationStatus(a.revoked, a.expirationTime)} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Received */}
        <div className="rounded-xl border border-surface-200 bg-white shadow-sm">
          <div className="border-b border-surface-100 px-5 pt-5">
            <SectionHeader
              icon={<Inbox className="h-4 w-4 text-purple-500" />}
              title="Attestations About Me"
              count={received.length}
            />
          </div>
          <div className="p-5">
            {received.length === 0 ? (
              <EmptyState message="No attestations about this address yet" />
            ) : (
              <div className="space-y-2">
                {received.map((a) => (
                  <Link
                    key={a.uid}
                    href={`/attestations/${a.uid}`}
                    className="flex items-center justify-between rounded-lg border border-surface-100 px-4 py-3 transition-colors hover:bg-surface-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-brand-500">{truncateHex(a.uid, 12)}</p>
                      <p className="mt-0.5 text-[11px] text-surface-400">
                        From: <span className="font-mono">{truncateHex(a.attesterAddress, 6)}</span>
                        <span className="mx-2">·</span>
                        {formatDate(a.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={computeAttestationStatus(a.revoked, a.expirationTime)} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HCS Audit Trail */}
      <div className="rounded-xl border border-surface-200 bg-white shadow-sm">
        <div className="border-b border-surface-100 px-5 pt-5">
          <SectionHeader
            icon={<ScrollText className="h-4 w-4 text-emerald-500" />}
            title="HCS Audit Trail"
          />
        </div>
        <div className="divide-y divide-surface-100 px-5">
          {/* Global topic */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-xs font-medium text-surface-700">Global Authorities Topic</p>
              <p className="mt-0.5 text-[11px] text-surface-400">All authority registrations and verifications</p>
            </div>
            <a href={`https://hashscan.io/testnet/topic/${HCS_TOPICS.authorities}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 font-mono text-xs text-brand-500 transition-colors hover:bg-surface-50">
              {HCS_TOPICS.authorities} <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Per-schema topics */}
          {schemas.filter(s => s.hcsTopicId).map((s) => (
            <div key={s.uid} className="flex items-center justify-between py-3">
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-xs font-medium text-surface-700">Schema Topic</p>
                <p className="mt-0.5 truncate text-[11px] text-surface-400">{s.definition}</p>
              </div>
              <a href={`https://hashscan.io/testnet/topic/${s.hcsTopicId}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 font-mono text-xs text-brand-500 transition-colors hover:bg-surface-50">
                {s.hcsTopicId} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}

          {schemas.filter(s => s.hcsTopicId).length === 0 && (
            <div className="py-3 text-center text-xs text-surface-400">
              No per-schema topics yet — deploy a schema to get one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}