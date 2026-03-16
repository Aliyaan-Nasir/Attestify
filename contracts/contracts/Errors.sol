// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Attestify Protocol Errors
 * Shared custom errors for gas-efficient reverts across all contracts.
 */

error SchemaAlreadyExists(bytes32 uid);
error SchemaNotFound(bytes32 uid);
error AttestationNotFound(bytes32 uid);
error AttestationAlreadyRevoked(bytes32 uid);
error SchemaNotRevocable(bytes32 schemaUid);
error UnauthorizedRevoker(address caller, address attester);
error ResolverRejected(address resolver);
error InvalidResolver(address resolver);
error InsufficientFee(uint256 required, uint256 provided);
error InsufficientTokenBalance(address token, uint256 required, uint256 actual);
error NotWhitelisted(address attester);
error Unauthorized(address caller);
error AuthorityNotFound(address addr);
error InvalidExpirationTime(uint64 expirationTime);
error AttestationExpired(bytes32 uid);
error NotDelegate(address caller, address authority);
error DelegateAlreadyAdded(address delegate);
error DelegateNotFound(address delegate);
