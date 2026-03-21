'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bot, Send, Loader2, Trash2, AlertTriangle, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3002';

const SUGGESTIONS = [
  'List all registered schemas',
  'What authorities are registered?',
  'Show me the latest attestations',
  'How do I create a new schema?',
  'Explain how resolvers work in Attestify',
];

// ─── Rich text rendering ─────────────────────────────────────────────────────

/** Detect 0x + 64 hex chars (schema/attestation UID) */
const UID_RE = /\b(0x[0-9a-fA-F]{64})\b/g;
/** Detect 0x + 40 hex chars (EVM address) */
const ADDR_RE = /\b(0x[0-9a-fA-F]{40})\b/g;
/** Inline code */
const CODE_RE = /`([^`]+)`/g;
/** Bold */
const BOLD_RE = /\*\*([^*]+)\*\*/g;
/** Markdown links [text](url) */
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

function uidLink(uid: string): string {
  // Could be a schema or attestation — link to attestation by default,
  // the explorer will redirect if it's a schema
  return `/attestations/${uid}`;
}

function addrLink(addr: string): string {
  return `/authorities/${addr}`;
}

/**
 * Render agent message content with clickable UIDs, addresses,
 * inline code, and bold text. Preserves whitespace/newlines.
 */
function renderAgentContent(text: string): ReactNode[] {
  // Split by lines first to preserve structure
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    // Combine all patterns into segments
    const segments: ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      // Find the earliest match among all patterns
      const uidMatch = UID_RE.exec(remaining);
      UID_RE.lastIndex = 0;
      const addrMatch = ADDR_RE.exec(remaining);
      ADDR_RE.lastIndex = 0;
      const codeMatch = CODE_RE.exec(remaining);
      CODE_RE.lastIndex = 0;
      const boldMatch = BOLD_RE.exec(remaining);
      BOLD_RE.lastIndex = 0;

      type Match = { index: number; length: number; node: ReactNode };
      const candidates: Match[] = [];

      if (uidMatch) {
        const uid = uidMatch[1];
        candidates.push({
          index: uidMatch.index,
          length: uidMatch[0].length,
          node: (
            <Link
              key={`uid-${lineIdx}-${key}`}
              href={uidLink(uid)}
              className="font-mono text-brand-600 underline decoration-brand-300 hover:text-brand-800"
              title="View in Explorer"
            >
              {uid.slice(0, 10)}…{uid.slice(-6)}
            </Link>
          ),
        });
      }
      if (addrMatch && !uidMatch?.index?.toString().includes(addrMatch.index.toString())) {
        // Only match addresses that aren't part of a UID
        const addr = addrMatch[1];
        const isInsideUid = uidMatch && addrMatch.index >= uidMatch.index && addrMatch.index < uidMatch.index + uidMatch[0].length;
        if (!isInsideUid) {
          candidates.push({
            index: addrMatch.index,
            length: addrMatch[0].length,
            node: (
              <Link
                key={`addr-${lineIdx}-${key}`}
                href={addrLink(addr)}
                className="font-mono text-blue-600 underline decoration-blue-300 hover:text-blue-800"
                title="View authority"
              >
                {addr.slice(0, 8)}…{addr.slice(-4)}
              </Link>
            ),
          });
        }
      }
      if (codeMatch) {
        candidates.push({
          index: codeMatch.index,
          length: codeMatch[0].length,
          node: (
            <code
              key={`code-${lineIdx}-${key}`}
              className="rounded bg-surface-200 px-1 py-0.5 font-mono text-xs text-surface-700"
            >
              {codeMatch[1]}
            </code>
          ),
        });
      }
      if (boldMatch) {
        candidates.push({
          index: boldMatch.index,
          length: boldMatch[0].length,
          node: (
            <span key={`bold-${lineIdx}-${key}`} className="font-semibold">
              {boldMatch[1]}
            </span>
          ),
        });
      }

      const linkMatch = LINK_RE.exec(remaining);
      LINK_RE.lastIndex = 0;
      if (linkMatch) {
        candidates.push({
          index: linkMatch.index,
          length: linkMatch[0].length,
          node: (
            <a
              key={`link-${lineIdx}-${key}`}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline decoration-brand-300 hover:text-brand-800"
            >
              {linkMatch[1]}
            </a>
          ),
        });
      }

      if (candidates.length === 0) {
        segments.push(remaining);
        break;
      }

      // Pick the earliest match
      candidates.sort((a, b) => a.index - b.index);
      const best = candidates[0];

      // Text before the match
      if (best.index > 0) {
        segments.push(remaining.slice(0, best.index));
      }
      segments.push(best.node);
      key++;
      remaining = remaining.slice(best.index + best.length);
    }

    return (
      <span key={`line-${lineIdx}`}>
        {segments}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AgentChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId] = useState(() => `web-${Date.now()}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, timestamp: new Date() }]);
    setLoading(true);

    try {
      const res = await fetch(`${AGENT_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationId }),
      });

      if (!res.ok) {
        throw new Error(`Agent returned ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.response) {
        setMessages((prev) => [
          ...prev,
          { role: 'agent', content: data.response, timestamp: new Date() },
        ]);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reach the agent');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = async () => {
    setMessages([]);
    setError(null);
    try {
      await fetch(`${AGENT_URL}/api/chat/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-full flex-col p-8">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">
              Attestify Agent
            </h1>
            <span className="rounded-full bg-brand-100 px-3 py-0.5 text-xs font-medium text-brand-700">
              AI Chat
            </span>
          </div>
          <p className="mt-1 text-sm text-surface-500">
            Chat with the Attestify AI Agent — supports{' '}
            <span className="font-medium text-green-600">HCS-10</span>,{' '}
            <span className="font-medium text-blue-600">A2A</span>,{' '}
            <span className="font-medium text-purple-600">MCP</span>,{' '}
            <span className="font-medium text-orange-500">XMTP</span>, and{' '}
            <span className="font-medium text-surface-700">REST</span> protocols.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 rounded-md border border-surface-200 px-3 py-1.5 text-xs text-surface-500 hover:bg-surface-50 hover:text-surface-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-lg border border-surface-200 bg-white"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <Sparkles className="h-8 w-8 text-brand-500" />
            </div>
            <h2 className="text-lg font-semibold text-surface-900">
              What can I help you with?
            </h2>
            <p className="mt-1 mb-6 max-w-md text-sm text-surface-500">
              I can interact with the Attestify protocol on Hedera Testnet — schemas,
              attestations, authorities, resolvers, and more.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-surface-200 px-3 py-1.5 text-xs text-surface-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'agent' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 overflow-hidden">
                    <Image src="/logo3.png" alt="Attestify" width={28} height={28} className="h-5 w-5 object-contain" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-brand-500 text-white'
                      : 'border border-surface-200 bg-surface-50 text-surface-800'
                  }`}
                >
                  {msg.role === 'agent' ? (
                    <div>{renderAgentContent(msg.content)}</div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 overflow-hidden">
                  <Image src="/logo3.png" alt="Attestify" width={28} height={28} className="h-5 w-5 object-contain" />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Attestify Agent anything..."
          disabled={loading}
          className="flex-1 rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          aria-label="Chat message input"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          aria-label="Send message"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send
        </button>
      </form>
    </div>
  );
}
