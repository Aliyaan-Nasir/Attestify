// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IResolver} from "../IResolver.sol";

/**
 * @title TokenGatedResolver
 * @notice Resolver that gates attestations behind HTS token ownership.
 *         Uses the Hedera HTS precompile at 0x167 to query token balances
 *         via the Hedera-native precompiled contract rather than EVM-standard
 *         ERC-20 interfaces.
 */
contract TokenGatedResolver is IResolver {
    /// @notice Hedera Token Service precompile address.
    address private constant HTS_PRECOMPILE = address(0x167);

    address public owner;
    address public tokenAddress;
    uint256 public minimumBalance;

    error NotOwner();
    error ZeroAddress();
    error InsufficientTokenBalance(address attester, uint256 balance, uint256 required);
    error TokenBalanceQueryFailed();

    event TokenConfigured(address indexed token, uint256 minimumBalance);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @param _tokenAddress   The HTS token address to check balances for.
     * @param _minimumBalance The minimum token balance required to attest.
     */
    constructor(address _tokenAddress, uint256 _minimumBalance) {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        owner = msg.sender;
        tokenAddress = _tokenAddress;
        minimumBalance = _minimumBalance;
        emit TokenConfigured(_tokenAddress, _minimumBalance);
    }

    /// @notice Update the token address and minimum balance requirement.
    function setTokenConfig(address _tokenAddress, uint256 _minimumBalance) external onlyOwner {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        tokenAddress = _tokenAddress;
        minimumBalance = _minimumBalance;
        emit TokenConfigured(_tokenAddress, _minimumBalance);
    }

    /// @inheritdoc IResolver
    function onAttest(
        bytes32,
        address attester,
        address,
        bytes calldata
    ) external override returns (bool) {
        uint256 balance = _queryTokenBalance(attester);
        if (balance < minimumBalance) {
            revert InsufficientTokenBalance(attester, balance, minimumBalance);
        }
        return true;
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

    /**
     * @dev Queries the attester's HTS token balance using the HTS precompile.
     *      Calls `balanceOf(address)` on the token address via the precompile
     *      redirect mechanism. On Hedera, HTS tokens expose an ERC-20-compatible
     *      `balanceOf` at the token's own address through the precompile system.
     */
    function _queryTokenBalance(address account) internal returns (uint256) {
        // On Hedera, HTS fungible tokens are accessible via their Solidity address
        // which redirects through the HTS precompile. We call balanceOf directly
        // on the token address, which the HTS system contract handles.
        (bool success, bytes memory result) = tokenAddress.call(
            abi.encodeWithSignature("balanceOf(address)", account)
        );
        if (!success || result.length < 32) {
            revert TokenBalanceQueryFailed();
        }
        return abi.decode(result, (uint256));
    }
}
