'use client';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-surface-200/60 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-md border border-surface-200">
      <div className="border-b border-surface-200 bg-surface-50 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-surface-800/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className={`h-4 ${j === 0 ? 'w-32' : 'w-20'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="rounded-md border border-surface-200 bg-white">
      <div className="flex items-center gap-2 border-b border-surface-200 px-5 py-3">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y divide-surface-800/50">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
            <Skeleton className="h-3 w-24 shrink-0" />
            <Skeleton className={`h-4 ${i % 2 === 0 ? 'w-64' : 'w-40'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 divide-y divide-surface-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 px-6 py-8">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton };
