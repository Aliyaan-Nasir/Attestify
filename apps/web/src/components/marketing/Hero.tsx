import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface HeroProps {
  title: string;
  subtitle: string;
  description?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export function Hero({ title, subtitle, description, primaryCta, secondaryCta }: HeroProps) {
  return (
    <section className="grid-bg relative overflow-hidden border-b border-surface-200">
      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:py-28">
        <p className="mb-3 font-mono text-sm tracking-wide text-brand-500">{subtitle}</p>
        <h1 className="font-display max-w-3xl text-3xl font-bold leading-tight tracking-tight text-surface-900 sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-surface-500 sm:text-lg">
            {description}
          </p>
        )}
        {(primaryCta || secondaryCta) && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {primaryCta && (
              <Link
                href={primaryCta.href}
                className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
              >
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center gap-2 rounded-md border border-surface-300 px-5 py-2.5 text-sm font-medium text-surface-700 transition-colors hover:border-surface-400 hover:text-surface-900"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
