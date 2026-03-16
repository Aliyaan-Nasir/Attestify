// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UIDGenerator} from "./libraries/UIDGenerator.sol";
import {IResolver} from "./IResolver.sol";
import {SchemaRegistry} from "./SchemaRegistry.sol";
import {
    AttestationNotFound,
    AttestationAlreadyRevoked,
    AttestationExpired,
    SchemaNotRevocable,
    UnauthorizedRevoker,
    ResolverRejected,
    Unauthorized,
    AuthorityNotFound,
    InvalidExpirationTime,
    NotDelegate,
    DelegateAlreadyAdded,
    DelegateNotFound
} from "./Errors.sol";

/**
 * @title AttestationService
 * @notice Core attestation lifecycle: create, revoke, verify.
 *         Also manages authority registration and verification.
 *
 *         Mirrors the Stellar attestation flow translated to Solidity:
 *         1. Validate schema exists (via SchemaRegistry)
 *         2. Call resolver onAttest hook (if schema has resolver)
 *         3. Compute deterministic UID from inputs + per-attester nonce
 *         4. Store attestation record
 *         5. Emit event
 */
contract AttestationService {
    using UIDGenerator for *;

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct AttestationRecord {
        bytes32 uid;
        bytes32 schemaUid;
        address attester;
        address subject;
        bytes data;
        uint64 timestamp;
        uint64 expirationTime;
        bool revoked;
        uint64 revocationTime;
        uint256 nonce;
    }

    struct AuthorityRecord {
        address addr;
        string metadata;
        bool isVerified;
        uint64 registeredAt;
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    event AttestationCreated(
        bytes32 indexed uid,
        bytes32 indexed schemaUid,
        address indexed attester,
        address subject
    );

    event AttestationRevoked(bytes32 indexed uid, address indexed revoker);

    event AuthorityRegistered(address indexed authority);

    event DelegateAdded(address indexed authority, address indexed delegate);
    event DelegateRemoved(address indexed authority, address indexed delegate);

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice Reference to the SchemaRegistry for schema lookups.
    SchemaRegistry public immutable schemaRegistry;

    /// @notice Contract deployer — used for authority verification admin.
    address public immutable admin;

    /// @dev Attestation UID → AttestationRecord
    mapping(bytes32 => AttestationRecord) private _attestations;

    /// @dev Per-attester nonce counter for UID uniqueness.
    mapping(address => uint256) private _nonces;

    /// @dev Authority address → AuthorityRecord
    mapping(address => AuthorityRecord) private _authorities;

    /// @dev Authority → delegate → authorized
    mapping(address => mapping(address => bool)) private _delegates;

    /// @dev Authority → list of delegate addresses
    mapping(address => address[]) private _delegateList;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _schemaRegistry Address of the deployed SchemaRegistry contract.
     */
    constructor(address _schemaRegistry) {
        schemaRegistry = SchemaRegistry(_schemaRegistry);
        admin = msg.sender;
    }

    // ─── Attestation Functions ───────────────────────────────────────────────

    /**
     * @notice Create an on-chain attestation.
     * @param schemaUid       The schema this attestation references.
     * @param subject         The subject of the attestation.
     * @param data            The attestation payload (ABI-encoded).
     * @param expirationTime  Optional expiration timestamp (0 for none).
     * @return uid            The deterministic attestation UID.
     */
    function attest(
        bytes32 schemaUid,
        address subject,
        bytes calldata data,
        uint64 expirationTime
    ) external returns (bytes32) {
        // 1. Validate schema exists (reverts with SchemaNotFound if missing)
        SchemaRegistry.SchemaRecord memory schema = schemaRegistry.getSchema(schemaUid);

        // 2. Validate expiration time if provided
        if (expirationTime != 0 && expirationTime <= uint64(block.timestamp)) {
            revert InvalidExpirationTime(expirationTime);
        }

        // 3. Call resolver onAttest hook (if schema has resolver)
        if (schema.resolver != address(0)) {
            bool allowed = IResolver(schema.resolver).onAttest(
                schemaUid,
                msg.sender,
                subject,
                data
            );
            if (!allowed) {
                revert ResolverRejected(schema.resolver);
            }
        }

        // 4. Get and increment per-attester nonce
        uint256 nonce = _nonces[msg.sender];
        _nonces[msg.sender] = nonce + 1;

        // 5. Compute deterministic UID
        bytes32 uid = UIDGenerator.generateAttestationUID(
            schemaUid,
            subject,
            msg.sender,
            data,
            nonce
        );

        // 6. Store attestation record
        _attestations[uid] = AttestationRecord({
            uid: uid,
            schemaUid: schemaUid,
            attester: msg.sender,
            subject: subject,
            data: data,
            timestamp: uint64(block.timestamp),
            expirationTime: expirationTime,
            revoked: false,
            revocationTime: 0,
            nonce: nonce
        });

        // 7. Emit event
        emit AttestationCreated(uid, schemaUid, msg.sender, subject);

        // 8. Call resolver onResolve post-hook for side-effects (non-reverting)
        if (schema.resolver != address(0)) {
            try IResolver(schema.resolver).onResolve(schemaUid, msg.sender, subject, data) {} catch {}
        }

        return uid;
    }

    /**
     * @notice Revoke an existing attestation.
     * @param attestationUid  The UID of the attestation to revoke.
     */
    function revoke(bytes32 attestationUid) external {
        AttestationRecord storage record = _attestations[attestationUid];

        // 1. Check attestation exists
        if (record.timestamp == 0) {
            revert AttestationNotFound(attestationUid);
        }

        // 2. Check not already revoked
        if (record.revoked) {
            revert AttestationAlreadyRevoked(attestationUid);
        }

        // 3. Check caller is the original attester
        if (msg.sender != record.attester) {
            revert UnauthorizedRevoker(msg.sender, record.attester);
        }

        // 4. Check schema is revocable
        SchemaRegistry.SchemaRecord memory schema = schemaRegistry.getSchema(record.schemaUid);
        if (!schema.revocable) {
            revert SchemaNotRevocable(record.schemaUid);
        }

        // 5. Call resolver onRevoke hook (if schema has resolver)
        if (schema.resolver != address(0)) {
            bool allowed = IResolver(schema.resolver).onRevoke(
                attestationUid,
                msg.sender
            );
            if (!allowed) {
                revert ResolverRejected(schema.resolver);
            }
        }

        // 6. Update state
        record.revoked = true;
        record.revocationTime = uint64(block.timestamp);

        // 7. Emit event
        emit AttestationRevoked(attestationUid, msg.sender);

        // 8. Call resolver onResolve post-hook for side-effects (non-reverting)
        if (schema.resolver != address(0)) {
            try IResolver(schema.resolver).onResolve(
                record.schemaUid, msg.sender, record.subject, record.data
            ) {} catch {}
        }
    }

    /**
     * @notice Retrieve an attestation by its UID.
     * @param uid  The attestation UID to look up.
     * @return record  The full attestation record.
     */
    function getAttestation(bytes32 uid) external view returns (AttestationRecord memory) {
        AttestationRecord memory record = _attestations[uid];
        if (record.timestamp == 0) {
            revert AttestationNotFound(uid);
        }
        // Check expiration — mirrors Stellar's get_attestation_record behaviour.
        // Record stays in storage (read-only, no side-effects) but callers
        // are told the attestation is no longer valid.
        if (record.expirationTime != 0 && uint64(block.timestamp) > record.expirationTime) {
            revert AttestationExpired(uid);
        }
        return record;
    }

    // ─── Authority Functions ─────────────────────────────────────────────────

    /**
     * @notice Register the caller as an authority.
     * @param metadata  Descriptive metadata for the authority.
     */
    function registerAuthority(string calldata metadata) external {
        _authorities[msg.sender] = AuthorityRecord({
            addr: msg.sender,
            metadata: metadata,
            isVerified: false,
            registeredAt: uint64(block.timestamp)
        });

        emit AuthorityRegistered(msg.sender);
    }

    /**
     * @notice Retrieve an authority record by address.
     * @param addr  The authority address to look up.
     * @return record  The full authority record.
     */
    function getAuthority(address addr) external view returns (AuthorityRecord memory) {
        AuthorityRecord memory record = _authorities[addr];
        if (record.registeredAt == 0) {
            revert AuthorityNotFound(addr);
        }
        return record;
    }

    /**
     * @notice Set the verification status of an authority. Admin only.
     * @param addr      The authority address.
     * @param verified  The new verification status.
     */
    function setAuthorityVerification(address addr, bool verified) external {
        if (msg.sender != admin) {
            revert Unauthorized(msg.sender);
        }
        if (_authorities[addr].registeredAt == 0) {
            revert AuthorityNotFound(addr);
        }
        _authorities[addr].isVerified = verified;
    }

    // ─── Delegation Functions ────────────────────────────────────────────────

    /**
     * @notice Add a delegate who can create attestations on behalf of the caller.
     * @param delegate  The address to authorize as a delegate.
     */
    function addDelegate(address delegate) external {
        if (_delegates[msg.sender][delegate]) {
            revert DelegateAlreadyAdded(delegate);
        }
        _delegates[msg.sender][delegate] = true;
        _delegateList[msg.sender].push(delegate);
        emit DelegateAdded(msg.sender, delegate);
    }

    /**
     * @notice Remove a delegate.
     * @param delegate  The address to remove from delegates.
     */
    function removeDelegate(address delegate) external {
        if (!_delegates[msg.sender][delegate]) {
            revert DelegateNotFound(delegate);
        }
        _delegates[msg.sender][delegate] = false;
        // Remove from list
        address[] storage list = _delegateList[msg.sender];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == delegate) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
        emit DelegateRemoved(msg.sender, delegate);
    }

    /**
     * @notice Check if an address is a delegate of an authority.
     * @param authority  The authority address.
     * @param delegate   The delegate address to check.
     * @return True if the delegate is authorized.
     */
    function isDelegate(address authority, address delegate) external view returns (bool) {
        return _delegates[authority][delegate];
    }

    /**
     * @notice Get all delegates for an authority.
     * @param authority  The authority address.
     * @return List of delegate addresses.
     */
    function getDelegates(address authority) external view returns (address[] memory) {
        return _delegateList[authority];
    }

    /**
     * @notice Create an attestation on behalf of an authority (delegated attestation).
     *         The caller must be an authorized delegate of the authority.
     *         The attestation is recorded as coming from the authority, not the delegate.
     * @param authority       The authority on whose behalf the attestation is created.
     * @param schemaUid       The schema this attestation references.
     * @param subject         The subject of the attestation.
     * @param data            The attestation payload (ABI-encoded).
     * @param expirationTime  Optional expiration timestamp (0 for none).
     * @return uid            The deterministic attestation UID.
     */
    function attestOnBehalf(
        address authority,
        bytes32 schemaUid,
        address subject,
        bytes calldata data,
        uint64 expirationTime
    ) external returns (bytes32) {
        // 1. Verify caller is a delegate of the authority
        if (!_delegates[authority][msg.sender]) {
            revert NotDelegate(msg.sender, authority);
        }

        // 2. Validate schema exists
        SchemaRegistry.SchemaRecord memory schema = schemaRegistry.getSchema(schemaUid);

        // 3. Validate expiration time if provided
        if (expirationTime != 0 && expirationTime <= uint64(block.timestamp)) {
            revert InvalidExpirationTime(expirationTime);
        }

        // 4. Call resolver onAttest hook (attester is the authority, not the delegate)
        if (schema.resolver != address(0)) {
            bool allowed = IResolver(schema.resolver).onAttest(
                schemaUid,
                authority,
                subject,
                data
            );
            if (!allowed) {
                revert ResolverRejected(schema.resolver);
            }
        }

        // 5. Get and increment per-authority nonce (uses authority's nonce, not delegate's)
        uint256 nonce = _nonces[authority];
        _nonces[authority] = nonce + 1;

        // 6. Compute deterministic UID
        bytes32 uid = UIDGenerator.generateAttestationUID(
            schemaUid,
            subject,
            authority,
            data,
            nonce
        );

        // 7. Store attestation record (attester = authority)
        _attestations[uid] = AttestationRecord({
            uid: uid,
            schemaUid: schemaUid,
            attester: authority,
            subject: subject,
            data: data,
            timestamp: uint64(block.timestamp),
            expirationTime: expirationTime,
            revoked: false,
            revocationTime: 0,
            nonce: nonce
        });

        // 8. Emit event (attester = authority)
        emit AttestationCreated(uid, schemaUid, authority, subject);

        // 9. Post-hook
        if (schema.resolver != address(0)) {
            try IResolver(schema.resolver).onResolve(schemaUid, authority, subject, data) {} catch {}
        }

        return uid;
    }

    /**
     * @notice Revoke an attestation on behalf of the original attester (delegated revocation).
     *         The caller must be an authorized delegate of the original attester.
     * @param attestationUid  The UID of the attestation to revoke.
     */
    function revokeOnBehalf(bytes32 attestationUid) external {
        AttestationRecord storage record = _attestations[attestationUid];

        // 1. Check attestation exists
        if (record.timestamp == 0) {
            revert AttestationNotFound(attestationUid);
        }

        // 2. Check not already revoked
        if (record.revoked) {
            revert AttestationAlreadyRevoked(attestationUid);
        }

        // 3. Check caller is a delegate of the original attester
        if (!_delegates[record.attester][msg.sender]) {
            revert NotDelegate(msg.sender, record.attester);
        }

        // 4. Check schema is revocable
        SchemaRegistry.SchemaRecord memory schema = schemaRegistry.getSchema(record.schemaUid);
        if (!schema.revocable) {
            revert SchemaNotRevocable(record.schemaUid);
        }

        // 5. Call resolver onRevoke hook
        if (schema.resolver != address(0)) {
            bool allowed = IResolver(schema.resolver).onRevoke(
                attestationUid,
                record.attester
            );
            if (!allowed) {
                revert ResolverRejected(schema.resolver);
            }
        }

        // 6. Update state
        record.revoked = true;
        record.revocationTime = uint64(block.timestamp);

        // 7. Emit event (revoker = original attester for consistency)
        emit AttestationRevoked(attestationUid, record.attester);

        // 8. Post-hook
        if (schema.resolver != address(0)) {
            try IResolver(schema.resolver).onResolve(
                record.schemaUid, record.attester, record.subject, record.data
            ) {} catch {}
        }
    }
}
