'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileCode2,
  FilePlus2,
  XCircle,
  UserCheck,
  Search,
  CheckCircle2,
  Home,
  ExternalLink,
  ShieldCheck,
  Eye,
  List,
  Coins,
  Lock,
  Users,
  Gift,
  GitMerge,
  Code2,
  Wallet,
  FileSearch,
  Layers,
  Shield,
  Award,
  Timer,
  KeyRound,
  CircleDollarSign,
  FileUp,
  Bot,
} from 'lucide-react';

const CORE_WORKFLOWS = [
  { icon: FileCode2, label: 'Schema Deployer', desc: 'Create and deploy attestation schemas', href: '/sandbox/app/schema-builder' },
  { icon: FilePlus2, label: 'Attestation Workflow', desc: 'Complete attestation lifecycle', href: '/sandbox/app/create-attestation' },
  { icon: XCircle, label: 'Revoke Attestation', desc: 'Revoke an existing attestation', href: '/sandbox/app/revoke' },
  { icon: UserCheck, label: 'Register Authority', desc: 'Register as a trusted authority', href: '/sandbox/app/register-authority' },
  { icon: ShieldCheck, label: 'Verify Authority', desc: 'Admin: set verification status', href: '/sandbox/app/verify-authority' },
];

const DELEGATION = [
  { icon: Users, label: 'Delegated Attestation', desc: 'Delegate authority, attest on behalf', href: '/sandbox/app/delegated-attestation' },
  { icon: Users, label: 'Delegated Revocation', desc: 'Revoke via delegates', href: '/sandbox/app/delegated-revocation' },
];

const RESOLVER_TOOLS = [
  { icon: List, label: 'Whitelist Manager', desc: 'Manage whitelist resolver addresses', href: '/sandbox/app/whitelist-manager' },
  { icon: Coins, label: 'Fee Resolver', desc: 'Deposit HBAR for fee-gated schemas', href: '/sandbox/app/fee-resolver' },
  { icon: Lock, label: 'Token Gated Resolver', desc: 'Configure token gate requirements', href: '/sandbox/app/token-gated' },
  { icon: Gift, label: 'Token Reward Resolver', desc: 'Configure HTS token rewards', href: '/sandbox/app/token-reward' },
  { icon: GitMerge, label: 'Cross-Contract Resolver', desc: 'Chain resolvers in a pipeline', href: '/sandbox/app/cross-contract' },
];

const DATA_TOOLS = [
  { icon: Code2, label: 'Schema Encoder', desc: 'Encode/decode attestation data', href: '/sandbox/app/schema-encoder' },
  { icon: Wallet, label: 'Wallet Attestations', desc: 'View attestations by address', href: '/sandbox/app/wallet-attestations' },
  { icon: FileSearch, label: 'Wallet Schemas', desc: 'View schemas by address', href: '/sandbox/app/wallet-schemas' },
  { icon: Layers, label: 'Schema Attestations', desc: 'View attestations by schema', href: '/sandbox/app/schema-attestations' },
];

const RETRIEVAL = [
  { icon: Eye, label: 'Lookup Attestation', desc: 'Read attestation from contract', href: '/sandbox/app/lookup' },
  { icon: Search, label: 'Universal Search', desc: 'Search UIDs and addresses', href: '/sandbox/app/search' },
];

const HEDERA_NATIVE = [
  { icon: Shield, label: 'Verify HCS Proof', desc: 'Notarization proof via HCS', href: '/sandbox/app/verify-hcs-proof' },
  { icon: Award, label: 'HTS NFT Credential', desc: 'Mint NFT for attestation', href: '/sandbox/app/nft-credential' },
  { icon: Timer, label: 'Scheduled Revocation', desc: 'Auto-revoke via scheduled tx', href: '/sandbox/app/scheduled-revocation' },
  { icon: KeyRound, label: 'Multi-Sig Authority', desc: 'Threshold key authority accounts', href: '/sandbox/app/multisig-authority' },
  { icon: CircleDollarSign, label: 'Token Staking', desc: 'Stake HTS tokens as authority', href: '/sandbox/app/token-staking' },
  { icon: FileUp, label: 'File Service Schema', desc: 'Store schemas on File Service', href: '/sandbox/app/file-schema' },
];

const AI_AGENT = [
  { icon: Bot, label: 'Agent Chat', desc: 'Chat with the Attestify AI Agent', href: '/sandbox/app/agent-chat' },
];

const EXTERNAL = [
  { label: 'Documentation', href: '/docs' },
  { label: 'GitHub', href: 'https://github.com/Aliyaan-Nasir/Attestify' },
];

type NavItem = { icon: React.ComponentType<{ className?: string }>; label: string; desc: string; href: string };

function NavGroup({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <>
      <p className="mt-5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">
        {title}
      </p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border border-brand-200 bg-brand-50 font-semibold text-brand-700'
                  : 'text-surface-600 hover:bg-surface-50'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.label}</p>
                <p className="truncate text-[10px] text-surface-500">{item.desc}</p>
              </div>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default function SandboxLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left sidebar — scrollable */}
      <aside className="w-64 shrink-0 border-r border-surface-200 bg-white">
        <div className="sticky top-16 flex max-h-[calc(100vh-64px)] flex-col">
          {/* Fixed header */}
          <div className="shrink-0 px-4 pt-4">
            <h2 className="text-sm font-semibold text-surface-900">Attestation Workflows</h2>
            <p className="mt-0.5 text-xs text-surface-500">
              Guided demos of the Attestify protocol
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-green-100 bg-green-50 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs font-semibold text-green-700">Live on Testnet</p>
                <p className="text-[10px] text-green-600">Connected to live Hedera contracts</p>
              </div>
            </div>
          </div>

          {/* Scrollable nav */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            {/* Overview link */}
            <Link
              href="/sandbox/app"
              className={`mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                pathname === '/sandbox/app'
                  ? 'border border-brand-200 bg-brand-50 font-semibold text-brand-700'
                  : 'text-surface-600 hover:bg-surface-50'
              }`}
            >
              <Home className="h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Overview</p>
                <p className="text-[10px] text-surface-500">All tools at a glance</p>
              </div>
            </Link>

            <NavGroup title="Core Workflows" items={CORE_WORKFLOWS} pathname={pathname} />
            <NavGroup title="Delegation" items={DELEGATION} pathname={pathname} />
            <NavGroup title="Resolver Tools" items={RESOLVER_TOOLS} pathname={pathname} />
            <NavGroup title="Data Tools" items={DATA_TOOLS} pathname={pathname} />
            <NavGroup title="Retrieval" items={RETRIEVAL} pathname={pathname} />
            <NavGroup title="Hedera Native" items={HEDERA_NATIVE} pathname={pathname} />
            <NavGroup title="AI Agent" items={AI_AGENT} pathname={pathname} />
          </div>

          {/* Fixed footer */}
          <div className="shrink-0 border-t border-surface-100 px-4 py-3 space-y-1">
            {EXTERNAL.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-surface-500 hover:text-surface-700"
              >
                {item.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      </aside>

      {/* Main content — independently scrollable */}
      <main className="flex-1 overflow-y-auto max-h-[calc(100vh-64px)] dot-bg">
        {children}
      </main>
    </div>
  );
}
