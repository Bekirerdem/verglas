// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {ValidationRegistry, IIdentityRegistry} from "../src/ValidationRegistry.sol";
import {VerglasHub} from "../src/VerglasHub.sol";
import {ITeleporterMessenger} from "../src/interfaces/ITeleporterMessenger.sol";

/// @notice Redeploys the VerglasHub with the bindAccount ownership fix
///         (commit adc338a) against the SAME canonical Validation Registry and
///         the SAME live Groth16 verifier — only the Hub logic changes.
///         Bindings and checkpoints start empty on the new Hub; agents are
///         rebound and re-attested as part of the redeploy wave.
/// @dev Run: forge script script/RedeployHubFuji.s.sol --rpc-url fuji-c --broadcast
contract RedeployHubFuji is Script {
    /// @dev Canonical TeleporterMessenger, same address on every Avalanche EVM chain.
    address internal constant TELEPORTER = 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf;
    /// @dev Canonical ERC-8004 registries on Fuji. The Hub holds the Identity
    ///      Registry directly (the canonical Validation Registry's getter is
    ///      getIdentityRegistry(), not our own deploy's identityRegistry()).
    address internal constant VALIDATION_REGISTRY = 0x8004Cb1BF31DAf7788923b405b754f57acEB4272;
    address internal constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    /// @dev The live verifier from the v2 deployment (unchanged bytecode).
    address internal constant VERIFIER = 0xD8A0b54325B52345E390A4B297bC0629000960DE;

    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        VerglasHub hub = new VerglasHub(
            ValidationRegistry(VALIDATION_REGISTRY),
            IIdentityRegistry(IDENTITY_REGISTRY),
            Groth16Verifier(VERIFIER),
            ITeleporterMessenger(TELEPORTER)
        );
        vm.stopBroadcast();
        console.log("VerglasHub (v3, bindAccount fix):", address(hub));
    }
}
