'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Step {
  num: string;
  title: string;
  description: string;
  traditional: string;
  attestify: string;
}

interface HowItWorksStepperProps {
  steps: Step[];
}

export function HowItWorksStepper({ steps }: HowItWorksStepperProps) {
  const [active, setActive] = useState(0);

  const prev = () => setActive((i) => Math.max(0, i - 1));
  const next = () => setActive((i) => Math.min(steps.length - 1, i + 1));

  const step = steps[active];

  return (
    <div>
      {/* Step indicators */}
      <div className="mb-6 flex items-center gap-3">
        {steps.map((s, i) => (
          <button
            key={s.num}
            onClick={() => setActive(i)}
            className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors ${
              i === active
                ? 'bg-brand-500 text-white'
                : i < active
                  ? 'bg-brand-100 text-brand-600'
                  : 'bg-surface-100 text-surface-400'
            }`}
          >
            {s.num}
          </button>
        ))}
        {/* Progress line */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-surface-400">
            {active + 1} / {steps.length}
          </span>
        </div>
      </div>

      {/* Active step content — fixed height so arrows don't shift */}
      <div className="h-[320px] overflow-hidden">
        <h3 className="mb-2 text-lg font-semibold text-surface-900">{step.title}</h3>
        <p className="mb-5 text-sm leading-relaxed text-surface-500">{step.description}</p>

        <div className="space-y-3">
          <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3">
            <p className="text-xs font-medium text-red-600">Traditional way</p>
            <p className="mt-1 text-sm text-red-500">{step.traditional}</p>
          </div>
          <div className="rounded-md border border-green-100 bg-green-50 px-4 py-3">
            <p className="text-xs font-medium text-green-600">Attestify way</p>
            <p className="mt-1 text-sm text-green-500">{step.attestify}</p>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={prev}
          disabled={active === 0}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-surface-200 text-surface-500 transition-colors hover:border-surface-300 hover:text-surface-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          onClick={next}
          disabled={active === steps.length - 1}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-surface-200 text-surface-500 transition-colors hover:border-surface-300 hover:text-surface-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
