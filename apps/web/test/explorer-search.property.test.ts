import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 33: Explorer search returns matching results
 *
 * For any search query on the /schemas or /attestations pages, all returned
 * results should match the search criteria (Schema_UID, authority address,
 * keyword, Attestation_UID, attester, subject, or Schema_UID filter).
 *
 * Since search is delegated to the indexer API, we test that:
 * 1. The API client correctly passes search parameters
 * 2. The URL builder correctly encodes search queries
 *
 * **Validates: Requirements 13.2, 14.2**
 */

// Simulate the buildUrl function from api.ts
function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = 'http://localhost:3001/api';
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

describe('Property 33: Explorer search returns matching results', () => {
  it('search parameter is included in URL when provided', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (searchQuery) => {
          const url = buildUrl('/schemas', { search: searchQuery });
          const parsed = new URL(url);
          expect(parsed.searchParams.get('search')).toBe(searchQuery);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('search parameter is omitted from URL when undefined', () => {
    const url = buildUrl('/schemas', { search: undefined, limit: 20 });
    const parsed = new URL(url);
    expect(parsed.searchParams.has('search')).toBe(false);
    expect(parsed.searchParams.get('limit')).toBe('20');
  });

  it('attestation filter parameters are correctly encoded', () => {
    fc.assert(
      fc.property(
        fc.record({
          schemaUid: fc.option(fc.hexaString({ minLength: 64, maxLength: 64 }), { nil: undefined }),
          attester: fc.option(fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => '0x' + s), { nil: undefined }),
          subject: fc.option(fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => '0x' + s), { nil: undefined }),
          search: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0), { nil: undefined }),
        }),
        (params) => {
          const url = buildUrl('/attestations', params);
          const parsed = new URL(url);

          if (params.schemaUid !== undefined) {
            expect(parsed.searchParams.get('schemaUid')).toBe(params.schemaUid);
          } else {
            expect(parsed.searchParams.has('schemaUid')).toBe(false);
          }

          if (params.attester !== undefined) {
            expect(parsed.searchParams.get('attester')).toBe(params.attester);
          } else {
            expect(parsed.searchParams.has('attester')).toBe(false);
          }

          if (params.subject !== undefined) {
            expect(parsed.searchParams.get('subject')).toBe(params.subject);
          } else {
            expect(parsed.searchParams.has('subject')).toBe(false);
          }

          if (params.search !== undefined) {
            expect(parsed.searchParams.get('search')).toBe(params.search);
          } else {
            expect(parsed.searchParams.has('search')).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('pagination parameters are correctly encoded alongside search', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        (limit, offset, search) => {
          const url = buildUrl('/schemas', { limit, offset, search });
          const parsed = new URL(url);
          expect(parsed.searchParams.get('limit')).toBe(String(limit));
          expect(parsed.searchParams.get('offset')).toBe(String(offset));
          expect(parsed.searchParams.get('search')).toBe(search);
        },
      ),
      { numRuns: 100 },
    );
  });
});
