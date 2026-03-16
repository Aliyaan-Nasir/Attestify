// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IResolver} from "../IResolver.sol";

/**
 * @title TokenRewardResolver
 * @notice Resolver that rewards the attestation subject with HTS tokens
 *         when an attestation is created. The owner configures which token
 *         to reward and how many tokens per attestation.
 *
 *         Uses the Hedera Token Service (HTS) precompile at 0x167 to
 *         transfer fungible tokens. The contract must hold a sufficient
 *         token balance and be associated with the token.
 */
contract TokenRewardResolver is IResolver {
    /// @notice Hedera Token Service precompile address.
    address private constant HTS_PRECOMPILE = address(0x167);

    address public owner;
    address public rewardToken;
    uint256 public rewardAmount;

    /// @dev Tracks total rewards distributed per subject.
    mapping(address => uint256) public rewardsDistributed;

    error NotOwner();
    error ZeroAddress();
    error TransferFailed();

    event RewardConfigured(address indexed token, uint256 amount);
    event RewardDistributed(address indexed subject, address indexed token, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @param _rewardToken   The HTS fungible token address to reward.
     * @param _rewardAmount  The number of tokens to reward per attestation.
     */
    constructor(address _rewardToken, uint256 _rewardAmount) {
        if (_rewardToken == address(0)) revert ZeroAddress();
        owner = msg.sender;
        rewardToken = _rewardToken;
        rewardAmount = _rewardAmount;
        emit RewardConfigured(_rewardToken, _rewardAmount);
    }

    /// @notice Update the reward token and amount.
    function setRewardConfig(address _rewardToken, uint256 _rewardAmount) external onlyOwner {
        if (_rewardToken == address(0)) revert ZeroAddress();
        rewardToken = _rewardToken;
        rewardAmount = _rewardAmount;
        emit RewardConfigured(_rewardToken, _rewardAmount);
    }

    /// @inheritdoc IResolver
    function onAttest(
        bytes32,
        address,
        address,
        bytes calldata
    ) external pure override returns (bool) {
        // Always allow — reward is distributed in onResolve post-hook
        return true;
    }

    /// @inheritdoc IResolver
    function onRevoke(bytes32, address) external pure override returns (bool) {
        return true;
    }

    /**
     * @inheritdoc IResolver
     * @notice Distributes reward tokens to the subject after attestation.
     *         Uses HTS precompile transferToken function.
     *         Failures here do NOT revert the attestation.
     */
    function onResolve(
        bytes32,
        address,
        address subject,
        bytes calldata
    ) external override {
        if (rewardAmount == 0 || rewardToken == address(0)) return;

        // HTS precompile: transferToken(address token, address from, address to, int64 amount)
        // Function selector: 0x15dacbea
        (bool success, bytes memory result) = HTS_PRECOMPILE.call(
            abi.encodeWithSelector(
                bytes4(0x15dacbea),
                rewardToken,
                address(this),
                subject,
                int64(int256(rewardAmount))
            )
        );

        if (success && result.length >= 32) {
            int32 responseCode = abi.decode(result, (int32));
            if (responseCode == 22) { // SUCCESS
                rewardsDistributed[subject] += rewardAmount;
                emit RewardDistributed(subject, rewardToken, rewardAmount);
            }
        }
    }

    /// @inheritdoc IResolver
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IResolver).interfaceId ||
               interfaceId == 0x01ffc9a7; // ERC-165
    }
}
