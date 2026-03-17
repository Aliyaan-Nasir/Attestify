import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-md border border-surface-200 bg-white p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-surface-100 text-surface-600">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-1.5 text-sm font-semibold text-surface-900">{title}</h3>
      <p className="text-sm leading-relaxed text-surface-500">{description}</p>
    </div>
  );
}
