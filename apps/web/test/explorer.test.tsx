import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

// Mock lucide-react icons
vi.mock('lucide-react', async () => {
  const iconNames = [
    'FileCode2', 'Fingerprint', 'ShieldCheck', 'Loader2', 'ArrowLeft',
    'CheckCircle2', 'XCircle', 'Search', 'ChevronLeft', 'ChevronRight',
    'Clock', 'Hash', 'Database', 'Menu', 'X', 'ArrowRight', 'ExternalLink',
    'Wallet', 'LogOut', 'AlertTriangle', 'Shield', 'Lock', 'Globe',
    'Layers', 'RefreshCw', 'Puzzle', 'KeyRound', 'Vote', 'Landmark',
    'Star', 'Cpu', 'Zap', 'FilePlus2',
  ];
  const mocks: Record<string, unknown> = {};
  for (const name of iconNames) {
    mocks[name] = (props: Record<string, unknown>) => React.createElement('span', { 'data-icon': name, ...props });
  }
  return mocks;
});

// Mock the API — all data must be inline (vi.mock is hoisted)
vi.mock('@/lib/api', () => ({
  indexerApi: {
    getSchemas: vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          uid: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
          definition: 'string name, uint256 age',
          authorityAddress: '0x1234567890abcdef1234567890abcdef12345678',
          resolverAddress: null,
          revocable: true,
          transactionHash: '0xtx1',
          blockNumber: 100,
          consensusTimestamp: '1700000000.000000000',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
    }),
    getSchema: vi.fn().mockResolvedValue({
      success: true,
      data: {
        uid: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        definition: 'string name, uint256 age',
        authorityAddress: '0x1234567890abcdef1234567890abcdef12345678',
        resolverAddress: null,
        revocable: true,
        transactionHash: '0xtx1',
        blockNumber: 100,
        consensusTimestamp: '1700000000.000000000',
        createdAt: '2024-01-01T00:00:00Z',
      },
    }),
    getAttestations: vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          uid: '0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4',
          schemaUid: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
          attesterAddress: '0x1234567890abcdef1234567890abcdef12345678',
          subjectAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
          data: '0x1234',
          nonce: 0,
          transactionHash: '0xtx2',
          blockNumber: 101,
          consensusTimestamp: '1700000001.000000000',
          expirationTime: null,
          revoked: false,
          revocationTime: null,
          revocationTxHash: null,
          createdAt: '2024-01-02T00:00:00Z',
        },
      ],
      pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
    }),
    getAttestation: vi.fn().mockResolvedValue({
      success: true,
      data: {
        uid: '0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4',
        schemaUid: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        attesterAddress: '0x1234567890abcdef1234567890abcdef12345678',
        subjectAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        data: '0x1234',
        nonce: 0,
        transactionHash: '0xtx2',
        blockNumber: 101,
        consensusTimestamp: '1700000001.000000000',
        expirationTime: null,
        revoked: false,
        revocationTime: null,
        revocationTxHash: null,
        createdAt: '2024-01-02T00:00:00Z',
      },
    }),
    getAuthorities: vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          metadata: 'Test Authority',
          isVerified: true,
          transactionHash: '0xtx3',
          blockNumber: 99,
          consensusTimestamp: '1699999999.000000000',
          createdAt: '2023-12-31T00:00:00Z',
        },
      ],
      pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
    }),
    getAuthority: vi.fn().mockResolvedValue({
      success: true,
      data: {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        metadata: 'Test Authority',
        isVerified: true,
        transactionHash: '0xtx3',
        blockNumber: 99,
        consensusTimestamp: '1699999999.000000000',
        createdAt: '2023-12-31T00:00:00Z',
      },
    }),
  },
}));

// Import components after mocks
import { StatusBadge } from '@/components/explorer/StatusBadge';
import { SearchBar } from '@/components/explorer/SearchBar';
import { Pagination } from '@/components/explorer/Pagination';
import { DetailCard } from '@/components/explorer/DetailCard';
import { DataTable } from '@/components/explorer/DataTable';
import { computeAttestationStatus } from '@/lib/attestation-status';
import { truncateHex, formatDate } from '@/lib/format';

// Import pages
import SchemasPage from '@/app/(explorer)/schemas/page';
import AttestationsPage from '@/app/(explorer)/attestations/page';
import AuthoritiesPage from '@/app/(explorer)/authorities/page';
import { indexerApi } from '@/lib/api';

const schemasMockData = {
  success: true,
  data: [
    {
      uid: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
      definition: 'string name, uint256 age',
      authorityAddress: '0x1234567890abcdef1234567890abcdef12345678',
      resolverAddress: null,
      revocable: true,
      transactionHash: '0xtx1',
      blockNumber: 100,
      consensusTimestamp: '1700000000.000000000',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ],
  pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
};

const attestationsMockData = {
  success: true,
  data: [
    {
      uid: '0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4',
      schemaUid: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
      attesterAddress: '0x1234567890abcdef1234567890abcdef12345678',
      subjectAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      data: '0x1234',
      nonce: 0,
      transactionHash: '0xtx2',
      blockNumber: 101,
      consensusTimestamp: '1700000001.000000000',
      expirationTime: null,
      revoked: false,
      revocationTime: null,
      revocationTxHash: null,
      createdAt: '2024-01-02T00:00:00Z',
    },
  ],
  pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
};

const authoritiesMockData = {
  success: true,
  data: [
    {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      metadata: 'Test Authority',
      isVerified: true,
      transactionHash: '0xtx3',
      blockNumber: 99,
      consensusTimestamp: '1699999999.000000000',
      createdAt: '2023-12-31T00:00:00Z',
    },
  ],
  pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
};

describe('Explorer Components', () => {
  describe('StatusBadge', () => {
    it('renders active status with green color', () => {
      const status = computeAttestationStatus(false, null);
      render(<StatusBadge status={status} />);
      expect(screen.getByText('Active')).toBeDefined();
      expect(screen.getByTestId('status-badge-active')).toBeDefined();
    });

    it('renders revoked status with red color', () => {
      const status = computeAttestationStatus(true, null);
      render(<StatusBadge status={status} />);
      expect(screen.getByText('Revoked')).toBeDefined();
      expect(screen.getByTestId('status-badge-revoked')).toBeDefined();
    });

    it('renders expired status with yellow color', () => {
      const status = computeAttestationStatus(false, 1, 1700000000);
      render(<StatusBadge status={status} />);
      expect(screen.getByText('Expired')).toBeDefined();
      expect(screen.getByTestId('status-badge-expired')).toBeDefined();
    });
  });

  describe('SearchBar', () => {
    it('renders with placeholder', () => {
      render(<SearchBar placeholder="Search..." onSearch={() => {}} />);
      expect(screen.getByPlaceholderText('Search...')).toBeDefined();
    });

    it('renders search button', () => {
      render(<SearchBar onSearch={() => {}} />);
      expect(screen.getByText('Search')).toBeDefined();
    });
  });

  describe('Pagination', () => {
    it('renders page info', () => {
      render(<Pagination total={50} limit={20} offset={0} onPageChange={() => {}} />);
      expect(screen.getByText('Showing 1–20 of 50')).toBeDefined();
      expect(screen.getByText('1 / 3')).toBeDefined();
    });

    it('disables previous button on first page', () => {
      render(<Pagination total={50} limit={20} offset={0} onPageChange={() => {}} />);
      const prevBtn = screen.getByLabelText('Previous page');
      expect(prevBtn.hasAttribute('disabled')).toBe(true);
    });

    it('disables next button on last page', () => {
      render(<Pagination total={50} limit={20} offset={40} onPageChange={() => {}} />);
      const nextBtn = screen.getByLabelText('Next page');
      expect(nextBtn.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('DetailCard', () => {
    it('renders title and fields', () => {
      render(
        <DetailCard
          title="Test Card"
          fields={[
            { label: 'Field 1', value: 'Value 1' },
            { label: 'Field 2', value: 'Value 2', mono: true },
          ]}
        />,
      );
      expect(screen.getByText('Test Card')).toBeDefined();
      expect(screen.getByText('Field 1')).toBeDefined();
      expect(screen.getByText('Value 1')).toBeDefined();
      expect(screen.getByText('Field 2')).toBeDefined();
      expect(screen.getByText('Value 2')).toBeDefined();
    });
  });

  describe('DataTable', () => {
    it('renders empty message when no data', () => {
      render(
        <DataTable
          columns={[{ header: 'Name', accessor: (row: { name: string }) => row.name }]}
          data={[]}
          keyExtractor={() => '1'}
          emptyMessage="Nothing here"
        />,
      );
      expect(screen.getByText('Nothing here')).toBeDefined();
    });

    it('renders rows when data provided', () => {
      render(
        <DataTable
          columns={[{ header: 'Name', accessor: (row: { name: string }) => row.name }]}
          data={[{ name: 'Alice' }, { name: 'Bob' }]}
          keyExtractor={(row: { name: string }) => row.name}
        />,
      );
      expect(screen.getByText('Alice')).toBeDefined();
      expect(screen.getByText('Bob')).toBeDefined();
    });
  });
});

describe('Format Utilities', () => {
  it('truncateHex shortens long hex strings', () => {
    const result = truncateHex('0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1');
    expect(result).toContain('...');
    expect(result.length).toBeLessThan(66); // shorter than full hex
    expect(result.startsWith('0xabc123')).toBe(true);
  });

  it('truncateHex returns short strings unchanged', () => {
    expect(truncateHex('0x1234')).toBe('0x1234');
  });

  it('formatDate formats ISO strings', () => {
    const result = formatDate('2024-01-01T00:00:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('Jan');
  });

  it('formatDate returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('Explorer Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(indexerApi.getSchemas).mockResolvedValue(schemasMockData as never);
    vi.mocked(indexerApi.getAttestations).mockResolvedValue(attestationsMockData as never);
    vi.mocked(indexerApi.getAuthorities).mockResolvedValue(authoritiesMockData as never);
  });

  describe('Schemas List Page', () => {
    it('renders page title', async () => {
      render(<SchemasPage />);
      expect(screen.getByText('Schemas')).toBeDefined();
    });

    it('renders search bar', () => {
      render(<SchemasPage />);
      expect(screen.getByTestId('search-input')).toBeDefined();
    });

    it('displays schema data after loading', async () => {
      render(<SchemasPage />);
      await waitFor(() => {
        expect(screen.getByText('string name, uint256 age')).toBeDefined();
      });
    });
  });

  describe('Attestations List Page', () => {
    it('renders page title', () => {
      render(<AttestationsPage />);
      expect(screen.getByText('Attestations')).toBeDefined();
    });

    it('renders search bar', () => {
      render(<AttestationsPage />);
      expect(screen.getByTestId('search-input')).toBeDefined();
    });

    it('displays attestation data after loading', async () => {
      render(<AttestationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Active')).toBeDefined();
      });
    });
  });

  describe('Authorities List Page', () => {
    it('renders page title', () => {
      render(<AuthoritiesPage />);
      expect(screen.getByText('Authorities')).toBeDefined();
    });

    it('renders search bar', () => {
      render(<AuthoritiesPage />);
      expect(screen.getByTestId('search-input')).toBeDefined();
    });

    it('displays authority data after loading', async () => {
      render(<AuthoritiesPage />);
      await waitFor(() => {
        // "Verified" appears in both the table header and the data cell
        const matches = screen.getAllByText('Verified');
        expect(matches.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
