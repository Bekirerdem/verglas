// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @notice The ICM payload Verglas carries across chains: a proof-backed
///         attestation issued by the Hub on C-Chain, consumed by a VerglasGate
///         on a destination L1. abi.encode/abi.decode on both ends.
struct AttestationPacket {
    uint256 agentId;
    /// @dev The vault this attestation certifies. An identity may later be
    ///      rebound to a different vault, and a carried packet cannot be
    ///      recalled — so the packet states WHICH vault was proven, letting a
    ///      consumer on the destination chain check it against the vault it
    ///      actually cares about instead of trusting the agentId alone.
    address account;
    bytes32 requestHash;
    uint256 finalCommitment;
    uint256 txCount;
    uint8 score;
    uint64 issuedAt;
}
