import { Hero } from '@/components/marketing/Hero';
import { FeatureCard } from '@/components/marketing/FeatureCard';
import { CodeExample } from '@/components/marketing/CodeExample';
import { FileCode2, FilePlus2, XCircle, UserCheck, Search, ShieldCheck, Cpu } from 'lucide-react';

const SANDBOX_CODE = `import { HederaAttestService, SchemaEncoder } from '@attestify/sdk';

const service = new HederaAttestService({
  network: 'testnet',
  contractAddresses: {
    schemaRegistry: '0x8320...2e80',
    attestationService: '0xce57...4331',
  },
});

// Register a schema
const { data: schema } = await service.registerSchema({
  definition: 'string name, uint8 level, bool verified',
  revocable: true,
});

// Create an attestation
const encoder = new SchemaEncoder(schema.definition);
const { data } = await service.createAttestation({
  schemaUid: schema.schemaUid,
  subject: '0x1234...5678',
  data: encoder.encode({ name: 'Alice', level: 2, verified: true }),
});
console.log('Attestation UID:', data.attestationUid);`;

const WORKFLOWS = [
  {
    icon: FileCode2,
    title: 'Schema Deployer',
    description: 'Define schema fields visually and register them on-chain via the SchemaRegistry contract.',
  },
  {
    icon: FilePlus2,
    title: 'Attestation Workflow',
    description: 'Complete attestation lifecycle — pick a schema, encode data, and submit to the AttestationService.',
  },
  {
    icon: XCircle,
    title: 'Revoke Attestation',
    description: 'Revoke any attestation you issued. The on-chain record is updated instantly.',
  },
  {
    icon: UserCheck,
    title: 'Register Authority',
    description: 'Register as a trusted authority for a schema. Authorities add credibility to attestations.',
  },
  {
    icon: Search,
    title: 'Universal Search',
    description: 'Search attestations, schemas, and authorities by UID or address across the network.',
  },
  {
    icon: Cpu,
    title: 'Live on Testnet',
    description: 'Every workflow connects to real smart contracts deployed on Hedera Testnet. No mocks.',
  },
];

export default function SandboxPage() {
  return (
    <>
      <Hero
        title="Try the protocol. No setup required."
        subtitle="Sandbox"
        description="The Attestify Sandbox is a guided, interactive environment where you can deploy schemas, create attestations, and query the network — all connected to live contracts on Hedera Testnet."
        primaryCta={{ label: 'Launch Sandbox', href: '/sandbox/app' }}
        secondaryCta={{ label: 'Read the Docs', href: '/docs' }}
      />

      {/* What you can do */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <p className="mb-2 font-mono text-sm text-brand-500">Available Workflows</p>
        <h2 className="mb-8 text-2xl font-bold tracking-tight text-surface-900">
          Everything you need to explore the protocol
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKFLOWS.map((w) => (
            <FeatureCard key={w.title} icon={w.icon} title={w.title} description={w.description} />
          ))}
        </div>
      </section>

      {/* Code example */}
      <section className="border-y border-surface-200 bg-surface-50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <p className="mb-2 font-mono text-sm text-brand-500">Under the Hood</p>
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-surface-900">
            What the sandbox does for you, in code
          </h2>
          <CodeExample code={SANDBOX_CODE} title="sandbox-workflow.ts" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-surface-900">Connected to Real Contracts</h3>
            <p className="text-sm leading-relaxed text-surface-500">
              The sandbox isn&apos;t a simulation. Every transaction goes through the SchemaRegistry and
              AttestationService contracts deployed on Hedera Testnet. You&apos;re interacting with the
              same infrastructure that production apps use.
            </p>
          </div>
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-surface-900">Wallet-Connected Workflows</h3>
            <p className="text-sm leading-relaxed text-surface-500">
              Connect MetaMask, switch to Hedera Testnet (Chain ID 296), and get testnet HBAR from the
              faucet. Each workflow guides you step-by-step through the transaction process.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
