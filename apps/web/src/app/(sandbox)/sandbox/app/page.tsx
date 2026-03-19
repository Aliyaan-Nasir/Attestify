'use client';

import Link from 'next/link';
import {
  ArrowRight,
  FileCode2,
  FilePlus2,
  XCircle,
  UserCheck,
  Search,
  CheckCircle2,
  Wallet,
  ShieldCheck,
  Eye,
  List,
  Coins,
  Lock,
  Puzzle,
  Fingerprint,
  Hash,
  Users,
  Gift,
  GitMerge,
  Shield,
  Award,
  Timer,
  Zap,
  KeyRound,
  CircleDollarSign,
  FileUp,
} from 'lucide-react';

const CORE_WORKFLOWS = [
  {
    icon: FileCode2,
    label: 'Schema Deployer',
    desc: 'Create and deploy attestation schemas',
    time: '5 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/schema-builder',
  },
  {
    icon: FilePlus2,
    label: 'Attestation Workflow',
    desc: 'Complete attestation lifecycle with schema creation',
    time: '8 min',
    level: 'Intermediate',
    levelColor: 'text-yellow-600',
    href: '/sandbox/app/create-attestation',
  },
  {
    icon: XCircle,
    label: 'Revoke Attestation',
    desc: 'Revoke attestations directly',
    time: '4 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/revoke',
  },
  {
    icon: UserCheck,
    label: 'Register Authority',
    desc: 'Register as a trusted authority',
    time: '3 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/register-authority',
  },
  {
    icon: ShieldCheck,
    label: 'Verify Authority',
    desc: 'Admin: set authority verification status',
    time: '2 min',
    level: 'Admin',
    levelColor: 'text-amber-600',
    href: '/sandbox/app/verify-authority',
  },
  {
    icon: Users,
    label: 'Delegated Attestation',
    desc: 'Delegate authority to AI agents or other wallets',
    time: '5 min',
    level: 'Intermediate',
    levelColor: 'text-yellow-600',
    href: '/sandbox/app/delegated-attestation',
  },
  {
    icon: XCircle,
    label: 'Delegated Revocation',
    desc: 'Revoke attestations via delegates',
    time: '4 min',
    level: 'Intermediate',
    levelColor: 'text-yellow-600',
    href: '/sandbox/app/delegated-revocation',
  },
];

const RESOLVER_TOOLS = [
  {
    icon: Hash,
    label: 'Schema Encoder / Decoder',
    desc: 'Encode attestation data to hex or decode hex to values',
    time: '2 min',
    level: 'Tool',
    levelColor: 'text-blue-600',
    href: '/sandbox/app/schema-encoder',
  },
  {
    icon: List,
    label: 'Whitelist Manager',
    desc: 'Add/remove addresses from the whitelist resolver',
    time: '3 min',
    level: 'Admin',
    levelColor: 'text-amber-600',
    href: '/sandbox/app/whitelist-manager',
  },
  {
    icon: Coins,
    label: 'Fee Resolver',
    desc: 'Deposit HBAR for fee-gated attestation schemas',
    time: '3 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/fee-resolver',
  },
  {
    icon: Lock,
    label: 'Token Gated Resolver',
    desc: 'Configure HTS token gate requirements',
    time: '3 min',
    level: 'Admin',
    levelColor: 'text-amber-600',
    href: '/sandbox/app/token-gated',
  },
  {
    icon: Gift,
    label: 'Token Reward Resolver',
    desc: 'Issue HTS tokens upon attestation',
    time: '5 min',
    level: 'Advanced',
    levelColor: 'text-purple-600',
    href: '/sandbox/app/token-reward',
  },
  {
    icon: GitMerge,
    label: 'Cross-Contract Resolver',
    desc: 'Multi-contract validation pipeline',
    time: '5 min',
    level: 'Expert',
    levelColor: 'text-red-600',
    href: '/sandbox/app/cross-contract',
  },
];

const RETRIEVAL_FLOWS = [
  {
    icon: Eye,
    label: 'Lookup Attestation',
    desc: 'Read attestation directly from the contract',
    time: '2 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/lookup',
  },
  {
    icon: Search,
    label: 'Universal Search',
    desc: 'Search by UID or address',
    time: '2 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/search',
  },
  {
    icon: Fingerprint,
    label: 'Wallet Attestations',
    desc: 'Get all attestations for a wallet',
    time: '3 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/wallet-attestations',
  },
  {
    icon: FileCode2,
    label: 'Wallet Schemas',
    desc: 'Get schemas deployed by a wallet',
    time: '3 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/wallet-schemas',
  },
  {
    icon: FileCode2,
    label: 'Schema Attestations',
    desc: 'Get all attestations for a schema',
    time: '3 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/schema-attestations',
  },
];

const HEDERA_NATIVE = [
  {
    icon: Shield,
    label: 'Verify HCS Proof',
    desc: 'Verify attestation existence via HCS consensus timestamp',
    time: '2 min',
    level: 'Beginner',
    levelColor: 'text-green-600',
    href: '/sandbox/app/verify-hcs-proof',
  },
  {
    icon: Award,
    label: 'HTS NFT Credential',
    desc: 'Mint a Hedera-native NFT for an attestation',
    time: '3 min',
    level: 'Intermediate',
    levelColor: 'text-yellow-600',
    href: '/sandbox/app/nft-credential',
  },
  {
    icon: Timer,
    label: 'Scheduled Revocation',
    desc: 'Auto-revoke via Hedera Scheduled Transactions',
    time: '5 min',
    level: 'Advanced',
    levelColor: 'text-purple-600',
    href: '/sandbox/app/scheduled-revocation',
  },
  {
    icon: KeyRound,
    label: 'Multi-Sig Authority',
    desc: 'Create threshold-key authority accounts',
    time: '5 min',
    level: 'Advanced',
    levelColor: 'text-purple-600',
    href: '/sandbox/app/multisig-authority',
  },
  {
    icon: CircleDollarSign,
    label: 'Token Staking',
    desc: 'Stake HTS tokens to maintain authority status',
    time: '4 min',
    level: 'Intermediate',
    levelColor: 'text-yellow-600',
    href: '/sandbox/app/token-staking',
  },
  {
    icon: FileUp,
    label: 'File Service Schema',
    desc: 'Store complex schemas on Hedera File Service',
    time: '5 min',
    level: 'Intermediate',
    levelColor: 'text-yellow-600',
    href: '/sandbox/app/file-schema',
  },
];

export default function SandboxOverview() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-sm text-surface-500">Interactive Demo Environment</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3 w-3" /> Live on Testnet
          </span>
          <span className="text-xs text-surface-400">Hedera Smart Contracts</span>
          <span className="text-xs text-surface-400">TypeScript SDK</span>
        </div>

      </div>

      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-4">
        {/* Core Workflows */}
        <div className="rounded-lg border border-surface-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-surface-400" />
            <h2 className="text-lg font-semibold text-surface-900">Core Workflows</h2>
          </div>
          <div className="space-y-1">
            {CORE_WORKFLOWS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-md px-3 py-3 transition-colors hover:bg-surface-50"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-surface-400" />
                  <div>
                    <p className="text-sm font-medium text-surface-900">{item.label}</p>
                    <p className="text-xs text-surface-500">{item.desc}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-surface-400">{item.time}</span>
                      <span className={`text-[10px] font-medium ${item.levelColor}`}>{item.level}</span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-300 transition-colors group-hover:text-brand-500" />
              </Link>
            ))}
          </div>
          <p className="mt-4 rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-600">
            Essential attestation workflows that form the foundation of the protocol.
          </p>
        </div>

        {/* Resolver Tools */}
        <div>
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-surface-400" />
              <h2 className="text-lg font-semibold text-surface-900">Resolver Tools</h2>
            </div>
            <div className="space-y-1">
              {RESOLVER_TOOLS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-md px-3 py-3 transition-colors hover:bg-surface-50"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-surface-400" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{item.label}</p>
                      <p className="text-xs text-surface-500">{item.desc}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-surface-400">{item.time}</span>
                        <span className={`text-[10px] font-medium ${item.levelColor}`}>{item.level}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-300 transition-colors group-hover:text-brand-500" />
                </Link>
              ))}
            </div>
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-600">
              Custom validation logic that runs automatically during attestation creation.
            </p>
          </div>
        </div>

        {/* Retrieval Flows */}
        <div>
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-surface-400" />
              <h2 className="text-lg font-semibold text-surface-900">Retrieval Flows</h2>
            </div>
            <div className="space-y-1">
              {RETRIEVAL_FLOWS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-md px-3 py-3 transition-colors hover:bg-surface-50"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-surface-400" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{item.label}</p>
                      <p className="text-xs text-surface-500">{item.desc}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-surface-400">{item.time}</span>
                        <span className={`text-[10px] font-medium ${item.levelColor}`}>{item.level}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-300 transition-colors group-hover:text-brand-500" />
                </Link>
              ))}
            </div>
            <p className="mt-4 rounded-md bg-surface-50 px-3 py-2 text-xs text-surface-500">
              Query and retrieve attestation data from the Hedera network.
            </p>
          </div>

          {/* Getting Started */}
          <div className="mt-6 rounded-lg border border-surface-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-surface-900">Getting Started</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600">1</span>
                <div>
                  <p className="text-xs font-medium text-surface-700">Connect MetaMask</p>
                  <p className="text-[10px] text-surface-400">Switch to Hedera Testnet (Chain ID 296)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600">2</span>
                <div>
                  <p className="text-xs font-medium text-surface-700">Get Testnet HBAR</p>
                  <p className="text-[10px] text-surface-400">Use the Hedera faucet for gas fees</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600">3</span>
                <div>
                  <p className="text-xs font-medium text-surface-700">Pick a Workflow</p>
                  <p className="text-[10px] text-surface-400">Start with Schema Deployer</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hedera Native */}
        <div>
          <div className="rounded-lg border border-green-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-500" />
              <h2 className="text-lg font-semibold text-surface-900">Hedera Native</h2>
            </div>
            <div className="space-y-1">
              {HEDERA_NATIVE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-md px-3 py-3 transition-colors hover:bg-surface-50"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{item.label}</p>
                      <p className="text-xs text-surface-500">{item.desc}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-surface-400">{item.time}</span>
                        <span className={`text-[10px] font-medium ${item.levelColor}`}>{item.level}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-300 transition-colors group-hover:text-green-500" />
                </Link>
              ))}
            </div>
            <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
              Features that leverage Hedera-native services (HCS, HTS, Scheduled Transactions) — not available on other chains.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
