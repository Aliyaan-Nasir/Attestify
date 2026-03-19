import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// --- Mocks (hoisted) ---

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/sandbox/search',
}));

// Mock lucide-react icons
vi.mock('lucide-react', async () => {
  const iconNames = [
    'FileCode2', 'FilePlus2', 'XCircle', 'UserCheck', 'Search', 'Loader2',
    'CheckCircle2', 'AlertTriangle', 'Plus', 'Trash2', 'Wallet', 'ArrowRight',
    'ArrowUpRight', 'Copy', 'Home', 'Send',
    'Menu', 'X', 'ExternalLink', 'LogOut', 'Shield', 'Lock', 'Globe',
    'Layers', 'RefreshCw', 'Puzzle', 'KeyRound', 'Vote', 'Landmark',
    'Star', 'Cpu', 'Zap', 'Fingerprint', 'Database', 'Clock', 'Hash',
    'ChevronLeft', 'ChevronRight', 'ShieldCheck', 'ArrowLeft',
  ];
  const mocks: Record<string, unknown> = {};
  for (const name of iconNames) {
    mocks[name] = (props: Record<string, unknown>) => React.createElement('span', { 'data-icon': name, ...props });
  }
  return mocks;
});

// Mock wallet context
const mockWalletState = {
  address: '0x1234567890abcdef1234567890abcdef12345678',
  isConnected: true,
  isCorrectNetwork: true,
  chainId: 296,
};
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSwitchNetwork = vi.fn();

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({
    state: mockWalletState,
    connect: mockConnect,
    disconnect: mockDisconnect,
    switchToHederaTestnet: mockSwitchNetwork,
  }),
  WalletProvider: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

// Mock useContract
const mockRegister = vi.fn().mockResolvedValue({
  wait: vi.fn().mockResolvedValue({ hash: '0xtxhash123', logs: [] }),
});
const mockAttest = vi.fn().mockResolvedValue({
  wait: vi.fn().mockResolvedValue({ hash: '0xtxhash456', logs: [] }),
});
const mockRevoke = vi.fn().mockResolvedValue({
  wait: vi.fn().mockResolvedValue({ hash: '0xtxhash789', logs: [] }),
});
const mockRegisterAuthority = vi.fn().mockResolvedValue({
  wait: vi.fn().mockResolvedValue({ hash: '0xtxhashauth', logs: [] }),
});

vi.mock('@/hooks/useContract', () => ({
  useContract: () => ({
    provider: {},
    getSigner: vi.fn(),
    getSchemaRegistry: vi.fn().mockResolvedValue({
      register: mockRegister,
      getSchema: vi.fn().mockResolvedValue({
        definition: 'string name, uint256 age',
        uid: '0xabc123',
      }),
      interface: { parseLog: vi.fn() },
    }),
    getAttestationService: vi.fn().mockResolvedValue({
      attest: mockAttest,
      revoke: mockRevoke,
      registerAuthority: mockRegisterAuthority,
      interface: { parseLog: vi.fn() },
    }),
  }),
}));

// Mock indexer API
vi.mock('@/lib/api', () => ({
  indexerApi: {
    getAttestation: vi.fn().mockRejectedValue(new Error('Not found')),
    getSchema: vi.fn().mockRejectedValue(new Error('Not found')),
    getSchemas: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } }),
    getAttestations: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } }),
    getAuthorities: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } }),
  },
}));

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    AbiCoder: {
      defaultAbiCoder: () => ({
        encode: vi.fn().mockReturnValue('0xencoded'),
      }),
    },
  },
}));

// --- Import components after mocks ---
import { SchemaFieldBuilder, type SchemaField } from '@/components/sandbox/SchemaFieldBuilder';
import { TransactionStatus } from '@/components/sandbox/TransactionStatus';
import { FormWrapper } from '@/components/sandbox/FormWrapper';
import SchemaBuilderPage from '@/app/(sandbox)/sandbox/app/schema-builder/page';
import CreateAttestationPage from '@/app/(sandbox)/sandbox/app/create-attestation/page';
import RevokePage from '@/app/(sandbox)/sandbox/app/revoke/page';
import RegisterAuthorityPage from '@/app/(sandbox)/sandbox/app/register-authority/page';
import SearchPage from '@/app/(sandbox)/sandbox/app/search/page';

describe('Sandbox Components', () => {
  describe('SchemaFieldBuilder', () => {
    it('renders empty state when no fields', () => {
      render(<SchemaFieldBuilder fields={[]} onChange={() => {}} />);
      expect(screen.getByText(/No fields defined/)).toBeDefined();
    });

    it('renders fields with name and type', () => {
      const fields: SchemaField[] = [
        { name: 'age', type: 'uint256' },
        { name: 'name', type: 'string' },
      ];
      render(<SchemaFieldBuilder fields={fields} onChange={() => {}} />);
      expect(screen.getByDisplayValue('age')).toBeDefined();
      expect(screen.getByDisplayValue('name')).toBeDefined();
    });

    it('calls onChange when Add Field is clicked', () => {
      const onChange = vi.fn();
      render(<SchemaFieldBuilder fields={[]} onChange={onChange} />);
      fireEvent.click(screen.getByText('Add Field'));
      expect(onChange).toHaveBeenCalledWith([{ name: '', type: 'string' }]);
    });

    it('calls onChange when a field is removed', () => {
      const onChange = vi.fn();
      const fields: SchemaField[] = [{ name: 'test', type: 'string' }];
      render(<SchemaFieldBuilder fields={fields} onChange={onChange} />);
      fireEvent.click(screen.getByLabelText('Remove field 0'));
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('disables inputs when disabled prop is true', () => {
      const fields: SchemaField[] = [{ name: 'test', type: 'string' }];
      render(<SchemaFieldBuilder fields={fields} onChange={() => {}} disabled />);
      expect((screen.getByDisplayValue('test') as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe('TransactionStatus', () => {
    it('renders nothing when idle', () => {
      const { container } = render(<TransactionStatus status="idle" />);
      expect(container.innerHTML).toBe('');
    });

    it('renders loading state', () => {
      render(<TransactionStatus status="loading" />);
      expect(screen.getByTestId('tx-loading')).toBeDefined();
      expect(screen.getByText('Processing transaction...')).toBeDefined();
    });

    it('renders success state with tx hash and UID', () => {
      render(
        <TransactionStatus
          status="success"
          txHash="0xabcdef1234567890abcdef1234567890"
          uid="0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff"
          uidLabel="Schema UID"
        />,
      );
      expect(screen.getByTestId('tx-success')).toBeDefined();
      expect(screen.getByText('Transaction successful')).toBeDefined();
      expect(screen.getByText('Schema UID:')).toBeDefined();
    });

    it('renders error state with message', () => {
      render(<TransactionStatus status="error" error="Insufficient gas" />);
      expect(screen.getByTestId('tx-error')).toBeDefined();
      expect(screen.getByText('Transaction failed')).toBeDefined();
      expect(screen.getByText('Insufficient gas')).toBeDefined();
    });

    it('links tx hash to HashScan', () => {
      render(<TransactionStatus status="success" txHash="0xmyhash123" />);
      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('https://hashscan.io/testnet/transaction/0xmyhash123');
    });
  });

  describe('FormWrapper', () => {
    it('shows connect prompt when wallet not connected', () => {
      const origConnected = mockWalletState.isConnected;
      const origAddress = mockWalletState.address;
      mockWalletState.isConnected = false;
      mockWalletState.address = null as unknown as string;

      render(
        <FormWrapper>
          <div>Form Content</div>
        </FormWrapper>,
      );

      expect(screen.getByTestId('connect-prompt')).toBeDefined();
      expect(screen.getByText('Wallet Required')).toBeDefined();
      expect(screen.queryByText('Form Content')).toBeNull();

      mockWalletState.isConnected = origConnected;
      mockWalletState.address = origAddress;
    });

    it('renders children when wallet is connected', () => {
      render(
        <FormWrapper>
          <div>Form Content</div>
        </FormWrapper>,
      );
      expect(screen.getByText('Form Content')).toBeDefined();
      expect(screen.queryByTestId('connect-prompt')).toBeNull();
    });

    it('shows wallet required message when disconnected', () => {
      const origConnected = mockWalletState.isConnected;
      const origAddress = mockWalletState.address;
      mockWalletState.isConnected = false;
      mockWalletState.address = null as unknown as string;

      render(
        <FormWrapper>
          <div>Content</div>
        </FormWrapper>,
      );

      expect(screen.getByText(/Connect your MetaMask wallet/)).toBeDefined();

      mockWalletState.isConnected = origConnected;
      mockWalletState.address = origAddress;
    });
  });
});

describe('Sandbox Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema Builder Page', () => {
    it('renders page title and description', () => {
      render(<SchemaBuilderPage />);
      expect(screen.getByText('Schema Deployer')).toBeDefined();
      expect(screen.getByText(/Create and deploy custom attestation schemas/)).toBeDefined();
    });

    it('renders schema field builder', () => {
      render(<SchemaBuilderPage />);
      expect(screen.getByText('Schema Fields')).toBeDefined();
      expect(screen.getByText('Add Field')).toBeDefined();
    });

    it('renders resolver address input', () => {
      render(<SchemaBuilderPage />);
      expect(screen.getByText(/Resolver Address/)).toBeDefined();
    });

    it('renders revocable checkbox', () => {
      render(<SchemaBuilderPage />);
      expect(screen.getByText('Revocable')).toBeDefined();
    });

    it('renders next button for step 1', () => {
      render(<SchemaBuilderPage />);
      expect(screen.getByText('Next')).toBeDefined();
    });
  });

  describe('Create Attestation Page', () => {
    it('renders page title', () => {
      render(<CreateAttestationPage />);
      expect(screen.getByText('Attestation Workflow')).toBeDefined();
    });

    it('renders schema UID input and load button', () => {
      render(<CreateAttestationPage />);
      expect(screen.getByRole('button', { name: /Load/ })).toBeDefined();
    });
  });

  describe('Revoke Page', () => {
    it('renders page title', () => {
      render(<RevokePage />);
      expect(screen.getByRole('heading', { name: 'Revoke Attestation' })).toBeDefined();
    });

    it('renders attestation UID input', () => {
      render(<RevokePage />);
      expect(screen.getByText('Attestation UID')).toBeDefined();
    });

    it('renders next button on first step', () => {
      render(<RevokePage />);
      expect(screen.getByText('Next')).toBeDefined();
    });
  });

  describe('Register Authority Page', () => {
    it('renders page title', () => {
      render(<RegisterAuthorityPage />);
      expect(screen.getByRole('heading', { name: 'Register Authority' })).toBeDefined();
    });

    it('renders metadata input', () => {
      render(<RegisterAuthorityPage />);
      expect(screen.getByText('Metadata')).toBeDefined();
    });

    it('renders next button on first step', () => {
      render(<RegisterAuthorityPage />);
      expect(screen.getByText('Next')).toBeDefined();
    });
  });

  describe('Search Page', () => {
    it('renders page title', () => {
      render(<SearchPage />);
      expect(screen.getByText('Universal Search')).toBeDefined();
    });

    it('renders search input', () => {
      render(<SearchPage />);
      expect(screen.getByTestId('search-input')).toBeDefined();
    });

    it('renders accepted formats info', () => {
      render(<SearchPage />);
      expect(screen.getByText('Accepted formats')).toBeDefined();
    });

    it('shows error for invalid input', async () => {
      render(<SearchPage />);
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.click(screen.getByRole('button', { name: /Search/ }));

      await vi.waitFor(() => {
        expect(screen.getByTestId('search-error')).toBeDefined();
      });
    });

    it('navigates to authority page for valid address', async () => {
      render(<SearchPage />);
      const input = screen.getByTestId('search-input');
      const addr = '0x1234567890abcdef1234567890abcdef12345678';
      fireEvent.change(input, { target: { value: addr } });
      fireEvent.click(screen.getByRole('button', { name: /Search/ }));

      await vi.waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/authorities/${addr}`);
      });
    });
  });
});
