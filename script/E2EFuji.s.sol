// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";
import {VerglasHub} from "../src/VerglasHub.sol";

/// @notice The C-Chain half of the live demo: three real USDC spends on Fuji,
///         a Groth16 policy-compliance proof verified on-chain, the canonical
///         ERC-8004 Validation Registry stamped. The ICM carry is a separate
///         `cast send` because Foundry's local EVM cannot execute the Warp
///         precompile Teleporter writes to:
///           cast send $HUB "carryAttestation(uint256,bytes32,address)" \
///             $AGENT_ID <dispatch-blockchain-id> $GATE --rpc-url fuji-c
///         After the relayer delivers, check on Dispatch:
///           cast call $GATE "isCleared(uint256)(bool)" $AGENT_ID --rpc-url dispatch
/// @dev Run: ACCOUNT_ADDRESS=<acc> HUB_ADDRESS=<hub> AGENT_ID=<id> \
///          forge script script/E2EFuji.s.sol --tc E2EFuji --rpc-url fuji-c --broadcast
///      AGENT_ID is the id minted by the canonical Identity Registry during
///      DeployFuji. Proof constants come from scripts/prove.js for the fixed
///      window (0xA1,3e6)(0xB2,2e6)(0xA1,1e6) — the chain is deterministic, so
///      the same proof binds to any fresh account with the same policy.
contract E2EFuji is Script {
    /// @dev Dispatch blockchain ID, read from the Warp precompile (2026-07-12).
    bytes32 internal constant DISPATCH_BLOCKCHAIN_ID =
        0x9f3be606497285d0ffbb5ac9ba24aa60346a9b1812479ed66cb329f394a4b1c7;

    bytes32 internal constant REQUEST_HASH = keccak256("verglas-window-2");
    uint256 internal constant PER_TX = 5e6;
    uint256 internal constant FINAL_COMMITMENT = 0x094ccb8cd2197c63f6d3490128f16722d0e291ac1bd2eb6a47642b2420eefbb6;

    uint256[2] internal pA = [
        0x1641b5716722eddbfd834b42d17e91e4b6b15c8020631bbbc9e9254c4a77dea0,
        0x23b1f419a3f9ee229d83f3417aefa44b0ed747722352184972a54c340f299581
    ];
    uint256[2][2] internal pB = [
        [
            0x035e69601b6e7a91481ca9af8c1e1e37a1e9fd7d60370742f028389fce2a49a1,
            0x27904e6bd4c8aa933f8c35da49660af61a7d933166140e7ae88474a4b812a567
        ],
        [
            0x12f66feb4be0d452d4ae611f094647fe69e86d8a8ae382b011fe04e876b97ae8,
            0x2f089bb69a77b47d1ded434eda15fb2fc49b252af9c3dc1fa82007a649adaeb2
        ]
    ];
    uint256[2] internal pC = [
        0x00fdb074255e7eabe2b182ce9338677eafb86a8fa6dcc2e0d3e3c23729938e0d,
        0x2a54681b258c3903b6603812da946775fe1f40f4e58fce53237e95a7bc1776da
    ];

    function _publicSignals() internal pure returns (uint256[12] memory ps) {
        ps[1] = FINAL_COMMITMENT;
        ps[2] = 3;
        ps[3] = uint256(uint160(address(0xA1)));
        ps[4] = uint256(uint160(address(0xB2)));
        ps[11] = PER_TX;
    }

    function run() external {
        VerglasAccount account = VerglasAccount(vm.envAddress("ACCOUNT_ADDRESS"));
        VerglasHub hub = VerglasHub(vm.envAddress("HUB_ADDRESS"));
        uint256 agentId = vm.envUint("AGENT_ID");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        account.spend(address(0xA1), 3e6);
        account.spend(address(0xB2), 2e6);
        account.spend(address(0xA1), 1e6);
        hub.submitProof(
            agentId,
            REQUEST_HASH,
            pA,
            pB,
            pC,
            _publicSignals(),
            "https://github.com/Bekirerdem/verglas",
            keccak256("verglas-window-2-response")
        );
        vm.stopBroadcast();

        console.log("Window proven and stamped on the canonical registry.");
        console.log("Carry next (see @notice):");
        console.logBytes32(DISPATCH_BLOCKCHAIN_ID);
    }
}
