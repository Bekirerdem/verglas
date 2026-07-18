// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {VerglasDispenser, IERC20} from "../src/VerglasDispenser.sol";

/// @notice Deploys the workshop USDC dispenser on Fuji (2 USDC per claim / 24h).
/// @dev Run: forge script script/DeployDispenserFuji.s.sol --rpc-url fuji-c --broadcast
contract DeployDispenserFuji is Script {
    address internal constant USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;

    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        VerglasDispenser dispenser = new VerglasDispenser(IERC20(USDC), 2e6);
        vm.stopBroadcast();
        console.log("VerglasDispenser:", address(dispenser));
    }
}
