// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

contract PoseidonCheck is Script {
    function run() external pure {
        console2.log(PoseidonT3.hash([uint256(1), uint256(2)]));
    }
}
