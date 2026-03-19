import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

// Mock the indexer API for StatsSection
vi.mock('@/lib/api', () => ({
  indexerApi: {
    getSchemas: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { total: 42, limit: 1, offset: 0, hasMore: true } }),
    getAttestations: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { total: 128, limit: 1, offset: 0, hasMore: true } }),
    getAuthorities: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { total: 7, limit: 1, offset: 0, hasMore: true } }),
  },
}));

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', async () => {
  const iconNames = [
    'ArrowRight', 'Shield', 'FileCode2', 'Fingerprint', 'Zap', 'Lock', 'Globe',
    'CheckCircle2', 'Layers', 'RefreshCw', 'Puzzle', 'ShieldCheck', 'KeyRound',
    'Vote', 'Landmark', 'Star', 'Cpu', 'Database', 'Clock', 'FilePlus2',
    'XCircle', 'UserCheck', 'Search', 'Menu', 'X', 'ExternalLink', 'Wallet', 'LogOut', 'AlertTriangle',
    'Timer', 'Link2', 'Users', 'ArrowLeft', 'Home', 'Wallet',
  ];
  const mocks: Record<string, unknown> = {};
  for (const name of iconNames) {
    mocks[name] = (props: Record<string, unknown>) => React.createElement('span', { 'data-icon': name, ...props });
  }
  return mocks;
});

// Import pages after mocks
import HomePage from '@/app/page';
import SchemaProductPage from '@/app/(marketing)/products/schema/page';
import AttestationProductPage from '@/app/(marketing)/products/attestation/page';
import AboutPage from '@/app/(marketing)/about/page';
import SandboxOverviewPage from '@/app/(sandbox)/sandbox/app/page';

// Import components
import { Hero } from '@/components/marketing/Hero';
import { FeatureCard } from '@/components/marketing/FeatureCard';
import { CodeExample } from '@/components/marketing/CodeExample';
import { StatsSection } from '@/components/marketing/StatsSection';

describe('Marketing Components', () => {
  describe('Hero', () => {
    it('renders title and subtitle', () => {
      render(<Hero title="Test Title" subtitle="Test Subtitle" />);
      expect(screen.getByText('Test Title')).toBeDefined();
      expect(screen.getByText('Test Subtitle')).toBeDefined();
    });

    it('renders description when provided', () => {
      render(<Hero title="T" subtitle="S" description="A description" />);
      expect(screen.getByText('A description')).toBeDefined();
    });

    it('renders CTAs when provided', () => {
      render(
        <Hero
          title="T"
          subtitle="S"
          primaryCta={{ label: 'Primary', href: '/primary' }}
          secondaryCta={{ label: 'Secondary', href: '/secondary' }}
        />,
      );
      const primary = screen.getByText('Primary');
      expect(primary.closest('a')).toBeDefined();
      expect(primary.closest('a')?.getAttribute('href')).toBe('/primary');
      const secondary = screen.getByText('Secondary');
      expect(secondary.closest('a')?.getAttribute('href')).toBe('/secondary');
    });
  });

  describe('FeatureCard', () => {
    it('renders title and description', () => {
      const MockIcon = (props: Record<string, unknown>) => React.createElement('span', props);
      render(<FeatureCard icon={MockIcon as never} title="Feature" description="Description" />);
      expect(screen.getByText('Feature')).toBeDefined();
      expect(screen.getByText('Description')).toBeDefined();
    });
  });

  describe('CodeExample', () => {
    it('renders code content', () => {
      render(<CodeExample code="const x = 1;" title="test.ts" />);
      expect(screen.getByText('const x = 1;')).toBeDefined();
      expect(screen.getByText('test.ts')).toBeDefined();
    });

    it('renders language label', () => {
      render(<CodeExample code="code" language="typescript" title="file.ts" />);
      expect(screen.getByText('typescript')).toBeDefined();
    });
  });

  describe('StatsSection', () => {
    it('renders stat labels', async () => {
      render(<StatsSection />);
      expect(screen.getByText('Schemas Registered')).toBeDefined();
      expect(screen.getByText('Attestations Issued')).toBeDefined();
      expect(screen.getByText('Authorities')).toBeDefined();
    });

    it('fetches and displays live stats', async () => {
      render(<StatsSection />);
      // Wait for async fetch
      await vi.waitFor(() => {
        expect(screen.getByText('42')).toBeDefined();
      });
      expect(screen.getByText('128')).toBeDefined();
      expect(screen.getByText('7')).toBeDefined();
    });

    it('handles API errors gracefully', async () => {
      const { indexerApi } = await import('@/lib/api');
      vi.mocked(indexerApi.getSchemas).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(indexerApi.getAttestations).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(indexerApi.getAuthorities).mockRejectedValueOnce(new Error('Network error'));

      render(<StatsSection />);
      // Should still render labels even on error
      await vi.waitFor(() => {
        expect(screen.getByText('Schemas Registered')).toBeDefined();
      });
    });
  });
});

describe('Marketing Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Homepage', () => {
    it('renders hero section with tagline', () => {
      render(<HomePage />);
      expect(screen.getByText('HEDERA-NATIVE ATTESTATIONS')).toBeDefined();
      expect(screen.getByText(/On-chain proof, no/)).toBeDefined();
    });

    it('renders Start building CTA linking to /sandbox', () => {
      render(<HomePage />);
      const ctas = screen.getAllByText('Start building');
      expect(ctas[0].closest('a')?.getAttribute('href')).toBe('/sandbox');
    });

    it('renders problem statement section', () => {
      render(<HomePage />);
      expect(screen.getByText(/The onchain identity/)).toBeDefined();
    });

    it('renders pain points', () => {
      render(<HomePage />);
      expect(screen.getByText('Smart contracts require deep Solidity expertise')).toBeDefined();
      expect(screen.getByText(/Enterprise teams/)).toBeDefined();
    });

    it('renders how it works section', () => {
      render(<HomePage />);
      expect(screen.getByText('How it works')).toBeDefined();
      expect(screen.getByText('Schema-based, not contract-based')).toBeDefined();
    });

    it('renders use cases section', () => {
      render(<HomePage />);
      expect(screen.getByText(/Real use cases/)).toBeDefined();
      expect(screen.getByText('KYC Verification')).toBeDefined();
      expect(screen.getByText('Developer Reputation')).toBeDefined();
    });

    it('renders quick start code example', () => {
      render(<HomePage />);
      const codeBlocks = screen.getAllByText('quick-start.ts');
      expect(codeBlocks.length).toBeGreaterThan(0);
    });

    it('renders bottom CTA section', () => {
      render(<HomePage />);
      expect(screen.getAllByText(/Stop building/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Start building trust/)).toBeDefined();
    });
  });

  describe('Schema Product Page', () => {
    it('renders hero with title', () => {
      render(<SchemaProductPage />);
      expect(screen.getByText('Reusable Proof Templates')).toBeDefined();
    });

    it('renders how schemas work steps', () => {
      render(<SchemaProductPage />);
      expect(screen.getByText('Define Your Schema')).toBeDefined();
      expect(screen.getByText('Register On-Chain')).toBeDefined();
      expect(screen.getByText('Issue Attestations')).toBeDefined();
    });

    it('renders code example', () => {
      render(<SchemaProductPage />);
      expect(screen.getByText('register-schema.ts')).toBeDefined();
    });

    it('renders building blocks section', () => {
      render(<SchemaProductPage />);
      expect(screen.getByText('Consistency')).toBeDefined();
      expect(screen.getByText('Interoperability')).toBeDefined();
      expect(screen.getByText('Reusability')).toBeDefined();
      expect(screen.getByText('Trust')).toBeDefined();
    });

    it('renders FAQ section', () => {
      render(<SchemaProductPage />);
      expect(screen.getByText('What types are supported in schema definitions?')).toBeDefined();
      expect(screen.getByText('How are Schema UIDs computed?')).toBeDefined();
    });

    it('has CTA to explore schemas', () => {
      render(<SchemaProductPage />);
      const cta = screen.getByText('Explore Schemas');
      expect(cta.closest('a')?.getAttribute('href')).toBe('/schemas');
    });

    it('has CTA to schema builder', () => {
      render(<SchemaProductPage />);
      const cta = screen.getByText('Try Schema Builder');
      expect(cta.closest('a')?.getAttribute('href')).toBe('/sandbox/app/schema-builder');
    });
  });

  describe('Attestation Product Page', () => {
    it('renders hero with title', () => {
      render(<AttestationProductPage />);
      expect(screen.getByText(/The Internet has URLs/)).toBeDefined();
    });

    it('renders attestation JSON example', () => {
      render(<AttestationProductPage />);
      expect(screen.getByText('attestation-record.json')).toBeDefined();
    });

    it('renders developer code example', () => {
      render(<AttestationProductPage />);
      expect(screen.getByText('attestation-lifecycle.ts')).toBeDefined();
    });

    it('renders use cases', () => {
      render(<AttestationProductPage />);
      expect(screen.getByText('Token Gates')).toBeDefined();
      expect(screen.getByText('DAO Voting')).toBeDefined();
      expect(screen.getByText('DeFi Credit Limits')).toBeDefined();
      expect(screen.getByText('Reputation')).toBeDefined();
    });

    it('renders comparison table', () => {
      render(<AttestationProductPage />);
      expect(screen.getByText('Attestations vs alternatives')).toBeDefined();
      expect(screen.getByText('On-chain verifiable')).toBeDefined();
    });

    it('has CTA to explore attestations', () => {
      render(<AttestationProductPage />);
      const cta = screen.getByText('Explore Attestations');
      expect(cta.closest('a')?.getAttribute('href')).toBe('/attestations');
    });

    it('has CTA to create attestation', () => {
      render(<AttestationProductPage />);
      const cta = screen.getByText('Create Attestation');
      expect(cta.closest('a')?.getAttribute('href')).toBe('/sandbox/app/create-attestation');
    });
  });

  describe('About Page', () => {
    it('renders hero with mission', () => {
      render(<AboutPage />);
      expect(screen.getByText('Making trust as simple as sending tokens')).toBeDefined();
    });

    it('renders why Hedera section', () => {
      render(<AboutPage />);
      expect(screen.getByText('Why Hedera')).toBeDefined();
      expect(screen.getByText('Sub-Second Finality')).toBeDefined();
      expect(screen.getByText('Mirror Node Indexing')).toBeDefined();
    });

    it('renders architecture section', () => {
      render(<AboutPage />);
      expect(screen.getByText('Built different')).toBeDefined();
      expect(screen.getByText('Smart Contracts (HSCS)')).toBeDefined();
      expect(screen.getByText('TypeScript SDK')).toBeDefined();
    });

    it('renders roadmap', () => {
      render(<AboutPage />);
      expect(screen.getByText('Core Protocol')).toBeDefined();
      expect(screen.getByText('Frontend & Sandbox')).toBeDefined();
      expect(screen.getByText('Mainnet Launch')).toBeDefined();
    });

    it('renders team section', () => {
      render(<AboutPage />);
      expect(screen.getByText('Built for the Hedera Apex Hackathon')).toBeDefined();
    });
  });

  describe('Sandbox Overview Page', () => {
    it('renders header with testnet badge', () => {
      render(<SandboxOverviewPage />);
      expect(screen.getByText('Interactive Demo Environment')).toBeDefined();
      expect(screen.getByText('Live on Testnet')).toBeDefined();
    });

    it('renders all sandbox tools', () => {
      render(<SandboxOverviewPage />);
      expect(screen.getByText('Schema Deployer')).toBeDefined();
      expect(screen.getByText('Attestation Workflow')).toBeDefined();
      expect(screen.getByText('Revoke Attestation')).toBeDefined();
      expect(screen.getByText('Register Authority')).toBeDefined();
      expect(screen.getByText('Universal Search')).toBeDefined();
    });

    it('links to correct sandbox tool pages', () => {
      render(<SandboxOverviewPage />);
      const links = screen.getAllByRole('link');
      const hrefs = links.map((l) => l.getAttribute('href'));
      expect(hrefs).toContain('/sandbox/app/schema-builder');
      expect(hrefs).toContain('/sandbox/app/create-attestation');
      expect(hrefs).toContain('/sandbox/app/revoke');
      expect(hrefs).toContain('/sandbox/app/register-authority');
      expect(hrefs).toContain('/sandbox/app/search');
    });

    it('renders getting started section', () => {
      render(<SandboxOverviewPage />);
      expect(screen.getByText('Connect MetaMask')).toBeDefined();
      expect(screen.getByText('Get Testnet HBAR')).toBeDefined();
      expect(screen.getByText('Pick a Workflow')).toBeDefined();
    });

    it('renders core workflows section', () => {
      render(<SandboxOverviewPage />);
      expect(screen.getByText('Core Workflows')).toBeDefined();
      expect(screen.getByText('Retrieval Flows')).toBeDefined();
    });
  });
});
