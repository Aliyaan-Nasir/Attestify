// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IResolver
 * @notice Interface for resolver contracts that provide custom validation
 *         logic during attestation creation and revocation.
 *         Mirrors the Stellar resolver pattern (onattest/onrevoke) translated
 *         to Solidity with ERC-165 interface detection.
 */
interface IResolver {
    /**
     * @notice Called before an attestation is created.
     * @param schemaUid  The schema being attested against.
     * @param attester   The address creating the attestation.
     * @param subject    The subject of the attestation.
     * @param data       The attestation payload.
     * @return allowed   True if the attestation should proceed.
     */
    function onAttest(
        bytes32 schemaUid,
        address attester,
        address subject,
        bytes calldata data
    ) external returns (bool);

    /**
     * @notice Called before an attestation is revoked.
     * @param attestationUid  The attestation being revoked.
     * @param revoker         The address requesting revocation.
     * @return allowed        True if the revocation should proceed.
     */
    function onRevoke(
        bytes32 attestationUid,
        address revoker
    ) external returns (bool);

    /**
     * @notice Called after an attestation is created or revoked for side-effects
     *         (rewards, cleanup, indexing, etc.).
     *         Mirrors Stellar's onresolve — failures here do NOT revert the
     *         attestation or revocation.
     * @param schemaUid       The schema UID.
     * @param attester        The attester address.
     * @param subject         The subject address.
     * @param data            The attestation payload.
     */
    function onResolve(
        bytes32 schemaUid,
        address attester,
        address subject,
        bytes calldata data
    ) external;

    /**
     * @notice ERC-165 interface detection.
     * @param interfaceId  The interface identifier to check.
     * @return supported   True if the interface is supported.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
