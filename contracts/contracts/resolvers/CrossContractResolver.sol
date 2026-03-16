// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IResolver} from "../IResolver.sol";

/**
 * @title CrossContractResolver
 * @notice Pipeline resolver that chains multiple resolver contracts in sequence.
 *         All resolvers in the pipeline must approve for the attestation to proceed.
 *         If any resolver rejects, the entire attestation is rejected.
 *
 *         Example pipeline: WhitelistResolver → FeeResolver → TokenGatedResolver
 *         This allows combining multiple validation steps in a single resolver.
 */
contract CrossContractResolver is IResolver {
    address public owner;

    /// @dev Ordered list of resolver addresses to call in sequence.
    address[] public pipeline;

    error NotOwner();
    error EmptyPipeline();
    error ZeroAddress();
    error ResolverFailed(address resolver, uint256 index);

    event PipelineConfigured(address[] resolvers);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @param _resolvers  Initial ordered list of resolver addresses.
     */
    constructor(address[] memory _resolvers) {
        if (_resolvers.length == 0) revert EmptyPipeline();
        owner = msg.sender;
        for (uint256 i = 0; i < _resolvers.length; i++) {
            if (_resolvers[i] == address(0)) revert ZeroAddress();
        }
        pipeline = _resolvers;
        emit PipelineConfigured(_resolvers);
    }

    /// @notice Replace the entire pipeline with a new set of resolvers.
    function setPipeline(address[] calldata _resolvers) external onlyOwner {
        if (_resolvers.length == 0) revert EmptyPipeline();
        for (uint256 i = 0; i < _resolvers.length; i++) {
            if (_resolvers[i] == address(0)) revert ZeroAddress();
        }
        pipeline = _resolvers;
        emit PipelineConfigured(_resolvers);
    }

    /// @notice Get the current pipeline length.
    function pipelineLength() external view returns (uint256) {
        return pipeline.length;
    }

    /// @notice Get the full pipeline as an array.
    function getPipeline() external view returns (address[] memory) {
        return pipeline;
    }

    /// @inheritdoc IResolver
    function onAttest(
        bytes32 schemaUid,
        address attester,
        address subject,
        bytes calldata data
    ) external override returns (bool) {
        for (uint256 i = 0; i < pipeline.length; i++) {
            try IResolver(pipeline[i]).onAttest(schemaUid, attester, subject, data) returns (bool allowed) {
                if (!allowed) return false;
            } catch {
                return false;
            }
        }
        return true;
    }

    /// @inheritdoc IResolver
    function onRevoke(bytes32 attestationUid, address revoker) external override returns (bool) {
        for (uint256 i = 0; i < pipeline.length; i++) {
            try IResolver(pipeline[i]).onRevoke(attestationUid, revoker) returns (bool allowed) {
                if (!allowed) return false;
            } catch {
                return false;
            }
        }
        return true;
    }

    /// @inheritdoc IResolver
    function onResolve(
        bytes32 schemaUid,
        address attester,
        address subject,
        bytes calldata data
    ) external override {
        for (uint256 i = 0; i < pipeline.length; i++) {
            try IResolver(pipeline[i]).onResolve(schemaUid, attester, subject, data) {} catch {}
        }
    }

    /// @inheritdoc IResolver
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IResolver).interfaceId ||
               interfaceId == 0x01ffc9a7; // ERC-165
    }
}
