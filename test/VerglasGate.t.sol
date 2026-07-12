// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {VerglasGate} from "../src/VerglasGate.sol";
import {AttestationPacket} from "../src/AttestationPacket.sol";

contract VerglasGateTest is Test {
    VerglasGate internal gate;

    address internal teleporter = makeAddr("teleporter");
    address internal hub = makeAddr("hub");
    bytes32 internal constant HUB_CHAIN = keccak256("c-chain");
    uint8 internal constant MIN_SCORE = 100;
    uint64 internal constant MAX_AGE = 7 days;

    uint256 internal constant AGENT_ID = 1599;

    function setUp() public {
        gate = new VerglasGate(teleporter, HUB_CHAIN, hub, MIN_SCORE, MAX_AGE);
    }

    function _packet(uint8 score, uint64 issuedAt) internal pure returns (bytes memory) {
        return abi.encode(
            AttestationPacket({
                agentId: AGENT_ID,
                requestHash: keccak256("verglas-window-1"),
                finalCommitment: 0x26c9,
                txCount: 3,
                score: score,
                issuedAt: issuedAt
            })
        );
    }

    function _deliver(bytes memory packet) internal {
        vm.prank(teleporter);
        gate.receiveTeleporterMessage(HUB_CHAIN, hub, packet);
    }

    function test_RevertWhen_CallerNotTeleporter() public {
        vm.expectRevert(VerglasGate.OnlyTeleporter.selector);
        gate.receiveTeleporterMessage(HUB_CHAIN, hub, _packet(100, 1));
    }

    function test_RevertWhen_WrongSourceChain() public {
        vm.prank(teleporter);
        vm.expectRevert(VerglasGate.WrongSourceChain.selector);
        gate.receiveTeleporterMessage(keccak256("rogue-chain"), hub, _packet(100, 1));
    }

    function test_RevertWhen_OriginNotHub() public {
        vm.prank(teleporter);
        vm.expectRevert(VerglasGate.OnlyHub.selector);
        gate.receiveTeleporterMessage(HUB_CHAIN, makeAddr("impostor"), _packet(100, 1));
    }

    function test_StoresAttestationAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit VerglasGate.AttestationReceived(AGENT_ID, keccak256("verglas-window-1"), 100, 42);
        _deliver(_packet(100, 42));

        (bytes32 requestHash, uint256 finalCommitment, uint256 txCount, uint8 score, uint64 issuedAt) =
            gate.attestationOf(AGENT_ID);
        assertEq(requestHash, keccak256("verglas-window-1"));
        assertEq(finalCommitment, 0x26c9);
        assertEq(txCount, 3);
        assertEq(score, 100);
        assertEq(issuedAt, 42);
    }

    function test_RevertWhen_PacketNotNewer() public {
        _deliver(_packet(100, 42));
        // Out-of-order delivery: an older packet must not roll state back,
        // and an equal-timestamp replay must not land twice.
        vm.expectRevert(VerglasGate.StaleAttestation.selector);
        _deliver(_packet(100, 41));
        vm.expectRevert(VerglasGate.StaleAttestation.selector);
        _deliver(_packet(100, 42));
    }

    function test_IsCleared_FreshAndSufficient() public {
        _deliver(_packet(100, uint64(block.timestamp)));
        assertTrue(gate.isCleared(AGENT_ID));
    }

    function test_IsCleared_FalseWhenUnknownAgent() public view {
        assertFalse(gate.isCleared(777));
    }

    function test_IsCleared_FalseWhenScoreBelowThreshold() public {
        _deliver(_packet(MIN_SCORE - 1, uint64(block.timestamp)));
        assertFalse(gate.isCleared(AGENT_ID));
    }

    function test_IsCleared_ExpiresAfterMaxAge() public {
        uint64 issuedAt = uint64(block.timestamp);
        _deliver(_packet(100, issuedAt));

        vm.warp(uint256(issuedAt) + MAX_AGE);
        assertTrue(gate.isCleared(AGENT_ID)); // boundary: still valid at exactly maxAge

        vm.warp(uint256(issuedAt) + MAX_AGE + 1);
        assertFalse(gate.isCleared(AGENT_ID));
    }
}
