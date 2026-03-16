// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IResolver} from "../IResolver.sol";

/**
 * @title RevertingOnResolveResolver
 * @notice Test helper: allows onAttest/onRevoke but reverts on onResolve.
 *         Used to verify that onResolve failures don't revert the main operation.
 */
contract RevertingOnResolveResolver is IResolver {
    function onAttest(bytes32, address, address, bytes calldata) external pure override returns (bool) {
        return true;
    }

    function onRevoke(bytes32, address) external pure override returns (bool) {
        return true;
    }

    function onResolve(bytes32, address, address, bytes calldata) external pure override {
        revert("onResolve intentional revert");
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IResolver).interfaceId || interfaceId == 0x01ffc9a7;
    }
}
