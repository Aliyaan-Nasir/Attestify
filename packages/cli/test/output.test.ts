/**
 * Unit tests for CLI output formatting
 * Validates: Requirements 11.4, 11.5
 */

import { describe, it, expect } from 'vitest';
import { formatOutput, formatError } from '../src/output';

describe('formatOutput', () => {
  it('should return valid JSON when json flag is true', () => {
    const data = { schemaUid: '0xabc123' };
    const result = formatOutput(data, true);
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.schemaUid).toBe('0xabc123');
  });

  it('should return human-readable output when json flag is false', () => {
    const data = { schemaUid: '0xabc123', revocable: true };
    const result = formatOutput(data, false);

    expect(result).toContain('schemaUid: 0xabc123');
    expect(result).toContain('revocable: true');
  });

  it('should return human-readable output when json flag is undefined', () => {
    const data = { uid: '0xdef456' };
    const result = formatOutput(data);

    expect(result).toContain('uid: 0xdef456');
    expect(() => JSON.parse(result)).toThrow();
  });

  it('should handle nested objects in human-readable mode', () => {
    const data = { nested: { a: 1, b: 2 } };
    const result = formatOutput(data, false);

    expect(result).toContain('nested:');
    expect(result).toContain('"a":1');
  });
});

describe('formatError', () => {
  it('should return valid JSON with error type and message when json flag is true', () => {
    const result = formatError('NOT_FOUND', 'Schema not found', true);
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error.type).toBe('NOT_FOUND');
    expect(parsed.error.message).toBe('Schema not found');
  });

  it('should return human-readable error with type and message when json flag is false', () => {
    const result = formatError('UNAUTHORIZED', 'Not authorized', false);

    expect(result).toContain('UNAUTHORIZED');
    expect(result).toContain('Not authorized');
  });

  it('should include error type in output', () => {
    const result = formatError('VALIDATION_ERROR', 'Invalid input', false);

    expect(result).toContain('VALIDATION_ERROR');
    expect(result).toContain('Invalid input');
  });
});
