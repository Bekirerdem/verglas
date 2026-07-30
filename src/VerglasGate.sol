// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {ITeleporterReceiver} from "./interfaces/ITeleporterReceiver.sol";
import {AttestationPacket} from "./AttestationPacket.sol";

/// @title VerglasGate — the border checkpoint an Avalanche L1 installs
/// @notice A Gate receives proof-backed attestations carried from the Verglas
///         Hub on C-Chain via ICM and answers one question for local contracts:
///         `isCleared(agentId)` — does this agent hold a fresh, sufficient
///         attestation? All trust parameters are fixed at deployment by the L1
///         operator; the Gate has no owner and no setters.
/// @dev Message authenticity rests on three checks (the ICTT receiver pattern):
///      the caller must be the canonical Teleporter messenger, the message must
///      originate from the Hub's blockchain, and the original sender must be
///      the Hub contract itself.
contract VerglasGate is ITeleporterReceiver {
    struct CarriedAttestation {
        /// @notice The vault on the Hub chain that this clearance was proven for.
        ///         Local contracts that care about a specific vault (rather than
        ///         the identity alone) must check this: an identity can be rebound
        ///         to another vault on the Hub, and a carried packet cannot be
        ///         recalled — it only ages out.
        address account;
        bytes32 requestHash;
        uint256 finalCommitment;
        uint256 txCount;
        uint8 score;
        uint64 issuedAt;
    }

    address public immutable teleporter;
    bytes32 public immutable hubBlockchainID;
    address public immutable hub;
    /// @notice Minimum attestation score this L1 accepts.
    uint8 public immutable minScore;
    /// @notice How long an attestation stays valid past its Hub issuance time.
    /// @dev Freshness compares this chain's clock against the Hub chain's
    ///      timestamp; cross-chain clock drift is seconds, maxAge is hours+.
    uint64 public immutable maxAge;

    mapping(uint256 => CarriedAttestation) public attestationOf;

    event AttestationReceived(
        uint256 indexed agentId, bytes32 indexed requestHash, address indexed account, uint8 score, uint64 issuedAt
    );

    error OnlyTeleporter();
    error WrongSourceChain();
    error OnlyHub();
    error StaleAttestation();

    constructor(address teleporter_, bytes32 hubBlockchainID_, address hub_, uint8 minScore_, uint64 maxAge_) {
        teleporter = teleporter_;
        hubBlockchainID = hubBlockchainID_;
        hub = hub_;
        minScore = minScore_;
        maxAge = maxAge_;
    }

    /// @inheritdoc ITeleporterReceiver
    /// @dev ICM gives no ordering guarantee, so a packet older than the one
    ///      already stored is rejected rather than allowed to roll state back.
    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message)
        external
    {
        if (msg.sender != teleporter) revert OnlyTeleporter();
        if (sourceBlockchainID != hubBlockchainID) revert WrongSourceChain();
        if (originSenderAddress != hub) revert OnlyHub();

        AttestationPacket memory packet = abi.decode(message, (AttestationPacket));
        CarriedAttestation storage att = attestationOf[packet.agentId];
        if (packet.issuedAt <= att.issuedAt) revert StaleAttestation();

        att.account = packet.account;
        att.requestHash = packet.requestHash;
        att.finalCommitment = packet.finalCommitment;
        att.txCount = packet.txCount;
        att.score = packet.score;
        att.issuedAt = packet.issuedAt;

        emit AttestationReceived(packet.agentId, packet.requestHash, packet.account, packet.score, packet.issuedAt);
    }

    /// @notice True when the agent holds an attestation meeting this L1's
    ///         score threshold that has not aged out.
    function isCleared(uint256 agentId) external view returns (bool) {
        CarriedAttestation storage att = attestationOf[agentId];
        return att.issuedAt != 0 && att.score >= minScore && block.timestamp <= uint256(att.issuedAt) + maxAge;
    }

    /// @notice The strict form: cleared AND proven for this exact vault. A local
    ///         contract extending trust to funds held in a specific vault should
    ///         ask this, because an identity's binding can change on the Hub after
    ///         the attestation was carried here.
    function isClearedFor(uint256 agentId, address account) external view returns (bool) {
        CarriedAttestation storage att = attestationOf[agentId];
        return att.account == account && att.issuedAt != 0 && att.score >= minScore
            && block.timestamp <= uint256(att.issuedAt) + maxAge;
    }
}
