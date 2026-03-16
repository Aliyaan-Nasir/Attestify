// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IResolver} from "../IResolver.sol";

/**
 * @title MockResolver
 * @notice Test helper that implements IResolver. Configurable to accept or reject.
 */
contract MockResolver is IResolver {
    bool public shouldAllow;

    constructor(bool _shouldAllow) {
        shouldAllow = _shouldAllow;
    }

    function setShouldAllow(bool _val) external {
        shouldAllow = _val;
    }

    function onAttest(bytes32, address, address, bytes calldata) external view override returns (bool) {
        return shouldAllow;
    }

    function onRevoke(bytes32, address) external view override returns (bool) {
        return shouldAllow;
    }

    function onResolve(bytes32, address, address, bytes calldata) external override {
        // no-op for testing
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IResolver).interfaceId ||
               interfaceId == 0x01ffc9a7; // ERC-165
    }
}

/**
 * @title BadResolver
 * @notice Test helper that does NOT implement IResolver (no supportsInterface).
 */
contract BadResolver {
    function doNothing() external pure returns (bool) {
        return true;
    }
}
