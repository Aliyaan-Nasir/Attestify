'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScrollText, RefreshCw, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3001/api';

interface HCSTopicInfo {
  name: string;
  topicId: string;
  hashscanUrl: string;
}

interface HCSMessageEntry {
  sequenceNumber: number;
  consensusTimestamp: string;
  payer: string;
  content: {
    version: string;
    type: string;
    payload: Record<string, unknown>;
  } | string;
}

export default function AuditLogPage() {
  const [topics, setTopics] = useState<HCSTopicInfo[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [messages, setMessages] = useState<HCSMessageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [expandedMsg, setExpandedMsg] = useState<number | null>(null);

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      const res = await fetch(`${INDEXER_URL}/hcs/topics`);
      const json = await res.json();
      if (json.success) {
        setEnabled(json.data.enabled);
        setTopics(json.data.topics || []);
        if (json.data.topics?.length > 0 && !selectedTopic) {
          setSelectedTopic(json.data.topics[0].topicId);
        }
      }
    } catch { /* indexer might not be running */ }
    finally { setTopicsLoading(false); }
  }, [selectedTopic]);

  const loadMessages = useCallback(async () => {
    if (!selectedTopic) return;
    setLoading(true);
    try {
      const res = await fetch(`${INDEXER_URL}/hcs/messages/${selectedTopic}?limit=50&order=desc`);
      const json = await res.json();
      if (json.success) {
        setMessages(json.data.messages || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedTopic]);

  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  const formatTimestamp = (ts: string) => {
    try {
      const seconds = parseFloat(ts);
      return new Date(seconds * 1000).toLocaleString();
    } catch { return ts; }
  };

  const getEventBadge = (type: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      'schema.registered': { label: 'Schema', color: 'bg-blue-100 text-blue-700' },
      'attestation.created': { label: 'Attestation', color: 'bg-green-100 text-green-700' },
      'attestation.revoked': { label: 'Revoked', color: 'bg-red-100 text-red-700' },
      'authority.registered': { label: 'Authority', color: 'bg-purple-100 text-purple-700' },
      'topic.initialized': { label: 'Init', color: 'bg-surface-100 text-surface-600' },
    };
    return badges[type] || { label: type, color: 'bg-surface-100 text-surface-600' };
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="h-5 w-5 text-surface-400" />
          <div>
            <h1 className="text-xl font-semibold text-surface-900">HCS Audit Log</h1>
            <p className="text-sm text-surface-500">Immutable, consensus-timestamped event log on Hedera Consensus Service</p>
          </div>
        </div>
        <button onClick={loadMessages} disabled={loading} className="flex items-center gap-1.5 rounded-md border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-600 hover:bg-surface-50 disabled:opacity-50" aria-label="Refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {topicsLoading ? (
        <div className="rounded-lg border border-surface-200 bg-white p-8 text-center text-sm text-surface-400">Loading...</div>
      ) : !enabled ? (
        <div className="rounded-lg border border-surface-200 bg-white p-8 text-center">
          <p className="text-sm text-surface-500">HCS audit logging is not configured.</p>
          <p className="mt-1 text-xs text-surface-400">Set HCS_TOPIC_SCHEMAS, HCS_TOPIC_ATTESTATIONS, HCS_TOPIC_AUTHORITIES in the indexer .env</p>
        </div>
      ) : (
        <>
          {/* Topic selector */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {topics.map((t) => (
              <button key={t.topicId} onClick={() => setSelectedTopic(t.topicId)}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  selectedTopic === t.topicId
                    ? 'border-brand-300 bg-brand-50 font-medium text-brand-700'
                    : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'
                }`}>
                <span className="capitalize">{t.name}</span>
                <span className="font-mono text-[10px] text-surface-400">{t.topicId}</span>
              </button>
            ))}
          </div>

          {/* HashScan link */}
          {selectedTopic && (
            <div className="mb-4">
              <a href={`https://hashscan.io/testnet/topic/${selectedTopic}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                View on HashScan <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Messages */}
          {loading ? (
            <div className="rounded-lg border border-surface-200 bg-white p-8 text-center text-sm text-surface-400">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="rounded-lg border border-surface-200 bg-white p-8 text-center text-sm text-surface-400">No messages in this topic yet.</div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => {
                const isExpanded = expandedMsg === msg.sequenceNumber;
                const content = typeof msg.content === 'object' ? msg.content : null;
                const eventType = content?.type || 'unknown';
                const badge = getEventBadge(eventType);

                return (
                  <div key={msg.sequenceNumber} className="rounded-lg border border-surface-200 bg-white">
                    <button onClick={() => setExpandedMsg(isExpanded ? null : msg.sequenceNumber)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-surface-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-surface-400" />}
                      <span className="font-mono text-xs text-surface-400">#{msg.sequenceNumber}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.color}`}>{badge.label}</span>
                      <span className="text-xs text-surface-500">{formatTimestamp(msg.consensusTimestamp)}</span>
                      {content && eventType === 'attestation.created' && (
                        <span className="ml-auto truncate font-mono text-[10px] text-surface-400">
                          {(content.payload as Record<string, string>).attestationUid?.slice(0, 18)}...
                        </span>
                      )}
                      {content && eventType === 'schema.registered' && (
                        <span className="ml-auto truncate font-mono text-[10px] text-surface-400">
                          {(content.payload as Record<string, string>).uid?.slice(0, 18)}...
                        </span>
                      )}
                    </button>

                    {isExpanded && content && (
                      <div className="border-t border-surface-100 px-4 py-3">
                        <pre className="overflow-x-auto rounded-md bg-surface-50 p-3 text-xs text-surface-700">
                          {JSON.stringify(content, null, 2)}
                        </pre>
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-surface-400">
                          <span>Payer: {msg.payer}</span>
                          <span>Consensus: {msg.consensusTimestamp}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
