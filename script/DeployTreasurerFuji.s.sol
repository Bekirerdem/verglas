// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";
import {VerglasTreasurer} from "../src/VerglasTreasurer.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {VerglasHub} from "../src/VerglasHub.sol";
import {IPyth} from "../src/interfaces/IPyth.sol";

interface ICanonicalIdentity {
    function register() external returns (uint256 agentId);
}

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Deploys the V2 vertical on Fuji: a second VerglasAccount whose agent
///         is a VerglasTreasurer wired to Pyth USD/TRY, registered as its own
///         agent on the canonical Identity Registry and bound to the live Hub.
/// @dev Run: HUB_ADDRESS=<hub from DeployFuji> \
///          forge script script/DeployTreasurerFuji.s.sol --rpc-url fuji-c --broadcast
///      Reads PRIVATE_KEY from .env; deployer acts as owner and keeper (operator).
///      Optional REFERENCE_RATE overrides the policy's USD/TRY anchor (1e8 fixed
///      point) — set it from a fresh Hermes read on demo day.
///      PREREQUISITE: deployer holds at least FUNDING USDC (faucet.circle.com).
contract DeployTreasurerFuji is Script {
    address internal constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address internal constant VALIDATION_REGISTRY = 0x8004Cb1BF31DAf7788923b405b754f57acEB4272;
    address internal constant USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;

    /// @dev Pyth on Fuji + the FX.USD/TRY feed id (verified live 2026-07-16).
    address internal constant PYTH = 0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509;
    bytes32 internal constant USD_TRY_PRICE_ID = 0x032a2eba1c2635bf973e95fb62b2c0705c1be2603b9572cc8d5edeaf8744e058;

    bytes32 internal constant REQUEST_HASH = keccak256("verglas-treasurer-window-1");
    uint256 internal constant PER_TX = 5e6; // 5 USDC — matches the prove.js fixture policy
    uint256 internal constant BUDGET = 10e6;
    uint256 internal constant DAILY_LIMIT = 10e6;
    uint32 internal constant MAX_SLIPPAGE_BPS = 200; // 2%
    uint256 internal constant FUNDING = 7e6;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        VerglasHub hub = VerglasHub(vm.envAddress("HUB_ADDRESS"));
        // Anchor rate: 47.05 USD/TRY unless a fresh one is passed in.
        uint256 referenceRate = vm.envOr("REFERENCE_RATE", uint256(47_05275000));
        require(IERC20Like(USDC).balanceOf(deployer) >= FUNDING, "deployer needs faucet USDC first");

        vm.startBroadcast(pk);

        // Account and treasurer need each other at construction: the account's
        // agent is the treasurer, the treasurer's vault is the account.
        address[] memory wl = new address[](2);
        wl[0] = address(0xA1);
        wl[1] = address(0xB2);
        uint64 nonce = vm.getNonce(deployer);
        address predictedTreasurer = vm.computeCreateAddress(deployer, nonce + 1);
        VerglasAccount account = new VerglasAccount(deployer, predictedTreasurer, USDC, PER_TX, 0, BUDGET, wl);
        VerglasTreasurer treasurer = new VerglasTreasurer(
            account,
            deployer,
            IPyth(PYTH),
            USD_TRY_PRICE_ID,
            VerglasTreasurer.Policy({
                dailyLimit: DAILY_LIMIT, maxSlippageBps: MAX_SLIPPAGE_BPS, referenceRateUsdTry: referenceRate
            })
        );
        require(address(treasurer) == predictedTreasurer, "treasurer address mismatch");

        require(IERC20Like(USDC).transfer(address(account), FUNDING), "funding transfer failed");

        uint256 agentId = ICanonicalIdentity(IDENTITY_REGISTRY).register();
        hub.bindAccount(agentId, address(account));
        ValidationRegistry(VALIDATION_REGISTRY)
            .validationRequest(address(hub), agentId, "https://github.com/Bekirerdem/verglas", REQUEST_HASH);

        vm.stopBroadcast();

        console.log("VerglasAccount (treasury vault):", address(account));
        console.log("VerglasTreasurer:               ", address(treasurer));
        console.log("treasurer agentId:              ", agentId);
        console.log("reference USD/TRY (1e8):        ", referenceRate);
    }
}
