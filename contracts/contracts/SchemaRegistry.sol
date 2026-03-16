// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UIDGenerator} from "./libraries/UIDGenerator.sol";
import {IResolver} from "./IResolver.sol";
import {SchemaAlreadyExists, SchemaNotFound, InvalidResolver} from "./Errors.sol";

/**
 * @title SchemaRegistry
 * @notice Manages registration and lookup of attestation schemas.
 *         Each schema is identified by a deterministic UID derived from
 *         its definition, resolver address, and revocable flag.
 *
 *         Follows the same registration flow as the Stellar protocol:
 *         1. Generate deterministic UID from inputs
 *         2. Check for duplicate (revert if exists)
 *         3. Validate resolver interface (if provided)
 *         4. Store schema record
 *         5. Emit registration event
 */
contract SchemaRegistry {
    using UIDGenerator for *;

    struct SchemaRecord {
        bytes32 uid;
        string definition;
        address authority;
        address resolver;
        bool revocable;
        uint64 timestamp;
    }

    /// @notice Emitted when a new schema is registered.
    event SchemaRegistered(
        bytes32 indexed uid,
        address indexed authority,
        address resolver
    );

    /// @dev Schema UID → SchemaRecord
    mapping(bytes32 => SchemaRecord) private _schemas;

    /// @dev IResolver interface ID for ERC-165 check.
    ///      Computed as XOR of function selectors: onAttest ^ onRevoke
    bytes4 private constant IRESOLVER_INTERFACE_ID = 0x0000;

    /// @dev Lazily computed on first use. We use the Solidity-native approach instead.
    function _checkResolver(address resolver) internal view {
        try IResolver(resolver).supportsInterface(type(IResolver).interfaceId) returns (bool supported) {
            if (!supported) {
                revert InvalidResolver(resolver);
            }
        } catch {
            revert InvalidResolver(resolver);
        }
    }

    /**
     * @notice Register a new attestation schema.
     * @param definition  The schema definition string (ABI-encoded field types).
     * @param resolver    Optional resolver contract address (address(0) for none).
     * @param revocable   Whether attestations under this schema can be revoked.
     * @return uid        The deterministic schema UID.
     */
    function register(
        string calldata definition,
        address resolver,
        bool revocable
    ) external returns (bytes32) {
        // 1. Generate deterministic UID
        bytes32 uid = UIDGenerator.generateSchemaUID(definition, resolver, revocable);

        // 2. Check for duplicate
        if (_schemas[uid].timestamp != 0) {
            revert SchemaAlreadyExists(uid);
        }

        // 3. Validate resolver implements IResolver (if provided)
        if (resolver != address(0)) {
            _checkResolver(resolver);
        }

        // 4. Store schema record
        _schemas[uid] = SchemaRecord({
            uid: uid,
            definition: definition,
            authority: msg.sender,
            resolver: resolver,
            revocable: revocable,
            timestamp: uint64(block.timestamp)
        });

        // 5. Emit event
        emit SchemaRegistered(uid, msg.sender, resolver);

        return uid;
    }

    /**
     * @notice Retrieve a schema by its UID.
     * @param uid  The schema UID to look up.
     * @return record  The full schema record.
     */
    function getSchema(bytes32 uid) external view returns (SchemaRecord memory) {
        SchemaRecord memory record = _schemas[uid];
        if (record.timestamp == 0) {
            revert SchemaNotFound(uid);
        }
        return record;
    }
}
