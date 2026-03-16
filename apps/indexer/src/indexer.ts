/**
 * Indexer polling loop with configurable interval, lastProcessedTimestamp tracking,
 * and exponential backoff on Mirror Node failures.
 */

import { ethers } from 'ethers';
import type { PrismaClient } from '@prisma/client';
import { MirrorNodeClient } from './mirror-node.js';
import { decodeLog } from './decoder.js';
import type { HCSPublisher } from './hcs-publisher.js';

const SCHEMA_REGISTRY_ABI = [
  'function getSchema(bytes32 uid) external view returns (tuple(bytes32 uid, string definition, address authority, address resolver, bool revocable, uint64 timestamp))',
];

const ATTESTATION_SERVICE_ABI_READ = [
  'function getAuthority(address addr) external view returns (tuple(address addr, string metadata, bool isVerified, uint64 registeredAt))',
  'function getAttestation(bytes32 uid) external view returns (tuple(bytes32 uid, bytes32 schemaUid, address attester, address subject, bytes data, uint64 timestamp, uint64 expirationTime, bool revoked, uint64 revocationTime, uint256 nonce))',
];

// Hedera Testnet JSON-RPC
const HEDERA_RPC_URL = 'https://testnet.hashio.io/api';

export interface IndexerConfig {
  schemaRegistryAddress: string;
  attestationServiceAddress: string;
  pollingIntervalMs: number;
  mirrorNodeClient: MirrorNodeClient;
  hcsPublisher?: HCSPublisher;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export class Indexer {
  private config: IndexerConfig;
  private prisma: PrismaClient;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentBackoff = INITIAL_BACKOFF_MS;

  constructor(prisma: PrismaClient, config: IndexerConfig) {
    this.prisma = prisma;
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('Indexer started.');
    this.scheduleNextPoll(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('Indexer stopped.');
  }

  private scheduleNextPoll(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => this.poll(), delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const state = await this.getOrCreateState();
      const fromTimestamp = state.lastProcessedTimestamp || undefined;

      // Fetch logs from both contracts
      const [schemaLogs, attestationLogs] = await Promise.all([
        this.config.mirrorNodeClient.fetchContractLogs(
          this.config.schemaRegistryAddress,
          fromTimestamp,
        ),
        this.config.mirrorNodeClient.fetchContractLogs(
          this.config.attestationServiceAddress,
          fromTimestamp,
        ),
      ]);

      const allLogs = [...schemaLogs.logs, ...attestationLogs.logs]
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      let latestTimestamp = fromTimestamp || '0.0';
      let latestBlock = state.lastProcessedBlock;

      for (const log of allLogs) {
        // Skip already-processed timestamp (gte includes the boundary)
        if (fromTimestamp && log.timestamp === fromTimestamp) continue;

        try {
          const decoded = decodeLog(log);
          if (!decoded) continue;

          await this.processEvent(decoded);

          if (log.timestamp > latestTimestamp) {
            latestTimestamp = log.timestamp;
          }
          if (log.block_number > latestBlock) {
            latestBlock = log.block_number;
          }
        } catch (err) {
          console.error('Error decoding/processing event:', err);
          // Skip individual event errors, continue processing
        }
      }

      // Update state
      if (latestTimestamp !== (fromTimestamp || '0.0') || latestBlock !== state.lastProcessedBlock) {
        await this.updateState(latestTimestamp, latestBlock, 'synced');
      }

      // Reset backoff on success
      this.currentBackoff = INITIAL_BACKOFF_MS;
      this.scheduleNextPoll(this.config.pollingIntervalMs);
    } catch (err) {
      console.error('Mirror Node poll failed:', err);

      // Update state with error
      await this.updateState(undefined, undefined, 'error', String(err));

      // Exponential backoff
      console.log(`Retrying in ${this.currentBackoff}ms...`);
      this.scheduleNextPoll(this.currentBackoff);
      this.currentBackoff = Math.min(this.currentBackoff * 2, MAX_BACKOFF_MS);
    }
  }

  private async processEvent(event: ReturnType<typeof decodeLog>): Promise<void> {
      if (!event) return;

      switch (event.type) {
        case 'SchemaRegistered': {
          let definition = '';
          try {
            const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
            const registry = new ethers.Contract(
              this.config.schemaRegistryAddress,
              SCHEMA_REGISTRY_ABI,
              provider,
            );
            const schemaRecord = await registry.getSchema(event.data.uid);
            definition = schemaRecord.definition || schemaRecord[1] || '';
          } catch (err) {
            console.warn('Failed to fetch schema definition from contract:', err);
          }

          // Create per-schema HCS topic
          let hcsTopicId: string | null = null;
          if (this.config.hcsPublisher?.isEnabled()) {
            hcsTopicId = await this.config.hcsPublisher.createSchemaTopic(
              event.data.uid, definition, event.data.authorityAddress,
            );
          }

          const resolverAddr = event.data.resolverAddress === '0x0000000000000000000000000000000000000000'
            ? null : event.data.resolverAddress;

          await this.prisma.schema.upsert({
            where: { uid: event.data.uid },
            update: { definition, hcsTopicId: hcsTopicId || undefined },
            create: {
              uid: event.data.uid,
              definition,
              authorityAddress: event.data.authorityAddress,
              resolverAddress: resolverAddr,
              hcsTopicId,
              transactionHash: event.data.transactionHash,
              blockNumber: event.data.blockNumber,
              consensusTimestamp: event.data.consensusTimestamp,
            },
          });

          // Publish to global + per-schema topic
          this.config.hcsPublisher?.publishSchemaRegistered({
            uid: event.data.uid,
            authority: event.data.authorityAddress,
            resolver: resolverAddr,
            definition,
            transactionHash: event.data.transactionHash,
            blockNumber: event.data.blockNumber,
            consensusTimestamp: event.data.consensusTimestamp,
          }, hcsTopicId).catch((err) => console.warn('[HCS] Schema publish failed:', err));

          break;
        }

        case 'AttestationCreated': {
          let data = '';
          let nonce = 0;
          let expirationTime: Date | null = null;
          try {
            const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
            const service = new ethers.Contract(
              this.config.attestationServiceAddress,
              ATTESTATION_SERVICE_ABI_READ,
              provider,
            );
            const record = await service.getAttestation(event.data.uid);
            data = record.data || record[4] || '';
            nonce = Number(record.nonce || record[9] || 0);
            const expTime = Number(record.expirationTime || record[6] || 0);
            if (expTime > 0) {
              expirationTime = new Date(expTime * 1000);
            }
          } catch (err) {
            console.warn('Failed to fetch attestation data from contract:', err);
          }

          await this.prisma.attestation.upsert({
            where: { uid: event.data.uid },
            update: { data, nonce, expirationTime },
            create: {
              uid: event.data.uid,
              schemaUid: event.data.schemaUid,
              attesterAddress: event.data.attesterAddress,
              subjectAddress: event.data.subjectAddress,
              data,
              nonce,
              expirationTime,
              transactionHash: event.data.transactionHash,
              blockNumber: event.data.blockNumber,
              consensusTimestamp: event.data.consensusTimestamp,
            },
          });

          // Look up per-schema topic
          const schema = await this.prisma.schema.findUnique({
            where: { uid: event.data.schemaUid },
            select: { hcsTopicId: true, definition: true },
          });

          // Decode attestation data using schema definition
          let decodedData: Record<string, unknown> | null = null;
          if (schema?.definition && data) {
            try {
              const fields = schema.definition.split(',').map((s: string) => s.trim()).filter(Boolean)
                .map((pair: string) => { const parts = pair.split(/\s+/); return { type: parts[0], name: parts.slice(1).join(' ') }; });
              const types = fields.map((f: { type: string }) => f.type);
              const coder = ethers.AbiCoder.defaultAbiCoder();
              const decoded = coder.decode(types, data);
              decodedData = {};
              for (let i = 0; i < fields.length; i++) {
                decodedData[fields[i].name] = String(decoded[i]);
              }
            } catch {
              // Decoding failed — leave decodedData null
            }
          }

          this.config.hcsPublisher?.publishAttestationCreated({
            uid: event.data.uid,
            schemaUid: event.data.schemaUid,
            attester: event.data.attesterAddress,
            subject: event.data.subjectAddress,
            data,
            decodedData,
            nonce,
            expirationTime: expirationTime ? Math.floor(expirationTime.getTime() / 1000) : null,
            transactionHash: event.data.transactionHash,
            blockNumber: event.data.blockNumber,
            consensusTimestamp: event.data.consensusTimestamp,
          }, schema?.hcsTopicId).catch((err) => console.warn('[HCS] Attestation publish failed:', err));

          break;
        }

        case 'AttestationRevoked': {
          // Look up the attestation to get schemaUid for per-schema topic
          const attestation = await this.prisma.attestation.findUnique({
            where: { uid: event.data.uid },
            select: { schemaUid: true },
          });

          await this.prisma.attestation.updateMany({
            where: { uid: event.data.uid },
            data: {
              revoked: true,
              revocationTime: new Date(),
              revocationTxHash: event.data.transactionHash,
            },
          });

          // Look up per-schema topic
          let schemaTopicId: string | null = null;
          if (attestation?.schemaUid) {
            const schema = await this.prisma.schema.findUnique({
              where: { uid: attestation.schemaUid },
              select: { hcsTopicId: true },
            });
            schemaTopicId = schema?.hcsTopicId || null;
          }

          this.config.hcsPublisher?.publishAttestationRevoked({
            uid: event.data.uid,
            schemaUid: attestation?.schemaUid,
            revoker: event.data.revokerAddress,
            transactionHash: event.data.transactionHash,
            blockNumber: event.data.blockNumber,
            consensusTimestamp: event.data.consensusTimestamp,
          }, schemaTopicId).catch((err) => console.warn('[HCS] Revocation publish failed:', err));

          break;
        }

        case 'AuthorityRegistered': {
          let metadata: string | null = null;
          try {
            const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
            const service = new ethers.Contract(
              this.config.attestationServiceAddress,
              ATTESTATION_SERVICE_ABI_READ,
              provider,
            );
            const record = await service.getAuthority(event.data.address);
            metadata = record.metadata || record[1] || null;
          } catch (err) {
            console.warn('Failed to fetch authority metadata from contract:', err);
          }

          await this.prisma.authority.upsert({
            where: { address: event.data.address },
            update: { metadata },
            create: {
              address: event.data.address,
              metadata,
              transactionHash: event.data.transactionHash,
              blockNumber: event.data.blockNumber,
              consensusTimestamp: event.data.consensusTimestamp,
            },
          });

          this.config.hcsPublisher?.publishAuthorityRegistered({
            address: event.data.address,
            metadata,
            transactionHash: event.data.transactionHash,
            blockNumber: event.data.blockNumber,
            consensusTimestamp: event.data.consensusTimestamp,
          }).catch((err) => console.warn('[HCS] Authority publish failed:', err));

          break;
        }
      }
    }

  private async getOrCreateState() {
    let state = await this.prisma.indexerState.findFirst();
    if (!state) {
      state = await this.prisma.indexerState.create({
        data: {
          lastProcessedTimestamp: '0.0',
          lastProcessedBlock: 0,
          syncStatus: 'syncing',
        },
      });
    }
    return state;
  }

  private async updateState(
    timestamp?: string,
    block?: number,
    status?: string,
    errorMessage?: string,
  ): Promise<void> {
    const state = await this.prisma.indexerState.findFirst();
    if (!state) return;

    const data: Record<string, unknown> = {};
    if (timestamp !== undefined) data.lastProcessedTimestamp = timestamp;
    if (block !== undefined) data.lastProcessedBlock = block;
    if (status !== undefined) data.syncStatus = status;
    if (errorMessage !== undefined) data.errorMessage = errorMessage;
    else data.errorMessage = null;

    await this.prisma.indexerState.update({
      where: { id: state.id },
      data,
    });
  }
}
