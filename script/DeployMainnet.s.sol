// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {ValidationRegistry, IIdentityRegistry} from "../src/ValidationRegistry.sol";
import {VerglasHub} from "../src/VerglasHub.sol";
import {VerglasOracle} from "../src/VerglasOracle.sol";
import {VerglasFactory} from "../src/VerglasFactory.sol";
import {ITeleporterMessenger} from "../src/interfaces/ITeleporterMessenger.sol";

/// @notice Deploys the Verglas core on Avalanche C-Chain mainnet.
///
/// Identity comes from the CANONICAL ERC-8004 Identity Registry, which is
/// already live on mainnet (verified on-chain: name() = "AgentIdentity",
/// register() returns the next agentId). Validation does NOT exist canonically
/// on any chain — the spec section is still being revised with the TEE
/// community and the reference repo lists no Validation address anywhere — so
/// Verglas deploys its own, event- and interface-compatible with ERC-8004.
///
/// @dev Run: KEEPER=<addr> OWNER=<addr> \
///          forge script script/DeployMainnet.s.sol --rpc-url avalanche --broadcast
///      OWNER defaults to the deployer; pass the long-term owner wallet so the
///      hot deploy key never holds authority over the oracle.
///      The gate (second L1) is deliberately out of scope here — mainnet M1 is
///      the C-Chain leg; gates ship per L1 operator afterwards.
contract DeployMainnet is Script {
    /// @dev Canonical TeleporterMessenger — same address on every Avalanche EVM chain.
    address internal constant TELEPORTER = 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf;

    /// @dev Canonical ERC-8004 Identity Registry on Avalanche C-Chain mainnet.
    ///      NOTE: this differs from Fuji's (0x8004A818…) — the reference
    ///      deployment uses a different vanity family per network. Verified live.
    address internal constant IDENTITY_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;

    /// @dev Circle's official USDC on Avalanche C-Chain, 6 decimals.
    address internal constant USDC = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address keeper = vm.envOr("KEEPER", deployer);
        address owner = vm.envOr("OWNER", deployer);

        require(IDENTITY_REGISTRY.code.length > 0, "canonical identity registry missing");
        require(USDC.code.length > 0, "USDC missing");
        require(TELEPORTER.code.length > 0, "teleporter missing");

        vm.startBroadcast(pk);

        Groth16Verifier verifier = new Groth16Verifier();
        ValidationRegistry registry = new ValidationRegistry(IIdentityRegistry(IDENTITY_REGISTRY));
        VerglasHub hub =
            new VerglasHub(registry, IIdentityRegistry(IDENTITY_REGISTRY), verifier, ITeleporterMessenger(TELEPORTER));
        VerglasOracle oracle = new VerglasOracle(owner, keeper);
        VerglasFactory factory = new VerglasFactory();

        vm.stopBroadcast();

        console.log("--- Verglas on Avalanche mainnet (43114) ---");
        console.log("Groth16Verifier:            ", address(verifier));
        console.log("ValidationRegistry (ours):  ", address(registry));
        console.log("VerglasHub:                 ", address(hub));
        console.log("VerglasOracle:              ", address(oracle));
        console.log("VerglasFactory:             ", address(factory));
        console.log("IdentityRegistry (canonical):", IDENTITY_REGISTRY);
        console.log("USDC:                       ", USDC);
        console.log("keeper (oracle pusher):     ", keeper);
        console.log("oracle owner:               ", owner);
    }
}
