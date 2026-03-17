import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="border-t border-surface-200 bg-surface-50">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 grid-cols-2 sm:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-[3px]">
              <Image src="/logo2.png" alt="Attestify" width={20} height={18} className="h-[18px] w-auto" />
              <span className="font-[family-name:var(--font-logo)] text-sm tracking-tight"><span className="font-semibold text-surface-900">Attest</span><span className="font-medium text-brand-500">ify</span></span>
            </Link>
            <p className="mt-2 text-xs leading-relaxed text-surface-400">
              The trust layer for Hedera.
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-surface-400">Resources</p>
            <div className="flex flex-col gap-1.5">
              <Link href="/docs" className="text-xs text-surface-500 hover:text-surface-900">Documentation</Link>
              <Link href="/docs" className="text-xs text-surface-500 hover:text-surface-900">API Reference</Link>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-surface-400">Company</p>
            <div className="flex flex-col gap-1.5">
              <Link href="/about" className="text-xs text-surface-500 hover:text-surface-900">About us</Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-xs text-surface-500 hover:text-surface-900">GitHub</a>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-surface-400">Connect</p>
            <div className="flex flex-col gap-1.5">
              <a href="https://www.npmjs.com/package/@attestify/sdk" target="_blank" rel="noopener noreferrer" className="text-xs text-surface-500 hover:text-surface-900">SDK</a>
              <a href="https://portal.hedera.com/faucet" target="_blank" rel="noopener noreferrer" className="text-xs text-surface-500 hover:text-surface-900">Testnet Faucet</a>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-surface-200 pt-4 text-center text-xs text-surface-400">
          © {new Date().getFullYear()} Attestify. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
