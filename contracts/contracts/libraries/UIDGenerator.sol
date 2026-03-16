// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title UIDGenerator
 * @notice Deterministic UID generation for schemas and attestations.
 *         UIDs are derived via keccak256 over ABI-encoded parameters,
 *         making them predictable and verifiable off-chain.
 */
library UIDGenerator {
    /**
     * @notice Compute a deterministic Schema UID.
     * @param definition  The schema definition string.
     * @param resolver    The resolver contract address (address(0) if none).
     * @param revocable   Whether attestations under this schema can be revoked.
     * @return uid        The 32-byte schema identifier.
     */
    function generateSchemaUID(
        string calldata definition,
        address resolver,
        bool revocable
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(definition, resolver, revocable));
    }

    /**
     * @notice Compute a deterministic Attestation UID.
     * @param schemaUid  The schema this attestation references.
     * @param subject    The subject of the attestation.
     * @param attester   The entity creating the attestation.
     * @param data       The attestation payload.
     * @param nonce      Per-attester nonce for uniqueness.
     * @return uid       The 32-byte attestation identifier.
     */
    function generateAttestationUID(
        bytes32 schemaUid,
        address subject,
        address attester,
        bytes calldata data,
        uint256 nonce
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(schemaUid, subject, attester, data, nonce));
    }
}
