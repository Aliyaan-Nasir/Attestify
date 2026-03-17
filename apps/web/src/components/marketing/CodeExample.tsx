interface CodeExampleProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeExample({ code, language = 'typescript', title }: CodeExampleProps) {
  return (
    <div className="rounded-md border border-surface-200 bg-surface-50">
      {title && (
        <div className="flex items-center border-b border-surface-200 px-4 py-2">
          <div className="mac-dots mr-3" />
          <span className="ml-8 font-mono text-xs text-surface-500">{title}</span>
          {language && (
            <span className="ml-auto font-mono text-xs text-surface-400">{language}</span>
          )}
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-xs leading-relaxed text-surface-700">{code}</code>
      </pre>
    </div>
  );
}
