/**
 * Property tests for CLI output format (Property 30)
 *
 * Property 30: CLI output format
 * For any successful CLI command with the --json flag, the output should be
 * valid parseable JSON. For any failed CLI command, the output should contain
 * the error type and a descriptive message.
 *
 * **Validates: Requirements 11.4, 11.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatOutput, formatError } from '../src/output';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a random non-empty string suitable for object keys/values */
const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

/** Generates a random data object with string, number, and boolean values */
const arbDataObject = fc.dictionary(
  fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/),
  fc.oneof(
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
  ),
  { minKeys: 1, maxKeys: 10 },
);

/** Generates a random error type string */
const arbErrorType = fc.constantFrom(
  'ALREADY_EXISTS',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'VALIDATION_ERROR',
  'ALREADY_REVOKED',
  'RESOLVER_REJECTED',
  'NETWORK_ERROR',
  'UNKNOWN_ERROR',
  'CONFIGURATION_ERROR',
  'TRANSACTION_ERROR',
);

/** Generates a random error message */
const arbErrorMessage = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 30: CLI output format', () => {
  it('successful output with --json flag is always valid parseable JSON', () => {
    fc.assert(
      fc.property(arbDataObject, (data) => {
        const output = formatOutput(data, true);
        const parsed = JSON.parse(output);

        expect(parsed).toBeDefined();
        expect(parsed.success).toBe(true);
        expect(parsed.data).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it('successful JSON output contains all original data keys', () => {
    fc.assert(
      fc.property(arbDataObject, (data) => {
        const output = formatOutput(data, true);
        const parsed = JSON.parse(output);

        for (const key of Object.keys(data)) {
          expect(parsed.data).toHaveProperty(key);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('error output with --json flag is always valid parseable JSON', () => {
    fc.assert(
      fc.property(arbErrorType, arbErrorMessage, (type, message) => {
        const output = formatError(type, message, true);
        const parsed = JSON.parse(output);

        expect(parsed).toBeDefined();
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBeDefined();
        expect(parsed.error.type).toBe(type);
        expect(parsed.error.message).toBe(message);
      }),
      { numRuns: 100 },
    );
  });

  it('error output without --json flag contains error type and message', () => {
    fc.assert(
      fc.property(arbErrorType, arbErrorMessage, (type, message) => {
        const output = formatError(type, message, false);

        expect(output).toContain(type);
        expect(output).toContain(message);
      }),
      { numRuns: 100 },
    );
  });
});
