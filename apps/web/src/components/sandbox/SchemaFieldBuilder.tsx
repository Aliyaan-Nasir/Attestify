'use client';

import { Plus, Trash2 } from 'lucide-react';

export interface SchemaField {
  name: string;
  type: string;
}

const FIELD_TYPES = [
  'string',
  'uint256',
  'address',
  'bool',
  'bytes',
  'bytes32',
  'int256',
  'uint8',
  'uint16',
  'uint32',
  'uint64',
  'uint128',
] as const;

interface SchemaFieldBuilderProps {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
  disabled?: boolean;
}

export function SchemaFieldBuilder({ fields, onChange, disabled }: SchemaFieldBuilderProps) {
  const addField = () => {
    onChange([...fields, { name: '', type: 'string' }]);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: keyof SchemaField, value: string) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, [key]: value } : f));
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-surface-900">Schema Fields</label>
        <button
          type="button"
          onClick={addField}
          disabled={disabled}
          className="flex items-center gap-1 rounded-md border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-medium text-surface-600 transition-colors hover:bg-surface-50 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Field
        </button>
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-surface-300 p-4 text-center text-sm text-surface-500">
          No fields defined. Click &quot;Add Field&quot; to start building your schema.
        </p>
      )}

      {fields.map((field, index) => (
        <div key={index} className="flex items-center gap-2" data-testid={`schema-field-${index}`}>
          <input
            type="text"
            placeholder="Field name"
            value={field.name}
            onChange={(e) => updateField(index, 'name', e.target.value)}
            disabled={disabled}
            className="flex-1 rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
          <select
            value={field.type}
            onChange={(e) => updateField(index, 'type', e.target.value)}
            disabled={disabled}
            className="rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => removeField(index)}
            disabled={disabled}
            className="rounded-md p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-red-500 disabled:opacity-50"
            aria-label={`Remove field ${index}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
