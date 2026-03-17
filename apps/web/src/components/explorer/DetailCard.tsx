'use client';

interface DetailField {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

interface DetailCardProps {
  title: string;
  fields: DetailField[];
  icon?: React.ReactNode;
}

export function DetailCard({ title, fields, icon }: DetailCardProps) {
  return (
    <div className="rounded-md border border-surface-200 bg-white">
      <div className="flex items-center gap-2 border-b border-surface-200 px-5 py-3">
        {icon}
        <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
      </div>
      <div className="divide-y divide-surface-100">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="min-w-[140px] shrink-0 text-xs font-medium uppercase tracking-wider text-surface-500">
              {field.label}
            </span>
            <span className={`text-sm text-surface-700 break-all ${field.mono ? 'font-mono text-xs' : ''}`}>
              {field.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
