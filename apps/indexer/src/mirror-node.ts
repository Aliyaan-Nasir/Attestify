/**
 * Mirror Node REST API client for polling contract event logs.
 */

export interface MirrorNodeLog {
  address: string;
  topics: string[];
  data: string;
  block_number: number;
  timestamp: string;
  transaction_hash: string;
}

export interface MirrorNodeLogsResponse {
  logs: MirrorNodeLog[];
  links?: { next?: string };
}

export class MirrorNodeClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com').replace(/\/$/, '');
  }

  /**
   * Fetch contract event logs from the Mirror Node REST API.
   */
  async fetchContractLogs(
    contractId: string,
    fromTimestamp?: string,
    limit: number = 100,
  ): Promise<MirrorNodeLogsResponse> {
    let url = `${this.baseUrl}/api/v1/contracts/${contractId}/results/logs?order=asc&limit=${limit}`;

    if (fromTimestamp) {
      url += `&timestamp=gte:${fromTimestamp}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mirror Node request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<MirrorNodeLogsResponse>;
  }
}
