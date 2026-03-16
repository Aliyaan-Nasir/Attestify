// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IResolver} from "../IResolver.sol";

/**
 * @title FeeResolver
 * @notice Resolver that collects a configurable HBAR fee from the attester
 *         before allowing attestation. Attesters deposit HBAR into this
 *         contract (via `deposit()` or direct transfer), and `onAttest`
 *         deducts the fee from their balance. The owner can withdraw
 *         collected fees.
 */
contract FeeResolver is IResolver {
    address public owner;
    uint256 public fee;

    /// @dev Tracks deposited balances per attester.
    mapping(address => uint256) public balances;

    error NotOwner();
    error InsufficientFee(uint256 available, uint256 required);
    error WithdrawFailed();
    error NothingToWithdraw();

    event FeeUpdated(uint256 newFee);
    event FeeCollected(address indexed attester, uint256 amount);
    event Deposited(address indexed attester, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @param _fee The HBAR fee in wei required per attestation.
     */
    constructor(uint256 _fee) {
        owner = msg.sender;
        fee = _fee;
        emit FeeUpdated(_fee);
    }

    /// @notice Update the required fee. Only callable by the owner.
    function setFee(uint256 _fee) external onlyOwner {
        fee = _fee;
        emit FeeUpdated(_fee);
    }

    /// @notice Deposit HBAR to cover future attestation fees.
    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @inheritdoc IResolver
    function onAttest(
        bytes32,
        address attester,
        address,
        bytes calldata
    ) external override returns (bool) {
        if (balances[attester] < fee) {
            revert InsufficientFee(balances[attester], fee);
        }
        balances[attester] -= fee;
        emit FeeCollected(attester, fee);
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

    /// @notice Withdraw all collected fees to the owner.
    function withdraw() external onlyOwner {
        uint256 collected = address(this).balance;
        if (collected == 0) revert NothingToWithdraw();
        (bool success, ) = owner.call{value: collected}("");
        if (!success) revert WithdrawFailed();
        emit Withdrawn(owner, collected);
    }

    /// @notice Withdraw a specific amount to the owner.
    function withdrawAmount(uint256 amount) external onlyOwner {
        (bool success, ) = owner.call{value: amount}("");
        if (!success) revert WithdrawFailed();
        emit Withdrawn(owner, amount);
    }

    /// @notice Allow direct HBAR transfers to count as deposits for the sender.
    receive() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
