// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {VerglasAccount} from "./VerglasAccount.sol";
import {ValidationRegistry, IIdentityRegistry} from "./ValidationRegistry.sol";
import {Groth16Verifier} from "./Groth16Verifier.sol";
import {AttestationPacket} from "./AttestationPacket.sol";
import {ITeleporterMessenger, TeleporterMessageInput, TeleporterFeeInfo} from "./interfaces/ITeleporterMessenger.sol";

/// @title VerglasHub — the trustless validator behind Verglas attestations
/// @notice The Hub cannot vouch for anyone by choice: a validation response can
///         only be written after (1) the proof's public inputs are bound to the
///         live VerglasAccount state and (2) the Groth16 proof verifies on-chain.
///         Anyone may submit a proof — the attestation is objective.
/// @dev Public signal layout of circuit #1 (policy_compliance, N=64, WL=8):
///        [0] initialCommitment  [1] finalCommitment  [2] txCount
///        [3..10] whitelist      [11] perTxLimit
contract VerglasHub {
    struct Checkpoint {
        uint256 commitment;
        uint256 txCount;
    }

    struct Attestation {
        bytes32 requestHash;
        uint256 finalCommitment;
        uint256 txCount;
        uint8 score;
        uint64 issuedAt;
    }

    string public constant TAG = "verglas:policy-compliance";

    /// @dev Gas the destination Gate needs to decode and store a packet;
    ///      generous headroom over the ~130K a cold-storage receive costs.
    uint256 public constant CARRY_GAS_LIMIT = 250_000;

    ValidationRegistry public immutable registry;
    /// @dev Held directly, not resolved through the validation registry: the
    ///      canonical ERC-8004 Validation Registry exposes the link as
    ///      getIdentityRegistry() while our own deploy uses an immutable getter —
    ///      binding must not depend on either ABI (found live on Fuji: the
    ///      indirect call made every bindAccount revert).
    IIdentityRegistry public immutable identityRegistry;
    Groth16Verifier public immutable verifier;
    ITeleporterMessenger public immutable teleporter;

    mapping(uint256 => address) public accountOf;
    mapping(address => Checkpoint) public checkpoints;
    mapping(uint256 => Attestation) public latestAttestation;

    event AccountBound(uint256 indexed agentId, address indexed account);
    event AttestationIssued(
        uint256 indexed agentId, bytes32 indexed requestHash, uint256 finalCommitment, uint256 txCount
    );
    event AttestationCarried(
        uint256 indexed agentId, bytes32 indexed destinationBlockchainID, address gate, bytes32 messageID
    );

    error NotAccountOwner();
    error NotIdentityOwner();
    error NoBoundAccount();
    error BadInitialCommitment();
    error BadFinalCommitment();
    error BadTxCount();
    error BadPolicyBinding();
    error InvalidProof();
    error NoAttestation();

    constructor(
        ValidationRegistry registry_,
        IIdentityRegistry identityRegistry_,
        Groth16Verifier verifier_,
        ITeleporterMessenger teleporter_
    ) {
        registry = registry_;
        identityRegistry = identityRegistry_;
        verifier = verifier_;
        teleporter = teleporter_;
    }

    /// @notice Links an agent identity (ERC-8004 agentId) to its VerglasAccount.
    /// @dev The caller must own BOTH sides of the binding: the ERC-8004 identity
    ///      (so nobody can bind or overwrite an agentId they don't hold) and the
    ///      account (so the identity points only at a vault its owner controls).
    ///      Without the identity check any account owner could hijack an agentId's
    ///      attestation by rebinding accountOf[agentId] to their own vault.
    function bindAccount(uint256 agentId, address account) external {
        if (msg.sender != identityRegistry.ownerOf(agentId)) revert NotIdentityOwner();
        if (msg.sender != VerglasAccount(account).owner()) revert NotAccountOwner();
        accountOf[agentId] = account;
        emit AccountBound(agentId, account);
    }

    /// @notice Verifies a policy-compliance proof for the window since the last
    ///         checkpoint and writes the attestation to the Validation Registry.
    function submitProof(
        uint256 agentId,
        bytes32 requestHash,
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[12] calldata publicSignals,
        string calldata responseURI,
        bytes32 responseHash
    ) external {
        address account = accountOf[agentId];
        if (account == address(0)) revert NoBoundAccount();

        (uint256 provenCommitment, uint256 provenCount) =
            _verifyWindow(VerglasAccount(account), pA, pB, pC, publicSignals);

        Attestation storage att = latestAttestation[agentId];
        att.requestHash = requestHash;
        att.finalCommitment = provenCommitment;
        att.txCount = provenCount;
        att.score = 100;
        att.issuedAt = uint64(block.timestamp);

        registry.validationResponse(requestHash, 100, responseURI, responseHash, TAG);
        emit AttestationIssued(agentId, requestHash, provenCommitment, provenCount);
    }

    /// @notice Carries the agent's latest attestation to a VerglasGate on another
    ///         Avalanche L1 via ICM. Permissionless: the attestation is objective
    ///         and already public, so anyone may pay to move it.
    function carryAttestation(uint256 agentId, bytes32 destinationBlockchainID, address gate)
        external
        returns (bytes32 messageID)
    {
        Attestation storage att = latestAttestation[agentId];
        if (att.issuedAt == 0) revert NoAttestation();

        bytes memory packet = abi.encode(
            AttestationPacket({
                agentId: agentId,
                requestHash: att.requestHash,
                finalCommitment: att.finalCommitment,
                txCount: att.txCount,
                score: att.score,
                issuedAt: att.issuedAt
            })
        );

        messageID = teleporter.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: destinationBlockchainID,
                destinationAddress: gate,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: CARRY_GAS_LIMIT,
                allowedRelayerAddresses: new address[](0),
                message: packet
            })
        );
        emit AttestationCarried(agentId, destinationBlockchainID, gate, messageID);
    }

    /// @dev Binds the proof's public inputs to the live account state and verifies
    ///      the Groth16 proof. The window must start at the last proven checkpoint
    ///      and end exactly at the current chain head, over the account's actual policy.
    function _verifyWindow(
        VerglasAccount acc,
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[12] calldata publicSignals
    ) internal returns (uint256 currentCommitment, uint256 currentCount) {
        Checkpoint storage cp = checkpoints[address(acc)];

        if (publicSignals[0] != cp.commitment) revert BadInitialCommitment();
        currentCommitment = acc.commitment();
        currentCount = acc.txCount();
        if (publicSignals[1] != currentCommitment) revert BadFinalCommitment();
        if (publicSignals[2] != currentCount - cp.txCount) revert BadTxCount();

        if (publicSignals[11] != acc.perTxLimit()) revert BadPolicyBinding();
        uint256 wlLen = acc.whitelistLength();
        for (uint256 i = 0; i < 8; i++) {
            uint256 expected = i < wlLen ? uint256(uint160(acc.whitelist(i))) : 0;
            if (publicSignals[3 + i] != expected) revert BadPolicyBinding();
        }

        if (!verifier.verifyProof(pA, pB, pC, publicSignals)) revert InvalidProof();

        cp.commitment = currentCommitment;
        cp.txCount = currentCount;
    }
}
