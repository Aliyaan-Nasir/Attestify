'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CodeExample } from '@/components/marketing/CodeExample';

interface UseCase {
  id: string;
  label: string;
  title: string;
  description: string;
  code: string;
  codeFile: string;
  impact: string;
}

const USE_CASES: UseCase[] = [
  {
    id: 'kyc',
    label: 'KYC Verification',
    title: 'On-chain KYC for DeFi protocols',
    description:
      'Issue verifiable identity attestations. DeFi protocols check KYC status on-chain before granting access.',
    code: `import { HederaAttestService, SchemaEncoder } from '@attestify/sdk';

// Register a KYC schema
const { data: schema } = await service.registerSchema({
  definition: 'string name, uint8 level, bool verified',
  revocable: true,
});

// Encode and attest KYC status
const encoder = new SchemaEncoder(
  'string name, uint8 level, bool verified'
);
const { data } = await service.createAttestation({
  schemaUid: schema.schemaUid,
  subject: userAddress,
  data: encoder.encode({
    name: 'Jane Doe',
    level: 2,
    verified: true,
  }),
});
console.log('KYC Attestation:', data.attestationUid);`,
    codeFile: 'kyc-attestation.ts',
    impact: 'Eliminate redundant KYC across DeFi. One attestation, verified everywhere.',
  },
  {
    id: 'github',
    label: 'Developer Reputation',
    title: 'GitHub contribution proof for Web3 teams',
    description:
      'Attest developer contributions on-chain. Hiring teams verify technical credibility without resumes.',
    code: `// Register a contributor schema
const { data: schema } = await service.registerSchema({
  definition: 'string repo, string role, uint256 commits',
  revocable: false,
});

// Attest a developer's contributions
const encoder = new SchemaEncoder(
  'string repo, string role, uint256 commits'
);
const { data } = await service.createAttestation({
  schemaUid: schema.schemaUid,
  subject: developerAddress,
  data: encoder.encode({
    repo: 'hashgraph/hedera-services',
    role: 'core-contributor',
    commits: 142,
  }),
});
console.log('Reputation:', data.attestationUid);`,
    codeFile: 'contributor-attestation.ts',
    impact: '75% faster technical hiring. Verifiable on-chain developer CVs.',
  },
  {
    id: 'asset',
    label: 'Asset Certification',
    title: 'Tokenized asset provenance on Hedera',
    description:
      'Certify real-world asset ownership and provenance. Attestations link physical assets to on-chain records.',
    code: `// Register an asset certification schema
const { data: schema } = await service.registerSchema({
  definition: 'string assetId, string certifier, uint64 certifiedAt',
  revocable: true,
});

// Certify an asset
const encoder = new SchemaEncoder(
  'string assetId, string certifier, uint64 certifiedAt'
);
const { data } = await service.createAttestation({
  schemaUid: schema.schemaUid,
  subject: assetTokenAddress,
  data: encoder.encode({
    assetId: 'PROP-2024-00142',
    certifier: 'Hedera Title Authority',
    certifiedAt: Math.floor(Date.now() / 1000),
  }),
});
console.log('Certified:', data.attestationUid);`,
    codeFile: 'asset-certification.ts',
    impact: 'Immutable provenance chain. Instant verification for auditors and buyers.',
  },
  {
    id: 'dao',
    label: 'DAO Governance',
    title: 'Attest voting eligibility and delegation',
    description:
      'DAO members receive attestations proving membership and voting rights. Smart contracts verify before allowing votes.',
    code: `// Register a DAO membership schema
const { data: schema } = await service.registerSchema({
  definition: 'string dao, string role, bool canVote',
  revocable: true,
});

// Attest DAO membership
const encoder = new SchemaEncoder(
  'string dao, string role, bool canVote'
);
const { data } = await service.createAttestation({
  schemaUid: schema.schemaUid,
  subject: memberAddress,
  data: encoder.encode({
    dao: 'Hedera Builders DAO',
    role: 'core-member',
    canVote: true,
  }),
});
console.log('Membership:', data.attestationUid);

// Revoke if member leaves
await service.revokeAttestation(data.attestationUid);`,
    codeFile: 'dao-membership.ts',
    impact: 'On-chain governance with revocable membership. No more Snapshot workarounds.',
  },
  {
    id: 'event',
    label: 'Event Attendance',
    title: 'Verifiable event credentials on Hedera',
    description:
      'Issue attendance attestations at conferences and hackathons. Attendees carry proof in their wallet forever.',
    code: `// Register an event attendance schema
const { data: schema } = await service.registerSchema({
  definition: 'string event, string location, uint64 date',
  revocable: false,
});

// Attest attendance
const encoder = new SchemaEncoder(
  'string event, string location, uint64 date'
);
const { data } = await service.createAttestation({
  schemaUid: schema.schemaUid,
  subject: attendeeAddress,
  data: encoder.encode({
    event: 'Hedera Apex Hackathon 2025',
    location: 'Virtual',
    date: Math.floor(Date.now() / 1000),
  }),
  expirationTime: 0, // never expires
});
console.log('Attendance:', data.attestationUid);`,
    codeFile: 'event-attendance.ts',
    impact: 'Permanent, verifiable proof of participation. No PDFs, no emails.',
  },
];

export function UseCasesScroller() {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const lockedRef = useRef(false);
  const cooldownRef = useRef(false);
  const accumulatedDelta = useRef(0);
  const lockedScrollY = useRef(0);
  const SCROLL_THRESHOLD = 150;

  // Check if section is fully visible in viewport
  const isSectionInView = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    // Section top is at or above viewport top, and bottom is at or below viewport bottom
    return rect.top <= 1 && rect.bottom >= window.innerHeight - 1;
  }, []);

  // Scroll the section into full view and lock
  const scrollToSection = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    lockedRef.current = true;
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const el = sectionRef.current;
      if (!el) return;
      if (cooldownRef.current) return;

      const rect = el.getBoundingClientRect();

      // Only engage once the section's top has scrolled to the top of the viewport
      const topReached = rect.top <= 5 && rect.top >= -50;

      if (!lockedRef.current) {
        if (!topReached) return;
        lockedRef.current = true;
        lockedScrollY.current = window.scrollY;
      }

      const scrollingDown = e.deltaY > 0;
      const scrollingUp = e.deltaY < 0;

      // If at last item and scrolling down, release lock and let page scroll
      if (scrollingDown && active >= USE_CASES.length - 1) {
        lockedRef.current = false;
        accumulatedDelta.current = 0;
        return; // don't prevent default — let page scroll naturally
      }

      // If at first item and scrolling up, release lock and let page scroll
      if (scrollingUp && active <= 0) {
        lockedRef.current = false;
        accumulatedDelta.current = 0;
        return;
      }

      // Consume the scroll — prevent page from moving
      e.preventDefault();

      // Accumulate scroll delta
      accumulatedDelta.current += e.deltaY;

      // Only switch when accumulated scroll exceeds threshold
      if (Math.abs(accumulatedDelta.current) < SCROLL_THRESHOLD) return;
      if (cooldownRef.current) return;

      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 600);

      if (accumulatedDelta.current > 0) {
        setActive((prev) => Math.min(USE_CASES.length - 1, prev + 1));
      } else {
        setActive((prev) => Math.max(0, prev - 1));
      }
      accumulatedDelta.current = 0;
    };

    // Re-lock when scrolling back into the section
    const handleScroll = () => {
      const el = sectionRef.current;
      if (!el) return;

      // While locked, force scroll position to stay put
      if (lockedRef.current) {
        if (Math.abs(window.scrollY - lockedScrollY.current) > 1) {
          window.scrollTo(0, lockedScrollY.current);
        }
        return;
      }

      const rect = el.getBoundingClientRect();
      // Re-lock when section top is near viewport top
      const topAligned = rect.top >= -5 && rect.top <= 5;
      if (topAligned && active > 0 && active < USE_CASES.length - 1) {
        lockedRef.current = true;
        lockedScrollY.current = window.scrollY;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [active, isSectionInView, scrollToSection]);

  const uc = USE_CASES[active];

  return (
    <section ref={sectionRef} className="border-b border-surface-200 py-16" style={{ overscrollBehavior: 'none' }}>
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Left: heading + clickable labels + impact */}
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">
              Real use cases,<br />real results
            </h2>
            <p className="mt-3 text-base leading-relaxed text-surface-500">
              See how teams use Attestify to build trust into their products on Hedera.
            </p>

            {/* Progress bar */}
            <div className="mt-6 h-0.5 w-full rounded-full bg-surface-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${((active + 1) / USE_CASES.length) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-surface-400">
              {active + 1} / {USE_CASES.length} — scroll to explore
            </p>

            <div className="mt-6 space-y-1">
              {USE_CASES.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setActive(i)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <div
                    className={`h-8 w-1 rounded-full transition-colors ${
                      i === active ? 'bg-brand-500' : 'bg-surface-200'
                    }`}
                  />
                  <span
                    className={`text-sm transition-colors ${
                      i === active
                        ? 'font-semibold text-surface-900'
                        : 'text-surface-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Business Impact — on the left so it's always visible */}
            <div className="mt-6 rounded-md border border-green-100 bg-green-50 px-4 py-3">
              <p className="text-xs font-medium text-green-600">Business Impact</p>
              <p className="mt-0.5 text-sm text-green-700">{uc.impact}</p>
            </div>
          </div>

          {/* Right: code block that changes with active use case */}
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-surface-900">{uc.title}</h3>
              <p className="mt-1 text-sm text-surface-500">{uc.description}</p>
            </div>
            <CodeExample code={uc.code} title={uc.codeFile} />
          </div>
        </div>
      </div>
    </section>
  );
}
