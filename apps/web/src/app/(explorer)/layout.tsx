'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileCode2, FilePlus2, UserCheck, ScrollText } from 'lucide-react';

const TABS = [
  { label: 'Schemas', href: '/schemas', icon: FileCode2 },
  { label: 'Attestations', href: '/attestations', icon: FilePlus2 },
  { label: 'Authorities', href: '/authorities', icon: UserCheck },
  { label: 'Audit Log', href: '/audit-log', icon: ScrollText },
];

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Tab navigation */}
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-surface-200 bg-white p-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-500 text-white'
                  : 'text-surface-500 hover:bg-surface-50 hover:text-surface-900'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
