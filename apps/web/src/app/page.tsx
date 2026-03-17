import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, Shield, Timer, Link2, Users } from 'lucide-react';
import { StatsSection } from '@/components/marketing/StatsSection';
import { CodeExample } from '@/components/marketing/CodeExample';
import { HowItWorksStepper } from '@/components/marketing/HowItWorksStepper';
import { UseCasesScroller } from '@/components/marketing/UseCasesScroller';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

const PAIN_POINTS = [
  {
    icon: Timer,
    title: 'Smart contracts require deep Solidity expertise',
    description: 'Weeks of development time for basic verification',
  },
  {
    icon: Link2,
    title: 'Existing attestation frameworks are complex and expensive',
    description: 'Too much overhead for basic verification use cases',
  },
  {
    icon: Shield,
    title: 'ZK proofs add complexity without clear business value',
    description: 'Cryptography expertise needed for simple use cases',
  },
  {
    icon: Users,
    title: "Enterprise teams can't justify months of integration work",
    description: 'Too much technical overhead for business requirements',
  },
];

const HERO_CODE = `import { HederaAttestService } from '@attestify/sdk';

const service = new HederaAttestService({
  network: 'testnet',
  operatorAccountId: '0.0.12345',
  operatorPrivateKey: '0x...',
  contractAddresses: {
    schemaRegistry: '0x8320...2e80',
    attestationService: '0xce57...4331',
  },
});

// Get an attestation and check status
const { data } = await service.getAttestation(uid);
console.log(data.revoked ? 'Revoked' : 'Active');`;

const SCHEMA_CODE = `// Schema definition — comma-separated Solidity ABI types
"string name, uint8 level, bool verified"

// Register on-chain via the SDK
const { data } = await service.registerSchema({
  definition: 'string name, uint8 level, bool verified',
  revocable: true,
});

console.log('Schema UID:', data.schemaUid);
// UID is deterministic: keccak256(definition, resolver, revocable)`;

const CODE_EXAMPLES = [
  {
    label: 'REGISTER SCHEMA',
    color: 'text-brand-500',
    code: `const { data } = await service
  .registerSchema({
    definition:
      'string name, uint8 level',
    revocable: true,
  });
console.log(data.schemaUid);`,
  },
  {
    label: 'CREATE ATTESTATION',
    color: 'text-blue-500',
    code: `const { data } = await service
  .createAttestation({
    schemaUid: schema.uid,
    subject: '0x1234...5678',
    data: encodedData,
    expirationTime: 0,
  });
console.log(data.attestationUid);`,
  },
  {
    label: 'REVOKE ATTESTATION',
    color: 'text-purple-500',
    code: `const result = await service
  .revokeAttestation(attestationUid);

if (result.success) {
  console.log('Revoked');
} else {
  console.log(result.error.message);
}`,
  },
];

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Schema-based, not contract-based',
    description: 'Define what you want to verify with simple JSON schemas. We handle the blockchain complexity.',
    traditional: 'Write smart contracts from scratch, handle upgrades, audits, and security',
    attestify: 'Define what you want to verify with simple JSON schemas. We handle the blockchain complexity.',
  },
  {
    num: '02',
    title: 'One-line verification',
    description: 'Verify any attestation with a single SDK call. No blockchain expertise required.',
    traditional: 'Build custom verification logic, manage RPC connections, handle edge cases manually',
    attestify: 'Call service.getAttestation(uid) and check the result. That\'s it.',
  },
  {
    num: '03',
    title: 'Built on Hedera for speed and cost',
    description: 'Sub-second finality, predictable fees, and enterprise-grade infrastructure.',
    traditional: 'Wait for block confirmations, pay unpredictable gas fees, deal with network congestion',
    attestify: 'Instant finality on Hedera with fixed, low-cost transactions.',
  },
];



export default function Home() {
  return (
    <>
      {/* Section 1: Hero */}
      <section className="grid-bg relative overflow-hidden border-b border-surface-200">
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
          <ScrollReveal direction="none">
            <div className="mb-6 inline-block">
              <span className="bracket-label bracket-label-bottom text-brand-500 font-mono">
                HEDERA-NATIVE ATTESTATIONS
              </span>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-surface-900 sm:text-6xl">
              On-chain proof, no<br />
              <span className="text-brand-500">coding</span> required
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-surface-500">
              Attestify is the trust layer for Hedera — the lightweight attestation protocol that makes
              verification simple, fast, and universal.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={350}>
            <div className="mx-auto mt-10 max-w-lg">
              <CodeExample code={HERO_CODE} title="quick-start.ts" />
              <div className="mt-3 flex items-center justify-between rounded-md border border-surface-200 bg-white px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-surface-500">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                  Initialize, attest, verify. That&apos;s the whole SDK.
                </span>
                <Link
                  href="/sandbox"
                  className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
                >
                  Start building
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 2: Problem Statement */}
      <section className="border-b border-surface-200 py-24">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-surface-900 sm:text-5xl">
              The onchain identity<br />problem is killing<br />adoption
            </h2>
            <p className="mt-4 text-base text-surface-500">
              Developers waste weeks building custom verification systems.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* Section 3: Pain Points Grid */}
      <section className="grid-bg border-b border-surface-200">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-surface-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {PAIN_POINTS.map((point, i) => (
            <ScrollReveal key={point.title} delay={i * 100}>
              <div className="px-6 py-8">
                <point.icon className="mb-4 h-6 w-6 text-surface-400" strokeWidth={1.5} />
                <h3 className="mb-2 text-sm font-semibold leading-snug text-surface-900">{point.title}</h3>
                <p className="text-sm leading-relaxed text-surface-500">{point.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Section 4: Solution — "Finally, verification that just works" */}
      <section className="border-b border-surface-200 py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <ScrollReveal direction="none">
            <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center">
              <div className="relative flex h-full w-full items-center justify-center">
                {/* Concentric circles */}
                <div className="absolute inset-0 m-auto h-32 w-32 rounded-full border border-brand-200/50" />
                <div className="absolute inset-0 m-auto h-24 w-24 rounded-full border border-brand-300/40" />
                <div className="absolute inset-0 m-auto h-16 w-16 rounded-full border border-brand-400/30" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-500">
                  <Image src="/logo2.png" alt="Attestify" width={36} height={36} className="h-7 w-7 object-contain brightness-0 invert" />
                </div>
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-surface-900 sm:text-5xl">
              Finally, verification<br />that just works
            </h2>
            <p className="mt-4 text-base text-surface-500">
              Attestify removes the complexity.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 5: Schema-based verification */}
      <section className="grid-bg border-b border-surface-200 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <ScrollReveal>
            <h2 className="font-display mb-4 text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl">
              Schema-based verification
            </h2>
            <div className="mb-8 flex flex-wrap items-center justify-center gap-6">
              <span className="flex items-center gap-1.5 text-sm text-surface-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> No Solidity expertise required
              </span>
              <span className="flex items-center gap-1.5 text-sm text-surface-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Built natively on Hedera
              </span>
              <span className="flex items-center gap-1.5 text-sm text-surface-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Automatic upgrades and security
              </span>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <CodeExample code={SCHEMA_CODE} title="Schema Definition" language="json" />
          </ScrollReveal>
        </div>
      </section>

      {/* Section 6: One-line verification everywhere */}
      <section className="grid-bg border-b border-surface-200 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <ScrollReveal>
            <h2 className="font-display mb-10 text-center text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl">
              One-line verification everywhere
            </h2>
          </ScrollReveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {CODE_EXAMPLES.map((ex, i) => (
              <ScrollReveal key={ex.label} delay={i * 120}>
                <div className="rounded-md border border-surface-200 bg-white p-5">
                  <div className="mb-4">
                    <span className={`bracket-label bracket-label-bottom font-mono ${ex.color}`}>
                      {ex.label}
                    </span>
                  </div>
                  <pre className="overflow-x-auto">
                    <code className="font-mono text-xs leading-relaxed text-surface-700">{ex.code}</code>
                  </pre>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Section 7: How it works */}
      <section className="border-b border-surface-200 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-12 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">
                  How it works
                </h2>
                <p className="mt-3 text-base leading-relaxed text-surface-500">
                  Attestify eliminates blockchain complexity with schema-based verification on Hedera.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={150}>
              <HowItWorksStepper steps={HOW_IT_WORKS} />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Section 8: Real use cases */}
      <UseCasesScroller />

      {/* Section 9: Security */}
      <section className="border-b border-surface-200 py-20">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl px-4 text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center">
              <div className="relative flex h-full w-full items-center justify-center">
                <div className="absolute h-24 w-24 rounded-full border border-brand-200/40" />
                <div className="absolute h-16 w-16 rounded-full border border-brand-300/30" />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
              </div>
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">
              Security that never sleeps
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-surface-500">
              Built for trust. Engineered for safety. Attestify is built with Hedera&apos;s enterprise-grade security, multi-layered safeguards, and robust infrastructure.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              <span className="flex items-center gap-1.5 text-sm text-surface-600">
                <Shield className="h-4 w-4 text-surface-400" /> Hedera aBFT consensus
              </span>
              <span className="flex items-center gap-1.5 text-sm text-surface-600">
                <Shield className="h-4 w-4 text-surface-400" /> Immutable audit trail
              </span>
              <span className="flex items-center gap-1.5 text-sm text-surface-600">
                <Shield className="h-4 w-4 text-surface-400" /> On-chain verification
              </span>
              <span className="flex items-center gap-1.5 text-sm text-surface-600">
                <Shield className="h-4 w-4 text-surface-400" /> Deterministic UIDs
              </span>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Section 10: For developers / For business teams */}
      <section className="grid-bg border-b border-surface-200 py-16">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-2">
          {/* For developers */}
          <ScrollReveal direction="left">
            <div className="rounded-md border border-surface-200 bg-white p-6">
            <div className="mb-4">
              <span className="bracket-label bracket-label-bottom font-mono text-surface-500">
                SCHEMA-BASED ATTESTATION
              </span>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-surface-900">For developers</h3>
            <p className="mb-4 text-sm text-surface-500">
              Stop building custom verification systems. Use our battle-tested infrastructure.
            </p>
            <div className="overflow-hidden rounded-md border border-surface-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="px-3 py-2 font-medium text-surface-500">#</th>
                    <th className="px-3 py-2 font-medium text-surface-500">UID</th>
                    <th className="px-3 py-2 font-medium text-surface-500">STATUS</th>
                    <th className="px-3 py-2 font-medium text-surface-500">AGE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-surface-100">
                    <td className="px-3 py-2"><span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-mono text-green-700">#10</span></td>
                    <td className="px-3 py-2 font-mono text-surface-700">VLMZC9JX4...</td>
                    <td className="px-3 py-2"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active</span></td>
                    <td className="px-3 py-2 text-surface-500">Just now</td>
                  </tr>
                  <tr className="border-b border-surface-100">
                    <td className="px-3 py-2"><span className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-mono text-surface-600">#7</span></td>
                    <td className="px-3 py-2 font-mono text-surface-700">GCFXHS4GXL...</td>
                    <td className="px-3 py-2"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active</span></td>
                    <td className="px-3 py-2 text-surface-500">2 hours ago</td>
                  </tr>
                  <tr className="border-b border-surface-100">
                    <td className="px-3 py-2"><span className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-mono text-surface-600">#7</span></td>
                    <td className="px-3 py-2 font-mono text-surface-700">GCFXHS4GXL...</td>
                    <td className="px-3 py-2"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-yellow-500" /> Expired</span></td>
                    <td className="px-3 py-2 text-surface-500">2 hours ago</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </ScrollReveal>

          {/* For business teams */}
          <ScrollReveal direction="right" delay={150}>
          <div className="rounded-md border border-surface-200 bg-white p-6">
            <div className="mb-4">
              <span className="bracket-label bracket-label-bottom font-mono text-surface-500">
                ONE-LINE VERIFICATION
              </span>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-surface-900">For business teams</h3>
            <p className="mb-4 text-sm text-surface-500">
              Add trust signals to your product today. No blockchain expertise required.
            </p>
            <div className="rounded-md border border-surface-200 bg-surface-50">
              <div className="flex items-center border-b border-surface-200 px-4 py-2">
                <span className="flex items-center gap-2 text-xs text-surface-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                  Check any attestation status in one call
 
                </span>
              </div>
              <pre className="overflow-x-auto p-4">
                <code className="font-mono text-xs leading-relaxed text-surface-700">
{`// Fetch attestation and check status
`}<span className="text-blue-600">const</span>{` { data } =
  `}<span className="text-blue-600">await</span>{` service.`}<span className="text-purple-600">getAttestation</span>{`(uid);

`}<span className="text-blue-600">const</span>{` status = data.`}<span className="font-semibold">revoked</span>
{`  ? '`}<span className="text-red-500">Revoked</span>{`'
  : '`}<span className="text-green-600">Active</span>{`';`}
                </code>
              </pre>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 11: Bottom CTA + Stats */}
      <section className="border-b border-surface-200 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-12 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div>
                <h2 className="text-3xl font-bold leading-tight tracking-tight text-surface-900 sm:text-4xl">
                  Stop building<br />verification systems.<br />
                  <span className="text-brand-500">Start building trust.</span>
                </h2>
                <p className="mt-4 text-base text-surface-500">
                  The blockchain economy runs on trust. Attestify makes that trust simple, portable, and universal.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={150}>
              <div>
              <CodeExample
                code={`import { HederaAttestService } from '@attestify/sdk';

const service = new HederaAttestService({
  network: 'testnet',
  operatorAccountId: '0.0.12345',
  operatorPrivateKey: '0x...',
  contractAddresses: {
    schemaRegistry: '0x8320...2e80',
    attestationService: '0xce57...4331',
  },
});`}
                title="quick-start.ts"
              />
              <div className="mt-3 flex items-center justify-between rounded-md border border-surface-200 bg-white px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-surface-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                  npm install @attestify/sdk
                </span>
                <Link
                  href="/sandbox"
                  className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
                >
                  Start building
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Stats */}
      <ScrollReveal>
        <StatsSection />
      </ScrollReveal>
    </>
  );
}
