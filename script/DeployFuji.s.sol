// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {ValidationRegistry, IIdentityRegistry} from "../src/ValidationRegistry.sol";
import {VerglasHub} from "../src/VerglasHub.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";
import {ITeleporterMessenger} from "../src/interfaces/ITeleporterMessenger.sol";

/// @notice The canonical ERC-8004 Identity Registry's registration entry point.
///         Script-local on purpose: production contracts only ever need ownerOf
///         (see IIdentityRegistry in ValidationRegistry.sol).
interface ICanonicalIdentity {
    function register() external returns (uint256 agentId);
}

/// @notice Minimal ERC-20 surface the deploy script needs to fund the account.
interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Deploys the C-Chain side of Verglas on Fuji wired to the canonical
///         ERC-8004 registries and real Circle USDC, registers a fresh agentId,
///         and opens the validation window the E2E run will prove.
/// @dev Run: forge script script/DeployFuji.s.sol --rpc-url fuji-c --broadcast
///      Reads PRIVATE_KEY from .env; deployer acts as both owner and agent.
///      PREREQUISITE: the deployer must already hold at least FUNDING USDC
///      (faucet.circle.com drips ~10 USDC per day per address).
contract DeployFuji is Script {
    /// @dev Canonical TeleporterMessenger, same address on every Avalanche EVM chain.
    address internal constant TELEPORTER = 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf;

    /// @dev Canonical ERC-8004 registries on Fuji (vanity CREATE2 deployment,
    ///      verified live via eth_getCode 2026-07-16).
    address internal constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address internal constant VALIDATION_REGISTRY = 0x8004Cb1BF31DAf7788923b405b754f57acEB4272;

    /// @dev Circle's official USDC on Fuji, 6 decimals.
    address internal constant USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;

    bytes32 internal constant REQUEST_HASH = keccak256("verglas-window-2");
    uint256 internal constant PER_TX = 5e6; // 5 USDC
    uint256 internal constant BUDGET = 10e6; // 10 USDC
    uint256 internal constant FUNDING = 7e6; // 6 USDC spent in the E2E window + 1 visible on the dashboard

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        require(IERC20Like(USDC).balanceOf(deployer) >= FUNDING, "deployer needs faucet USDC first");
        vm.startBroadcast(pk);

        Groth16Verifier verifier = new Groth16Verifier();
        ValidationRegistry registry = ValidationRegistry(VALIDATION_REGISTRY);
        VerglasHub hub =
            new VerglasHub(registry, IIdentityRegistry(IDENTITY_REGISTRY), verifier, ITeleporterMessenger(TELEPORTER));

        // Whitelist mirrors scripts/prove.js so the pre-generated proof binds.
        address[] memory wl = new address[](2);
        wl[0] = address(0xA1);
        wl[1] = address(0xB2);
        VerglasAccount account = new VerglasAccount(deployer, deployer, USDC, PER_TX, 0, BUDGET, wl);
        require(IERC20Like(USDC).transfer(address(account), FUNDING), "funding transfer failed");

        uint256 agentId = ICanonicalIdentity(IDENTITY_REGISTRY).register();
        hub.bindAccount(agentId, address(account));
        registry.validationRequest(address(hub), agentId, "https://github.com/Bekirerdem/verglas", REQUEST_HASH);

        vm.stopBroadcast();

        console.log("Groth16Verifier:   ", address(verifier));
        console.log("ValidationRegistry:", address(registry), "(canonical)");
        console.log("IdentityRegistry:  ", IDENTITY_REGISTRY, "(canonical)");
        console.log("VerglasHub:        ", address(hub));
        console.log("VerglasAccount:    ", address(account));
        console.log("USDC:              ", USDC);
        console.log("agentId:           ", agentId);
    }
}
