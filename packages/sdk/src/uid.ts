/**
 * Off-chain UID computation utilities.
 *
 * These functions replicate the on-chain keccak256(abi.encode(...)) derivation
 * from UIDGenerator.sol so that UIDs can be predicted or verified without
 * calling the contract.
 */

import { AbiCoder, keccak256, ZeroAddress } from 'ethers';

const coder = AbiCoder.defaultAbiCoder();

/**
 * Compute a deterministic Schema UID matching the on-chain derivation:
 *   keccak256(abi.encode(definition, resolver, revocable))
 *
 * @param definition - The schema definition string.
 * @param resolver   - Resolver contract address. Defaults to the zero address.
 * @param revocable  - Whether attestations under this schema can be revoked.
 * @returns 0x-prefixed bytes32 hex string (66 characters).
 */
export function computeSchemaUid(
  definition: string,
  resolver: string | undefined | null,
  revocable: boolean,
): string {
  const resolverAddr = resolver || ZeroAddress;
  const encoded = coder.encode(
    ['string', 'address', 'bool'],
    [definition, resolverAddr, revocable],
  );
  return keccak256(encoded);
}

/**
 * Compute a deterministic Attestation UID matching the on-chain derivation:
 *   keccak256(abi.encode(schemaUid, subject, attester, data, nonce))
 *
 * @param schemaUid - The schema this attestation references (bytes32 hex).
 * @param subject   - The subject address of the attestation.
 * @param attester  - The attester address.
 * @param data      - The attestation payload as a hex-encoded bytes string.
 * @param nonce     - Per-attester nonce for uniqueness.
 * @returns 0x-prefixed bytes32 hex string (66 characters).
 */
export function computeAttestationUid(
  schemaUid: string,
  subject: string,
  attester: string,
  data: string,
  nonce: number | bigint,
): string {
  const encoded = coder.encode(
    ['bytes32', 'address', 'address', 'bytes', 'uint256'],
    [schemaUid, subject, attester, data, nonce],
  );
  return keccak256(encoded);
}
