// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IResolver} from "../IResolver.sol";

/**
 * @title WhitelistResolver
 * @notice Resolver that only allows attestations from whitelisted attester addresses.
 *         The contract owner can add or remove addresses from the whitelist.
 */
contract WhitelistResolver is IResolver {
    address public owner;
    mapping(address => bool) public whitelisted;

    error NotOwner();
    error ZeroAddress();

    event AddressAdded(address indexed account);
    event AddressRemoved(address indexed account);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Add an address to the whitelist.
    function addAddress(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        whitelisted[account] = true;
        emit AddressAdded(account);
    }

    /// @notice Remove an address from the whitelist.
    function removeAddress(address account) external onlyOwner {
        whitelisted[account] = false;
        emit AddressRemoved(account);
    }

    /// @inheritdoc IResolver
    function onAttest(
        bytes32,
        address attester,
        address,
        bytes calldata
    ) external view override returns (bool) {
        return whitelisted[attester];
    }

    /// @inheritdoc IResolver
    function onRevoke(bytes32, address) external pure override returns (bool) {
        return true;
    }

    /// @inheritdoc IResolver
    function onResolve(bytes32, address, address, bytes calldata) external override {
        // no-op
    }

    /// @inheritdoc IResolver
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IResolver).interfaceId ||
               interfaceId == 0x01ffc9a7; // ERC-165
    }
}
