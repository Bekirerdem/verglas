// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";
import {VerglasHub} from "../src/VerglasHub.sol";

/// @notice The C-Chain half of the live M1 demo: three real spends on Fuji,
///         a Groth16 policy-compliance proof verified on-chain, the registry
///         stamped. The ICM carry is a separate `cast send` because Foundry's
///         local EVM cannot execute the Warp precompile Teleporter writes to:
///           cast send $HUB "carryAttestation(uint256,bytes32,address)" \
///             1599 <dispatch-blockchain-id> $GATE --rpc-url fuji-c
///         After the relayer delivers, check on Dispatch:
///           cast call $GATE "isCleared(uint256)(bool)" 1599 --rpc-url dispatch
/// @dev Run: ACCOUNT_ADDRESS=<acc> HUB_ADDRESS=<hub> \
///          forge script script/E2EFuji.s.sol --tc E2EFuji --rpc-url fuji-c --broadcast
///      Proof constants come from scripts/prove.js for the fixed window
///      (0xA1,100e6)(0xB2,50e6)(0xA1,25e6) — the chain is deterministic, so
///      the same proof binds to any fresh account with the same policy.
contract E2EFuji is Script {
    /// @dev Dispatch blockchain ID, read from the Warp precompile (2026-07-12).
    bytes32 internal constant DISPATCH_BLOCKCHAIN_ID =
        0x9f3be606497285d0ffbb5ac9ba24aa60346a9b1812479ed66cb329f394a4b1c7;

    uint256 internal constant AGENT_ID = 1599;
    bytes32 internal constant REQUEST_HASH = keccak256("verglas-window-1");
    uint256 internal constant PER_TX = 200e6;
    uint256 internal constant FINAL_COMMITMENT = 0x26c940775b3a475a598ceabb052a8fb0c9669be2ae1e5b182a51bc1900848e03;

    uint256[2] internal pA = [
        0x1a7b24af19e20b7d5a97089eecdeaee8f00c2ffdd5588bdf7e9e9b847155c7cd,
        0x2f8d6df17ef2c31e4c1abd28d98910b6377d66169c366b0313898d366a4ea4fd
    ];
    uint256[2][2] internal pB = [
        [
            0x0966c2af88f81d957063543a12e026eb6f42254035dd2f2f65eb367210559a6e,
            0x102190ffbb1ebca9b8102c01f7417e22a29ed8b007112a87edb512252f5b1503
        ],
        [
            0x15febaa87c4150c35748fe0eb9ecd8fae77885695fc888ff45c7400d003b13c9,
            0x0711124e490871025d34256cd5cc07a9a798d5d1b90d19ce9dbe8c38905f963c
        ]
    ];
    uint256[2] internal pC = [
        0x1ea1e667f401df9deb6296169b5c4f417310ff21fdfd6e9a6380caab77bc0bfa,
        0x0bb67592a19361c314a7393715629602b7009ed85ec93db59ccaead2ac05069b
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

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        account.spend(address(0xA1), 100e6);
        account.spend(address(0xB2), 50e6);
        account.spend(address(0xA1), 25e6);
        hub.submitProof(
            AGENT_ID,
            REQUEST_HASH,
            pA,
            pB,
            pC,
            _publicSignals(),
            "https://github.com/Bekirerdem/verglas",
            keccak256("verglas-window-1-response")
        );
        vm.stopBroadcast();

        console.log("Window proven and stamped. Carry next (see @notice):");
        console.logBytes32(DISPATCH_BLOCKCHAIN_ID);
    }
}
