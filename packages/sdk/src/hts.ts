/**
 * Attestify SDK — HTS NFT Credential Minting
 *
 * Mints an HTS non-fungible token to a subject's address upon successful
 * attestation creation, embedding the Attestation UID in the NFT metadata.
 */

import { Client, TokenId, TokenMintTransaction } from '@hashgraph/sdk';
import type { MintAttestationNFTParams } from './types';

/**
 * Mint an HTS NFT credential for a successful attestation.
 *
 * Uses `@hashgraph/sdk` `TokenMintTransaction` to mint a single NFT whose
 * metadata contains the UTF-8–encoded Attestation UID. The caller is
 * responsible for ensuring the `client` has the token's supply key configured.
 *
 * Unlike HCS logging, minting failures propagate — the returned promise
 * rejects on any transaction or receipt error.
 *
 * @param params - Minting parameters (subject, attestationUid, tokenId).
 * @param client - An authenticated `@hashgraph/sdk` Client instance.
 * @returns The serial number of the newly minted NFT.
 */
export async function mintAttestationNFT(
  params: MintAttestationNFTParams,
  client: Client,
): Promise<{ serialNumber: number }> {
  const metadata = Buffer.from(params.attestationUid, 'utf-8');

  const tx = new TokenMintTransaction()
    .setTokenId(TokenId.fromString(params.tokenId))
    .addMetadata(metadata);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  const serialNumber = receipt.serials[0].toNumber();

  return { serialNumber };
}
