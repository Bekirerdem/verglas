// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @notice The ICM payload Verglas carries across chains: a proof-backed
///         attestation issued by the Hub on C-Chain, consumed by a VerglasGate
///         on a destination L1. abi.encode/abi.decode on both ends.
struct AttestationPacket {
    uint256 agentId;
    bytes32 requestHash;
    uint256 finalCommitment;
    uint256 txCount;
    uint8 score;
    uint64 issuedAt;
}
