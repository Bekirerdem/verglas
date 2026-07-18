// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {VerglasFactory} from "../src/VerglasFactory.sol";

/// @notice Deploys the VerglasFactory on Fuji C-Chain — the console's
///         "create your vault" entry point.
/// @dev Run: forge script script/DeployFactoryFuji.s.sol --rpc-url fuji-c --broadcast
contract DeployFactoryFuji is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        VerglasFactory factory = new VerglasFactory();
        vm.stopBroadcast();
        console.log("VerglasFactory:", address(factory));
    }
}
