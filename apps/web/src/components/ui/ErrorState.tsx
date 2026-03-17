'use client';

import { AlertTriangle, RefreshCw, SearchX } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-red-500/20 bg-red-500/5 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 h-6 w-6 text-red-400" />
      <p className="mb-1 text-sm font-medium text-red-300">Something went wrong</p>
      <p className="mb-4 max-w-md text-sm text-red-400/80">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  message?: string;
  description?: string;
}

export function EmptyState({ message = 'No results found', description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-surface-200 bg-white px-6 py-12 text-center">
      <SearchX className="mb-3 h-6 w-6 text-surface-500" />
      <p className="text-sm font-medium text-surface-500">{message}</p>
      {description && <p className="mt-1 text-xs text-surface-500">{description}</p>}
    </div>
  );
}
