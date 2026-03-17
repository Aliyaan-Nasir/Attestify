const BASE_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3001/api';

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface SingleResponse<T> {
  success: boolean;
  data: T;
}

export interface SchemaRecord {
  uid: string;
  definition: string;
  authorityAddress: string;
  resolverAddress: string | null;
  revocable: boolean;
  hcsTopicId: string | null;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string | null;
  createdAt: string;
}

export interface AttestationRecord {
  uid: string;
  schemaUid: string;
  attesterAddress: string;
  subjectAddress: string;
  data: string;
  nonce: number;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string | null;
  expirationTime: string | null;
  revoked: boolean;
  revocationTime: string | null;
  revocationTxHash: string | null;
  createdAt: string;
}

export interface AuthorityRecord {
  address: string;
  metadata: string | null;
  isVerified: boolean;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string | null;
  createdAt: string;
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const indexerApi = {
  // Schemas
  async getSchemas(
    params?: PaginationParams & { authority?: string; search?: string },
  ): Promise<PaginatedResponse<SchemaRecord[]>> {
    const url = buildUrl('/schemas', {
      limit: params?.limit,
      offset: params?.offset,
      authority: params?.authority,
      search: params?.search,
    });
    return fetchJson(url);
  },

  async getSchema(uid: string): Promise<SingleResponse<SchemaRecord>> {
    return fetchJson(buildUrl(`/schemas/${uid}`));
  },

  // Attestations
  async getAttestations(
    params?: PaginationParams & {
      schemaUid?: string;
      subject?: string;
      attester?: string;
      revoked?: boolean;
      search?: string;
    },
  ): Promise<PaginatedResponse<AttestationRecord[]>> {
    const url = buildUrl('/attestations', {
      limit: params?.limit,
      offset: params?.offset,
      schemaUid: params?.schemaUid,
      subject: params?.subject,
      attester: params?.attester,
      revoked: params?.revoked !== undefined ? String(params.revoked) : undefined,
      search: params?.search,
    });
    return fetchJson(url);
  },

  async getAttestation(uid: string): Promise<SingleResponse<AttestationRecord>> {
    return fetchJson(buildUrl(`/attestations/${uid}`));
  },

  // Authorities
  async getAuthorities(
    params?: PaginationParams & { search?: string },
  ): Promise<PaginatedResponse<AuthorityRecord[]>> {
    const url = buildUrl('/authorities', {
      limit: params?.limit,
      offset: params?.offset,
      search: params?.search,
    });
    return fetchJson(url);
  },

  async getAuthority(address: string): Promise<SingleResponse<AuthorityRecord>> {
    return fetchJson(buildUrl(`/authorities/${address}`));
  },
};
