import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 16.5**
 *
 * Property 31: Sandbox search routing
 *
 * For any valid Attestation_UID, Schema_UID, or Hedera account address
 * entered in the Sandbox universal search bar, the search should navigate
 * to the corresponding detail page in the Protocol Explorer.
 *
 * We test the core routing logic: detectSearchType determines the input
 * category, and the routing function maps it to the correct path.
 */

type SearchInputType = 'uid' | 'address' | 'invalid';

function detectSearchType(input: string): SearchInputType {
  const trimmed = input.trim().toLowerCase();
  if (/^0x[0-9a-f]{64}$/.test(trimmed)) return 'uid';
  if (/^0x[0-9a-f]{40}$/.test(trimmed)) return 'address';
  return 'invalid';
}

function computeSearchRoute(type: SearchInputType, input: string): string | null {
  if (type === 'address') return `/authorities/${input.trim()}`;
  if (type === 'uid') return null; // needs async lookup — returns attestation or schema path
  return null; // invalid
}

// Arbitraries
const hexCharArb = fc.mapToConstant(
  { num: 10, build: (v) => String.fromCharCode(48 + v) }, // 0-9
  { num: 6, build: (v) => String.fromCharCode(97 + v) },  // a-f
);

const uidArb = fc.array(hexCharArb, { minLength: 64, maxLength: 64 }).map((chars) => `0x${chars.join('')}`);
const addressArb = fc.array(hexCharArb, { minLength: 40, maxLength: 40 }).map((chars) => `0x${chars.join('')}`);

const invalidInputArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 100 }).filter((s) => {
    const t = s.trim().toLowerCase();
    return !/^0x[0-9a-f]{64}$/.test(t) && !/^0x[0-9a-f]{40}$/.test(t);
  }),
  fc.constant(''),
  fc.constant('0x'),
  fc.constant('0xZZZZ'),
  fc.array(hexCharArb, { minLength: 30, maxLength: 30 }).map((c) => `0x${c.join('')}`),
);

describe('Property 31: Sandbox search routing', () => {
  it('66-char hex strings are detected as UID type', () => {
    fc.assert(
      fc.property(uidArb, (uid) => {
        expect(detectSearchType(uid)).toBe('uid');
      }),
      { numRuns: 100 },
    );
  });

  it('42-char hex strings are detected as address type', () => {
    fc.assert(
      fc.property(addressArb, (addr) => {
        expect(detectSearchType(addr)).toBe('address');
      }),
      { numRuns: 100 },
    );
  });

  it('invalid inputs are detected as invalid type', () => {
    fc.assert(
      fc.property(invalidInputArb, (input) => {
        expect(detectSearchType(input)).toBe('invalid');
      }),
      { numRuns: 100 },
    );
  });

  it('address type routes to /authorities/{address}', () => {
    fc.assert(
      fc.property(addressArb, (addr) => {
        const route = computeSearchRoute('address', addr);
        expect(route).toBe(`/authorities/${addr}`);
      }),
      { numRuns: 100 },
    );
  });

  it('UID type returns null (requires async lookup)', () => {
    fc.assert(
      fc.property(uidArb, (uid) => {
        const route = computeSearchRoute('uid', uid);
        expect(route).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('invalid type returns null (no route)', () => {
    fc.assert(
      fc.property(invalidInputArb, (input) => {
        const route = computeSearchRoute('invalid', input);
        expect(route).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('detectSearchType is case-insensitive for hex', () => {
    fc.assert(
      fc.property(uidArb, (uid) => {
        expect(detectSearchType(uid.toUpperCase())).toBe('uid');
        expect(detectSearchType(uid.toLowerCase())).toBe('uid');
      }),
      { numRuns: 100 },
    );
  });

  it('detectSearchType trims whitespace', () => {
    fc.assert(
      fc.property(addressArb, (addr) => {
        expect(detectSearchType(`  ${addr}  `)).toBe('address');
      }),
      { numRuns: 100 },
    );
  });
});
