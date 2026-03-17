import { Hero } from '@/components/marketing/Hero';
import { FeatureCard } from '@/components/marketing/FeatureCard';
import { CodeExample } from '@/components/marketing/CodeExample';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Layers, RefreshCw, Puzzle, ShieldCheck } from 'lucide-react';

const SCHEMA_CODE = `import { HederaAttestService } from '@attestify/sdk';

const service = new HederaAttestService({
  network: 'testnet',
  operatorAccountId: '0.0.12345',
  operatorPrivateKey: '0x...',
  contractAddresses: {
    schemaRegistry: '0x8320...2e80',
    attestationService: '0xce57...4331',
  },
});

// Register a KYC verification schema
const { data } = await service.registerSchema({
  definition: 'string name, uint8 level, bool verified',
  revocable: true,
});

console.log('Schema UID:', data.schemaUid);`;

const STEPS = [
  {
    step: '01',
    title: 'Define Your Schema',
    description:
      'Specify field names and Solidity ABI types. Schemas are human-readable and machine-parseable.',
  },
  {
    step: '02',
    title: 'Register On-Chain',
    description:
      'Submit the schema to the SchemaRegistry contract. A deterministic UID is computed from the definition.',
  },
  {
    step: '03',
    title: 'Issue Attestations',
    description:
      'Use the schema UID to create attestations. Data is ABI-encoded against the schema definition.',
  },
];

const BUILDING_BLOCKS = [
  {
    icon: Layers,
    title: 'Consistency',
    description: 'Schemas enforce uniform data structures across all attestations of the same type.',
  },
  {
    icon: Puzzle,
    title: 'Interoperability',
    description: 'Shared schemas enable different applications to issue and verify compatible attestations.',
  },
  {
    icon: RefreshCw,
    title: 'Reusability',
    description: 'Register once, use everywhere. Any attester can issue attestations against a public schema.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust',
    description: 'Resolver contracts attach custom validation logic — whitelist, token gate, or fee collection.',
  },
];

const SCHEMA_DEFINITION_EXAMPLE = `// Schema definition syntax
// Comma-separated Solidity ABI type + field name pairs

"string name, uint8 level, bool verified"
"address recipient, uint256 amount, bytes32 reference"
"string degree, string institution, uint64 graduationDate"`;

const FAQ = [
  {
    q: 'What types are supported in schema definitions?',
    a: 'All Solidity ABI types: uint8–uint256, int8–int256, address, bool, string, bytes, bytesN, and their array variants.',
  },
  {
    q: 'Can I update a schema after registration?',
    a: 'Schemas are immutable once registered. To change a schema, register a new one with the updated definition.',
  },
  {
    q: 'What is a resolver?',
    a: 'A resolver is a smart contract that runs custom validation logic before an attestation is created or revoked. Use it for access control, fee collection, or token gating.',
  },
  {
    q: 'How are Schema UIDs computed?',
    a: 'Schema UIDs are deterministic: keccak256(abi.encode(definition, resolver, revocable)). The same inputs always produce the same UID.',
  },
];

export default function SchemaProductPage() {
  return (
    <>
      <Hero
        title="Reusable Proof Templates"
        subtitle="Products / Schemas"
        description="Schemas define the structure and rules for attestations. Register once, use across any application on Hedera."
        primaryCta={{ label: 'Explore Schemas', href: '/schemas' }}
        secondaryCta={{ label: 'Try Schema Builder', href: '/sandbox/app/schema-builder' }}
      />

      {/* How Schemas Work */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <ScrollReveal>
          <p className="mb-2 font-mono text-sm text-brand-500">How Schemas Work</p>
          <h2 className="mb-8 text-2xl font-bold tracking-tight text-surface-900">
            Three steps to structured attestations
          </h2>
        </ScrollReveal>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <ScrollReveal key={s.step} delay={i * 120}>
              <div>
                <span className="mb-2 block font-mono text-xs text-brand-500">{s.step}</span>
                <h3 className="mb-1 text-sm font-semibold text-surface-900">{s.title}</h3>
                <p className="text-sm leading-relaxed text-surface-500">{s.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Code Example */}
      <section className="border-y border-surface-200 bg-surface-50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <ScrollReveal>
            <p className="mb-2 font-mono text-sm text-brand-500">Quick Integration</p>
            <h2 className="mb-6 text-2xl font-bold tracking-tight text-surface-900">
              Register a schema in a few lines
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <CodeExample code={SCHEMA_CODE} title="register-schema.ts" />
          </ScrollReveal>
        </div>
      </section>

      {/* Schema Definition Syntax */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <ScrollReveal>
          <p className="mb-2 font-mono text-sm text-brand-500">Schema Standards</p>
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-surface-900">
            Definition syntax
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <CodeExample code={SCHEMA_DEFINITION_EXAMPLE} title="schema-definitions.sol" language="solidity" />
        </ScrollReveal>
      </section>

      {/* Building Blocks */}
      <section className="border-y border-surface-200 bg-surface-50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <ScrollReveal>
            <p className="mb-2 font-mono text-sm text-brand-500">Building Blocks of Trust</p>
            <h2 className="mb-8 text-2xl font-bold tracking-tight text-surface-900">
              Why schemas matter
            </h2>
          </ScrollReveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {BUILDING_BLOCKS.map((b, i) => (
              <ScrollReveal key={b.title} delay={i * 100}>
                <FeatureCard icon={b.icon} title={b.title} description={b.description} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <ScrollReveal>
          <p className="mb-2 font-mono text-sm text-brand-500">FAQ</p>
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-surface-900">
            Frequently asked questions
          </h2>
        </ScrollReveal>
        <div className="space-y-4">
          {FAQ.map((item, i) => (
            <ScrollReveal key={item.q} delay={i * 80}>
              <div className="rounded-md border border-surface-200 bg-white p-5">
                <h3 className="mb-1.5 text-sm font-semibold text-surface-900">{item.q}</h3>
                <p className="text-sm leading-relaxed text-surface-500">{item.a}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </>
  );
}
