// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {VerglasGate} from "../src/VerglasGate.sol";

/// @notice Deploys a VerglasGate on the Dispatch test L1, trusting the Hub
///         deployed by DeployFuji on the Fuji C-Chain.
/// @dev Run: HUB_ADDRESS=<hub> forge script script/DeployDispatch.s.sol \
///          --rpc-url dispatch --broadcast
///      Reads PRIVATE_KEY and HUB_ADDRESS from the environment.
contract DeployDispatch is Script {
    /// @dev Canonical TeleporterMessenger, same address on every Avalanche EVM chain.
    address internal constant TELEPORTER = 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf;
    /// @dev Fuji C-Chain blockchain ID, read from the Warp precompile (2026-07-12).
    bytes32 internal constant FUJI_C_BLOCKCHAIN_ID = 0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5;

    uint8 internal constant MIN_SCORE = 100;
    uint64 internal constant MAX_AGE = 7 days;

    function run() external {
        address hub = vm.envAddress("HUB_ADDRESS");
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        VerglasGate gate = new VerglasGate(TELEPORTER, FUJI_C_BLOCKCHAIN_ID, hub, MIN_SCORE, MAX_AGE);
        vm.stopBroadcast();
        console.log("VerglasGate (Dispatch):", address(gate));
    }
}
