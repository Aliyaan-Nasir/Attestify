/**
 * Attestify SDK — Indexer Client
 *
 * Queries the Attestify indexer API for listing and searching schemas,
 * attestations, and authorities. Unlike HederaAttestService (which reads
 * directly from smart contracts), this client reads from the indexed
 * database for efficient list/filter/search operations.
 */

import type { ServiceResponse } from './types';
import { AttestifyErrorType } from './types';

// ─── Indexer Record Types ────────────────────────────────────────────────────

export interface IndexedSchema {
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

export interface IndexedAttestation {
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

export interface IndexedAuthority {
  address: string;
  metadata: string | null;
  isVerified: boolean;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ProfileResult {
  address: string;
  authority: IndexedAuthority | null;
  schemas: IndexedSchema[];
  attestationsIssued: IndexedAttestation[];
  attestationsReceived: IndexedAttestation[];
}

export interface ListParams {
  limit?: number;
  offset?: number;
}

// ─── IndexerClient ───────────────────────────────────────────────────────────

export class IndexerClient {
  private readonly baseUrl: string;

  /**
   * @param indexerUrl - Base URL of the indexer API (e.g. "http://localhost:3001")
   */
  constructor(indexerUrl: string = 'http://localhost:3001') {
    this.baseUrl = indexerUrl.replace(/\/+$/, '');
  }

  // ─── Schemas ─────────────────────────────────────────────────────────

  async listSchemas(params?: ListParams & { authority?: string; search?: string }): Promise<ServiceResponse<PaginatedResult<IndexedSchema>>> {
    const queryParams: Record<string, string | undefined> = {
      limit: params?.limit?.toString(),
      offset: params?.offset?.toString(),
      authority: params?.authority,
      search: params?.search,
    };
    return this.fetchPaginated<IndexedSchema>('/api/schemas', queryParams);
  }

  async getSchema(uid: string): Promise<ServiceResponse<IndexedSchema>> {
    return this.fetchSingle<IndexedSchema>(`/api/schemas/${uid}`);
  }

  // ─── Attestations ────────────────────────────────────────────────────

  async listAttestations(params?: ListParams & {
    schemaUid?: string;
    attester?: string;
    subject?: string;
    revoked?: boolean;
    search?: string;
  }): Promise<ServiceResponse<PaginatedResult<IndexedAttestation>>> {
    const queryParams: Record<string, string | undefined> = {
      limit: params?.limit?.toString(),
      offset: params?.offset?.toString(),
      schemaUid: params?.schemaUid,
      attester: params?.attester,
      subject: params?.subject,
      revoked: params?.revoked !== undefined ? String(params.revoked) : undefined,
      search: params?.search,
    };
    return this.fetchPaginated<IndexedAttestation>('/api/attestations', queryParams);
  }

  async getAttestation(uid: string): Promise<ServiceResponse<IndexedAttestation>> {
    return this.fetchSingle<IndexedAttestation>(`/api/attestations/${uid}`);
  }

  // ─── Authorities ─────────────────────────────────────────────────────

  async listAuthorities(params?: ListParams & { search?: string }): Promise<ServiceResponse<PaginatedResult<IndexedAuthority>>> {
    const queryParams: Record<string, string | undefined> = {
      limit: params?.limit?.toString(),
      offset: params?.offset?.toString(),
      search: params?.search,
    };
    return this.fetchPaginated<IndexedAuthority>('/api/authorities', queryParams);
  }

  async getAuthority(address: string): Promise<ServiceResponse<IndexedAuthority>> {
    return this.fetchSingle<IndexedAuthority>(`/api/authorities/${address}`);
  }

  // ─── Profile ─────────────────────────────────────────────────────────

  /**
   * Fetches a complete profile for an address: authority status, schemas,
   * attestations issued, and attestations received (as subject).
   */
  async getProfile(address: string): Promise<ServiceResponse<ProfileResult>> {
    try {
      const [authorityRes, schemasRes, issuedRes, receivedRes] = await Promise.all([
        this.getAuthority(address),
        this.listSchemas({ authority: address, limit: 100 }),
        this.listAttestations({ attester: address, limit: 100 }),
        this.listAttestations({ subject: address, limit: 100 }),
      ]);

      return {
        success: true,
        data: {
          address,
          authority: authorityRes.success ? authorityRes.data! : null,
          schemas: schemasRes.success ? schemasRes.data!.data : [],
          attestationsIssued: issuedRes.success ? issuedRes.data!.data : [],
          attestationsReceived: receivedRes.success ? receivedRes.data!.data : [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: AttestifyErrorType.NETWORK_ERROR,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  private async fetchPaginated<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<ServiceResponse<PaginatedResult<T>>> {
    try {
      const url = this.buildUrl(path, params);
      const res = await fetch(url);
      if (!res.ok) {
        return { success: false, error: { type: AttestifyErrorType.NETWORK_ERROR, message: `Indexer returned ${res.status}` } };
      }
      const json = await res.json() as { success: boolean; data: T[]; pagination?: PaginatedResult<T>['pagination'] };
      return {
        success: true,
        data: {
          data: json.data,
          pagination: json.pagination || { total: json.data.length, limit: 25, offset: 0, hasMore: false },
        },
      };
    } catch (error) {
      return { success: false, error: { type: AttestifyErrorType.NETWORK_ERROR, message: error instanceof Error ? error.message : String(error) } };
    }
  }

  private async fetchSingle<T>(path: string): Promise<ServiceResponse<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`);
      if (!res.ok) {
        if (res.status === 404) return { success: false, error: { type: AttestifyErrorType.NOT_FOUND, message: 'Not found' } };
        return { success: false, error: { type: AttestifyErrorType.NETWORK_ERROR, message: `Indexer returned ${res.status}` } };
      }
      const json = await res.json() as { success: boolean; data: T };
      return { success: true, data: json.data };
    } catch (error) {
      return { success: false, error: { type: AttestifyErrorType.NETWORK_ERROR, message: error instanceof Error ? error.message : String(error) } };
    }
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }
}
