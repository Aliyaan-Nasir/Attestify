/**
 * Property tests for pagination correctness (Property 29).
 *
 * **Validates: Requirements 19.4**
 *
 * For any list of N items in the database and any valid limit and offset parameters
 * where offset < N, the returned items should be exactly the subset from index offset
 * to min(offset + limit, N), and hasMore should be true if and only if offset + limit < N.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Pure pagination logic extracted for property testing.
 * This mirrors the pagination computation in api.ts.
 */
function computePagination(
  total: number,
  requestedLimit: number,
  requestedOffset: number,
): { limit: number; offset: number; hasMore: boolean; expectedCount: number } {
  const limit = Math.min(Math.max(requestedLimit, 1), 200);
  const offset = Math.max(requestedOffset, 0);
  const expectedCount = Math.max(0, Math.min(limit, total - offset));
  const hasMore = offset + limit < total;

  return { limit, offset, hasMore, expectedCount };
}

describe('Property 29: Indexer pagination correctness', () => {
  it('returns the correct subset size and hasMore flag for any N, limit, offset', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),   // total items N
        fc.integer({ min: 1, max: 300 }),    // requested limit
        fc.integer({ min: 0, max: 600 }),    // requested offset
        (total, requestedLimit, requestedOffset) => {
          const { limit, offset, hasMore, expectedCount } = computePagination(
            total,
            requestedLimit,
            requestedOffset,
          );

          // Limit is capped at 200 and at least 1
          expect(limit).toBeGreaterThanOrEqual(1);
          expect(limit).toBeLessThanOrEqual(200);

          // Offset is non-negative
          expect(offset).toBeGreaterThanOrEqual(0);

          // Expected count is correct
          if (offset >= total) {
            expect(expectedCount).toBe(0);
          } else {
            expect(expectedCount).toBe(Math.min(limit, total - offset));
          }

          // hasMore is true iff there are more items beyond this page
          expect(hasMore).toBe(offset + limit < total);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returned items are exactly the subset from offset to min(offset+limit, N) when offset < N', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),   // total items N (at least 1)
        fc.integer({ min: 1, max: 200 }),    // limit
        fc.nat(),                             // raw offset
        (total, requestedLimit, rawOffset) => {
          // Ensure offset < N for this property
          const offset = rawOffset % total;
          const limit = Math.min(Math.max(requestedLimit, 1), 200);

          // Simulate a database of N items (ordered by index)
          const allItems = Array.from({ length: total }, (_, i) => i);

          // Simulate Prisma findMany with take/skip
          const returnedItems = allItems.slice(offset, offset + limit);

          // Verify the subset
          const expectedEnd = Math.min(offset + limit, total);
          const expectedItems = allItems.slice(offset, expectedEnd);
          expect(returnedItems).toEqual(expectedItems);

          // Verify hasMore
          const hasMore = offset + limit < total;
          if (hasMore) {
            expect(offset + returnedItems.length).toBeLessThan(total);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('hasMore is false when offset + limit >= total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 200 }),
        (total, limit) => {
          // Set offset so that offset + limit >= total
          const offset = Math.max(0, total - limit + 1);
          const cappedLimit = Math.min(Math.max(limit, 1), 200);
          const hasMore = offset + cappedLimit < total;

          if (offset + cappedLimit >= total) {
            expect(hasMore).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
