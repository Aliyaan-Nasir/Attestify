'use client';

import { Search } from 'lucide-react';
import { useState, useCallback } from 'react';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  defaultValue?: string;
}

export function SearchBar({ placeholder = 'Search...', onSearch, defaultValue = '' }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearch(value.trim());
    },
    [value, onSearch],
  );

  return (
    <form onSubmit={handleSubmit} className="relative w-full sm:max-w-lg">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-surface-200 bg-white py-2 pl-10 pr-4 text-sm text-surface-700 placeholder-surface-400 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        data-testid="search-input"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-brand-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-600"
      >
        Search
      </button>
    </form>
  );
}
