import { Hero } from '@/components/marketing/Hero';
import { FeatureCard } from '@/components/marketing/FeatureCard';
import { CodeExample } from '@/components/marketing/CodeExample';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { KeyRound, Vote, Landmark, Star, ShieldCheck, Lock } from 'lucide-react';

const ATTESTATION_JSON = `{
  "uid": "0xabc123...def456",
  "schemaUid": "0x789012...345678",
  "attester": "0x1234567890abcdef1234567890abcdef12345678",
  "subject": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  "data": "0x0000000000000000000000000000000000000000000000000000000000000020...",
  "timestamp": 1710000000,
  "expirationTime": 0,
  "revoked": false,
  "nonce": 0
}`;

const ATTESTATION_CODE = `// Create an attestation
const { data: attestation } = await service.createAttestation({
  schemaUid: schemaUid,
  subject: '0x1234...5678',
  data: encodedData,
  expirationTime: 0,
});

// Verify an attestation
const { data: record } = await service.getAttestation(
  attestation.attestationUid
);
console.log('Status:', record.revoked ? 'Revoked' : 'Active');`;

const USE_CASES = [
  {
    icon: KeyRound,
    title: 'Token Gates',
    description: 'Gate access to DeFi protocols, DAOs, or services based on attestation status.',
  },
  {
    icon: Vote,
    title: 'DAO Voting',
    description: 'Attest voting eligibility and delegation rights. Verify membership on-chain.',
  },
  {
    icon: Landmark,
    title: 'DeFi Credit Limits',
    description: 'Issue credit score attestations that DeFi protocols can verify for lending limits.',
  },
  {
    icon: Star,
    title: 'Reputation',
    description: 'Build composable reputation from attestation history across protocols.',
  },
];

const COMPARISON = [
  { feature: 'On-chain verifiable', attestations: true, alternatives: false },
  { feature: 'Schema-structured data', attestations: true, alternatives: false },
  { feature: 'Revocable', attestations: true, alternatives: false },
  { feature: 'Resolver hooks', attestations: true, alternatives: false },
  { feature: 'Deterministic UIDs', attestations: true, alternatives: false },
  { feature: 'HCS audit trail', attestations: true, alternatives: false },
];

export default function AttestationProductPage() {
  return (
    <>
      <Hero
        title="The Internet has URLs. Blockchain has Attestations."
        subtitle="Products / Attestations"
        description="Attestations are cryptographically signed, on-chain claims made by an attester about a subject, structured according to a schema."
        primaryCta={{ label: 'Explore Attestations', href: '/attestations' }}
        secondaryCta={{ label: 'Create Attestation', href: '/sandbox/app/create-attestation' }}
      />

      {/* What is an Attestation */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <ScrollReveal>
          <p className="mb-2 font-mono text-sm text-brand-500">What is an Attestation?</p>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-surface-900">
            A verifiable claim, stored on-chain
          </h2>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-surface-500">
            An attestation is a signed statement by an attester about a subject. It references a schema
            for data structure, includes ABI-encoded data, and is permanently recorded on Hedera with a
            deterministic UID.
          </p>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <CodeExample code={ATTESTATION_JSON} title="attestation-record.json" language="json" />
        </ScrollReveal>
      </section>

      {/* Developer Code Example */}
      <section className="border-y border-surface-200 bg-surface-50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <ScrollReveal>
            <p className="mb-2 font-mono text-sm text-brand-500">Developer Quick Start</p>
            <h2 className="mb-6 text-2xl font-bold tracking-tight text-surface-900">
              Create and verify in a few lines
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <CodeExample code={ATTESTATION_CODE} title="attestation-lifecycle.ts" />
          </ScrollReveal>
        </div>
      </section>

      {/* Use Cases */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <ScrollReveal>
          <p className="mb-2 font-mono text-sm text-brand-500">Use Cases</p>
          <h2 className="mb-8 text-2xl font-bold tracking-tight text-surface-900">
            Attestations power real applications
          </h2>
        </ScrollReveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {USE_CASES.map((uc, i) => (
            <ScrollReveal key={uc.title} delay={i * 100}>
              <FeatureCard icon={uc.icon} title={uc.title} description={uc.description} />
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Privacy & Security */}
      <section className="border-y border-surface-200 bg-surface-50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="grid gap-8 sm:grid-cols-2">
            <ScrollReveal direction="left">
              <div>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-surface-900">Privacy by Design</h3>
                <p className="text-sm leading-relaxed text-surface-500">
                  Attestation data is ABI-encoded on-chain. Off-chain data can be referenced by hash.
                  Schemas define what is public and what stays private.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={150}>
              <div>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-surface-900">Composability</h3>
                <p className="text-sm leading-relaxed text-surface-500">
                  Attestations reference schemas by UID. Any protocol can verify attestations from any
                  attester. Build trust layers that compose across applications.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <ScrollReveal>
          <p className="mb-2 font-mono text-sm text-brand-500">Comparison</p>
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-surface-900">
            Attestations vs alternatives
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <div className="overflow-hidden rounded-md border border-surface-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-white">
                  <th className="px-4 py-3 text-left font-medium text-surface-500">Feature</th>
                  <th className="px-4 py-3 text-center font-medium text-brand-500">Attestify</th>
                  <th className="px-4 py-3 text-center font-medium text-surface-500">Simple Storage</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-surface-200/50 last:border-0">
                    <td className="px-4 py-2.5 text-surface-500">{row.feature}</td>
                    <td className="px-4 py-2.5 text-center text-green-400">{row.attestations ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2.5 text-center text-surface-500">{row.alternatives ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
