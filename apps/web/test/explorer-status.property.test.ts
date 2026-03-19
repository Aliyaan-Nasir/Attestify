import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeAttestationStatus } from '@/lib/attestation-status';

/**
 * Property 27: Attestation status computation
 *
 * For any attestation record, the status should be computed as:
 * - "revoked" if revoked === true
 * - "expired" if expirationTime > 0 && expirationTime < currentTimestamp
 * - "active" otherwise
 *
 * **Validates: Requirements 5.3, 14.4**
 */
describe('Property 27: Attestation status computation', () => {
  const NOW = 1700000000; // fixed reference timestamp

  it('should return "revoked" (red) when revoked is true, regardless of expiration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2000000000 }),
        (expirationTime) => {
          const result = computeAttestationStatus(true, expirationTime, NOW);
          expect(result.status).toBe('revoked');
          expect(result.color).toBe('red');
          expect(result.label).toBe('Revoked');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return "expired" (yellow) when not revoked and expirationTime > 0 and expirationTime <= now', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: NOW }),
        (expirationTime) => {
          const result = computeAttestationStatus(false, expirationTime, NOW);
          expect(result.status).toBe('expired');
          expect(result.color).toBe('yellow');
          expect(result.label).toBe('Expired');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return "active" (green) when not revoked and expirationTime is 0', () => {
    const result = computeAttestationStatus(false, 0, NOW);
    expect(result.status).toBe('active');
    expect(result.color).toBe('green');
    expect(result.label).toBe('Active');
  });

  it('should return "active" (green) when not revoked and expirationTime is null', () => {
    const result = computeAttestationStatus(false, null, NOW);
    expect(result.status).toBe('active');
    expect(result.color).toBe('green');
  });

  it('should return "active" (green) when not revoked and expirationTime > now', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: NOW + 1, max: 2000000000 }),
        (expirationTime) => {
          const result = computeAttestationStatus(false, expirationTime, NOW);
          expect(result.status).toBe('active');
          expect(result.color).toBe('green');
          expect(result.label).toBe('Active');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('revoked takes priority over expired', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: NOW }),
        (expirationTime) => {
          // Even if expiration is in the past, revoked should take priority
          const result = computeAttestationStatus(true, expirationTime, NOW);
          expect(result.status).toBe('revoked');
          expect(result.color).toBe('red');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('handles string expiration times (ISO dates)', () => {
    const pastDate = new Date((NOW - 1000) * 1000).toISOString();
    const result = computeAttestationStatus(false, pastDate, NOW);
    expect(result.status).toBe('expired');

    const futureDate = new Date((NOW + 10000) * 1000).toISOString();
    const result2 = computeAttestationStatus(false, futureDate, NOW);
    expect(result2.status).toBe('active');
  });
});
