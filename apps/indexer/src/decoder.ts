/**
 * ABI event decoder for SchemaRegistered, AttestationCreated, AttestationRevoked, AuthorityRegistered.
 * Uses ethers.js Interface.decodeEventLog() to decode indexed + non-indexed params.
 */

import { ethers } from 'ethers';
import type { MirrorNodeLog } from './mirror-node.js';

// ABI fragments for the events we care about
const SCHEMA_REGISTRY_ABI = [
  'event SchemaRegistered(bytes32 indexed uid, address indexed authority, address resolver)',
];

const ATTESTATION_SERVICE_ABI = [
  'event AttestationCreated(bytes32 indexed uid, bytes32 indexed schemaUid, address indexed attester, address subject)',
  'event AttestationRevoked(bytes32 indexed uid, address indexed revoker)',
  'event AuthorityRegistered(address indexed authority)',
];

export const schemaRegistryInterface = new ethers.Interface(SCHEMA_REGISTRY_ABI);
export const attestationServiceInterface = new ethers.Interface(ATTESTATION_SERVICE_ABI);

// Pre-compute event topic hashes
export const EVENT_TOPICS = {
  SchemaRegistered: schemaRegistryInterface.getEvent('SchemaRegistered')!.topicHash,
  AttestationCreated: attestationServiceInterface.getEvent('AttestationCreated')!.topicHash,
  AttestationRevoked: attestationServiceInterface.getEvent('AttestationRevoked')!.topicHash,
  AuthorityRegistered: attestationServiceInterface.getEvent('AuthorityRegistered')!.topicHash,
} as const;

export interface DecodedSchemaRegistered {
  uid: string;
  authorityAddress: string;
  resolverAddress: string;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string;
}

export interface DecodedAttestationCreated {
  uid: string;
  schemaUid: string;
  attesterAddress: string;
  subjectAddress: string;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string;
}

export interface DecodedAttestationRevoked {
  uid: string;
  revokerAddress: string;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string;
}

export interface DecodedAuthorityRegistered {
  address: string;
  transactionHash: string;
  blockNumber: number;
  consensusTimestamp: string;
}

export type DecodedEvent =
  | { type: 'SchemaRegistered'; data: DecodedSchemaRegistered }
  | { type: 'AttestationCreated'; data: DecodedAttestationCreated }
  | { type: 'AttestationRevoked'; data: DecodedAttestationRevoked }
  | { type: 'AuthorityRegistered'; data: DecodedAuthorityRegistered };

export function decodeSchemaRegistered(log: MirrorNodeLog): DecodedSchemaRegistered {
  const decoded = schemaRegistryInterface.decodeEventLog(
    'SchemaRegistered',
    log.data,
    log.topics,
  );

  return {
    uid: decoded.uid,
    authorityAddress: decoded.authority,
    resolverAddress: decoded.resolver,
    transactionHash: log.transaction_hash,
    blockNumber: log.block_number,
    consensusTimestamp: log.timestamp,
  };
}

export function decodeAttestationCreated(log: MirrorNodeLog): DecodedAttestationCreated {
  const decoded = attestationServiceInterface.decodeEventLog(
    'AttestationCreated',
    log.data,
    log.topics,
  );

  return {
    uid: decoded.uid,
    schemaUid: decoded.schemaUid,
    attesterAddress: decoded.attester,
    subjectAddress: decoded.subject,
    transactionHash: log.transaction_hash,
    blockNumber: log.block_number,
    consensusTimestamp: log.timestamp,
  };
}

export function decodeAttestationRevoked(log: MirrorNodeLog): DecodedAttestationRevoked {
  const decoded = attestationServiceInterface.decodeEventLog(
    'AttestationRevoked',
    log.data,
    log.topics,
  );

  return {
    uid: decoded.uid,
    revokerAddress: decoded.revoker,
    transactionHash: log.transaction_hash,
    blockNumber: log.block_number,
    consensusTimestamp: log.timestamp,
  };
}

export function decodeAuthorityRegistered(log: MirrorNodeLog): DecodedAuthorityRegistered {
  const decoded = attestationServiceInterface.decodeEventLog(
    'AuthorityRegistered',
    log.data,
    log.topics,
  );

  return {
    address: decoded.authority,
    transactionHash: log.transaction_hash,
    blockNumber: log.block_number,
    consensusTimestamp: log.timestamp,
  };
}

/**
 * Decode a raw Mirror Node log entry into a typed event.
 * Returns null if the log doesn't match any known event signature.
 */
export function decodeLog(log: MirrorNodeLog): DecodedEvent | null {
  const topic0 = log.topics[0];

  if (topic0 === EVENT_TOPICS.SchemaRegistered) {
    return { type: 'SchemaRegistered', data: decodeSchemaRegistered(log) };
  }
  if (topic0 === EVENT_TOPICS.AttestationCreated) {
    return { type: 'AttestationCreated', data: decodeAttestationCreated(log) };
  }
  if (topic0 === EVENT_TOPICS.AttestationRevoked) {
    return { type: 'AttestationRevoked', data: decodeAttestationRevoked(log) };
  }
  if (topic0 === EVENT_TOPICS.AuthorityRegistered) {
    return { type: 'AuthorityRegistered', data: decodeAuthorityRegistered(log) };
  }

  return null;
}
