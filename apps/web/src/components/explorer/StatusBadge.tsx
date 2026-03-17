'use client';

import type { StatusInfo } from '@/lib/attestation-status';

const COLOR_CLASSES: Record<StatusInfo['color'], string> = {
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

export function StatusBadge({ status }: { status: StatusInfo }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${COLOR_CLASSES[status.color]}`}
      data-testid={`status-badge-${status.status}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
        status.color === 'green' ? 'bg-green-400' :
        status.color === 'red' ? 'bg-red-400' : 'bg-yellow-400'
      }`} />
      {status.label}
    </span>
  );
}
