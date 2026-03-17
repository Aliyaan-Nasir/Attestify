export type AttestationStatus = 'active' | 'revoked' | 'expired';

export interface StatusInfo {
  status: AttestationStatus;
  label: string;
  color: 'green' | 'red' | 'yellow';
}

const STATUS_MAP: Record<AttestationStatus, StatusInfo> = {
  active: { status: 'active', label: 'Active', color: 'green' },
  revoked: { status: 'revoked', label: 'Revoked', color: 'red' },
  expired: { status: 'expired', label: 'Expired', color: 'yellow' },
};

/**
 * Compute attestation status from revocation flag and expiration time.
 *
 * Rules (Property 27):
 * - Revoked (red): revoked === true
 * - Expired (yellow): revoked === false AND expirationTime > 0 AND expirationTime <= now
 * - Active (green): otherwise
 */
export function computeAttestationStatus(
  revoked: boolean,
  expirationTime: string | null | number,
  nowSeconds?: number,
): StatusInfo {
  if (revoked) {
    return STATUS_MAP.revoked;
  }

  if (expirationTime != null) {
    const expSec = typeof expirationTime === 'number'
      ? expirationTime
      : parseExpirationToSeconds(expirationTime);

    const now = nowSeconds ?? Math.floor(Date.now() / 1000);

    if (expSec > 0 && expSec <= now) {
      return STATUS_MAP.expired;
    }
  }

  return STATUS_MAP.active;
}

function parseExpirationToSeconds(expiration: string): number {
  // Handle ISO date strings
  const date = new Date(expiration);
  if (!isNaN(date.getTime())) {
    return Math.floor(date.getTime() / 1000);
  }
  // Handle numeric strings (already in seconds)
  const num = Number(expiration);
  return isNaN(num) ? 0 : num;
}
