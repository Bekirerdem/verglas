// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {VerglasOracle} from "../src/VerglasOracle.sol";

/// @notice Deploys the VerglasOracle shim on Fuji C-Chain. The deployer key is
///         both the oracle owner and the initial keeper (same posture as the
///         treasurer's operator on Fuji).
/// @dev Run: forge script script/DeployOracleFuji.s.sol --rpc-url fuji-c --broadcast
contract DeployOracleFuji is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        VerglasOracle oracle = new VerglasOracle(vm.envOr("OWNER", deployer), deployer);
        vm.stopBroadcast();

        console.log("VerglasOracle:", address(oracle));
        console.log("keeper:       ", deployer);
    }
}
