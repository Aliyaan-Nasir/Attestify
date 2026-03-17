'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';

const NAV_LINKS = [
  { label: 'Schema', href: '/products/schema' },
  { label: 'Attestation', href: '/products/attestation' },
  { label: 'Sandbox', href: '/sandbox' },
  { label: 'Docs', href: '/docs' },
  { label: 'About', href: '/about' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-surface-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1 -ml-2">
          <Image src="/logo2.png" alt="Attestify" width={36} height={33} className="h-7 w-auto" />
          <span className="font-[family-name:var(--font-logo)] text-xl tracking-tight">
            <span className="font-bold text-surface-900">Attest</span>
            <span className="font-medium text-brand-500">ify</span>
          </span>
        </Link>

        {/* Desktop nav — centered links */}
        <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-4 py-2 text-[13px] font-medium tracking-wide transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-surface-500 hover:bg-surface-50 hover:text-brand-500'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop nav — right actions */}
        <div className="hidden items-center gap-3 md:flex">
          <ConnectButton />
          <Link
            href="/schemas"
            className="rounded-full bg-surface-900 px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-surface-800"
          >
            Launch Explorer
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-1.5 text-surface-500 hover:text-surface-900 md:hidden"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-surface-200 bg-white px-5 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2.5 text-[13px] font-medium tracking-wide transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-surface-600 hover:bg-surface-50 hover:text-brand-500'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-3 flex flex-col gap-2 border-t border-surface-100 pt-3">
              <ConnectButton />
              <Link
                href="/schemas"
                className="rounded-full bg-surface-900 px-5 py-2.5 text-center text-[13px] font-medium text-white"
                onClick={() => setMobileOpen(false)}
              >
                Launch Explorer
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
