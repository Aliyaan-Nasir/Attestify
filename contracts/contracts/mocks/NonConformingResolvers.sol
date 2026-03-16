// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FalseSupportsInterfaceResolver
 * @notice Has supportsInterface but returns false for IResolver interface ID.
 */
contract FalseSupportsInterfaceResolver {
    function supportsInterface(bytes4) external pure returns (bool) {
        return false;
    }

    function onAttest(bytes32, address, address, bytes calldata) external pure returns (bool) {
        return true;
    }

    function onRevoke(bytes32, address) external pure returns (bool) {
        return true;
    }
}

/**
 * @title PartialResolver
 * @notice Implements supportsInterface returning true for ERC-165 only, not IResolver.
 */
contract PartialResolver {
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7; // ERC-165 only
    }
}

/**
 * @title RevertingSupportsInterfaceResolver
 * @notice supportsInterface always reverts.
 */
contract RevertingSupportsInterfaceResolver {
    function supportsInterface(bytes4) external pure returns (bool) {
        revert("not supported");
    }
}

/**
 * @title EmptyContract
 * @notice A contract with no functions at all.
 */
contract EmptyContract {}
