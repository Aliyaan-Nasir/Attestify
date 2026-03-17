import { Hero } from '@/components/marketing/Hero';
import { StatsSection } from '@/components/marketing/StatsSection';
import { FeatureCard } from '@/components/marketing/FeatureCard';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import {
  Cpu,
  Database,
  FileCode2,
  Globe,
  Layers,
  Shield,
  Zap,
  Clock,
} from 'lucide-react';

const WHY_HEDERA = [
  {
    icon: Zap,
    title: 'Sub-Second Finality',
    description: 'Hedera consensus provides deterministic finality in seconds, not minutes.',
  },
  {
    icon: Database,
    title: 'Mirror Node Indexing',
    description: 'Full event history available via the Mirror Node REST API for efficient data indexing.',
  },
  {
    icon: Shield,
    title: 'HCS Audit Trail',
    description: 'Consensus-timestamped audit logs independent of smart contract state.',
  },
  {
    icon: Layers,
    title: 'HTS Token Gating',
    description: 'Native token service integration for gating attestation access and minting NFT credentials.',
  },
  {
    icon: Cpu,
    title: 'EVM Compatibility',
    description: 'Solidity smart contracts on HSCS with access to Hedera-native precompiles.',
  },
  {
    icon: Globe,
    title: 'Low Transaction Fees',
    description: 'Predictable, low-cost transactions make attestation operations economically viable at scale.',
  },
];

const ROADMAP = [
  { phase: 'Phase 1', title: 'Core Protocol', description: 'Smart contracts, SDK, CLI, and indexer on Hedera testnet.', status: 'complete' as const },
  { phase: 'Phase 2', title: 'Frontend & Sandbox', description: 'Marketing site, protocol explorer, and interactive sandbox with 22+ tools.', status: 'complete' as const },
  { phase: 'Phase 3', title: 'Advanced Resolvers & Delegation', description: 'Multi-sig resolvers, delegated attestations/revocations, token reward resolver, and cross-contract pipeline resolver.', status: 'complete' as const },
  { phase: 'Phase 4', title: 'Hedera Native Features', description: 'HCS proofs, HTS NFT credentials, scheduled revocations, multi-sig authorities, token staking, and File Service schema storage.', status: 'complete' as const },
  { phase: 'Phase 5', title: 'Mainnet Launch', description: 'Production deployment, security audit, and mainnet migration.', status: 'planned' as const },
];

export default function AboutPage() {
  return (
    <>
      <Hero
        title="Making trust as simple as sending tokens"
        subtitle="About Attestify"
        description="Attestify is a Hedera-native attestation protocol that enables trusted authorities to issue, manage, and verify on-chain claims with sub-second finality."
      />

      {/* Live Stats */}
      <ScrollReveal>
        <StatsSection />
      </ScrollReveal>

      {/* Why We're Building This */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <ScrollReveal>
          <p className="mb-2 font-mono text-sm text-brand-500">Why We&apos;re Building This</p>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-surface-900">
            Trust infrastructure for the decentralized web
          </h2>
          <div className="max-w-2xl space-y-4 text-sm leading-relaxed text-surface-500">
            <p>
              The blockchain ecosystem lacks a standardized way to make verifiable claims about
              entities. Identity verification, credential issuance, and reputation systems are
              fragmented across proprietary solutions.
            </p>
            <p>
              Attestify provides a universal, schema-based attestation layer on Hedera. Any authority
              can register schemas, any attester can issue claims, and any verifier can check
              attestation status — all on-chain, all composable.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* Technical Foundation — Why Hedera */}
      <section className="border-y border-surface-200 bg-surface-50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <ScrollReveal>
            <p className="mb-2 font-mono text-sm text-brand-500">Technical Foundation</p>
            <h2 className="mb-8 text-2xl font-bold tracking-tight text-surface-900">
              Why Hedera
            </h2>
          </ScrollReveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_HEDERA.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 80}>
                <FeatureCard icon={item.icon} title={item.title} description={item.description} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <ScrollReveal>
          <p className="mb-2 font-mono text-sm text-brand-500">Architecture</p>
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-surface-900">
            Built different
          </h2>
        </ScrollReveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: FileCode2, title: 'Smart Contracts (HSCS)', desc: 'SchemaRegistry and AttestationService deployed on Hedera Smart Contract Service. Custom resolvers for whitelist, token gating, and fee collection.' },
            { icon: Layers, title: 'TypeScript SDK', desc: 'Full-featured SDK wrapping all contract interactions. Schema encoding, UID computation, HCS logging, and HTS operations built in.' },
            { icon: Database, title: 'Mirror Node Indexer', desc: 'Backend service polling Hedera Mirror Node for contract events. PostgreSQL storage with Prisma ORM. REST API for frontend data access.' },
            { icon: Clock, title: 'HCS Audit Trail', desc: 'Every attestation event logged to Hedera Consensus Service with immutable consensus timestamps. Independent audit trail with retry logic.' },
          ].map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 100}>
              <div className="rounded-md border border-surface-200 bg-white p-5">
                <div className="mb-2 flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-brand-500" />
                  <h3 className="text-sm font-semibold text-surface-900">{item.title}</h3>
                </div>
                <p className="text-sm text-surface-500">{item.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="border-y border-surface-200 bg-surface-50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <ScrollReveal>
            <p className="mb-2 font-mono text-sm text-brand-500">Roadmap</p>
            <h2 className="mb-8 text-2xl font-bold tracking-tight text-surface-900">
              What&apos;s ahead
            </h2>
          </ScrollReveal>
          <div className="space-y-4">
            {ROADMAP.map((item, i) => (
              <ScrollReveal key={item.phase} delay={i * 80}>
                <div className="flex items-start gap-4 rounded-md border border-surface-200 bg-white p-5">
                  <span
                    className={`mt-0.5 inline-block rounded px-2 py-0.5 font-mono text-xs ${
                      item.status === 'complete'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-surface-800 text-surface-500'
                    }`}
                  >
                    {item.phase}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900">{item.title}</h3>
                    <p className="text-sm text-surface-500">{item.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <ScrollReveal>
          <p className="mb-2 font-mono text-sm text-brand-500">Team</p>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-surface-900">
            Built for the Hedera Apex Hackathon
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-surface-500">
            Attestify is a project built with a passion for decentralized identity and
            verifiable credentials. On-chain attestations unlock composable trust for the entire
            Hedera ecosystem.
          </p>
        </ScrollReveal>
      </section>
    </>
  );
}
