// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";
import {VerglasTreasurer} from "../src/VerglasTreasurer.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {VerglasHub} from "../src/VerglasHub.sol";
import {IPyth} from "../src/interfaces/IPyth.sol";

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Redeploys the treasurer vertical against the VerglasOracle shim,
///         KEEPING agentId #220's identity: the vault's agent is immutable, so
///         a treasurer swap needs a fresh vault — the old vault's USDC is
///         withdrawn by the owner, the new vault funded, and #220 rebound to it
///         on the new Hub. Policy is unchanged from the v2 deployment.
/// @dev Run: HUB_ADDRESS=<hub v3> ORACLE_ADDRESS=<shim> \
///          forge script script/RedeployTreasurerFuji.s.sol --rpc-url fuji-c --broadcast
///      Optional REFERENCE_RATE (1e8) — set it from a fresh push-fx read.
contract RedeployTreasurerFuji is Script {
    address internal constant VALIDATION_REGISTRY = 0x8004Cb1BF31DAf7788923b405b754f57acEB4272;
    address internal constant USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;

    /// @dev The v2 treasury vault (agent = the Pyth-wired treasurer, immutable).
    address internal constant OLD_TREASURY_VAULT = 0x135a08223c5aBEAb6F6482aB08E85086f6265981;
    uint256 internal constant AGENT_ID = 220;

    /// @dev Same feed id the shim is pushed under (Pyth's USD/TRY id kept as the key).
    bytes32 internal constant USD_TRY_PRICE_ID = 0x032a2eba1c2635bf973e95fb62b2c0705c1be2603b9572cc8d5edeaf8744e058;

    bytes32 internal constant REQUEST_HASH = keccak256("verglas-treasurer-window-2");
    uint256 internal constant PER_TX = 5e6;
    uint256 internal constant BUDGET = 10e6;
    uint256 internal constant DAILY_LIMIT = 10e6;
    uint32 internal constant MAX_SLIPPAGE_BPS = 200; // 2%
    uint256 internal constant FUNDING = 7e6;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        VerglasHub hub = VerglasHub(vm.envAddress("HUB_ADDRESS"));
        IPyth oracle = IPyth(vm.envAddress("ORACLE_ADDRESS"));
        // Anchor rate from the first live shim push unless a fresher one is passed.
        uint256 referenceRate = vm.envOr("REFERENCE_RATE", uint256(47_39214100));

        vm.startBroadcast(pk);

        // Reclaim the old vault's USDC (owner exit) before funding the new one.
        VerglasAccount oldVault = VerglasAccount(OLD_TREASURY_VAULT);
        uint256 oldBalance = IERC20Like(USDC).balanceOf(OLD_TREASURY_VAULT);
        if (oldBalance > 0) {
            oldVault.withdraw(deployer, oldBalance);
        }
        require(IERC20Like(USDC).balanceOf(deployer) >= FUNDING, "deployer needs USDC");

        address[] memory wl = new address[](2);
        wl[0] = address(0xA1);
        wl[1] = address(0xB2);
        uint64 nonce = vm.getNonce(deployer);
        address predictedTreasurer = vm.computeCreateAddress(deployer, nonce + 1);
        VerglasAccount account = new VerglasAccount(deployer, predictedTreasurer, USDC, PER_TX, BUDGET, wl);
        VerglasTreasurer treasurer = new VerglasTreasurer(
            account,
            deployer,
            oracle,
            USD_TRY_PRICE_ID,
            VerglasTreasurer.Policy({
                dailyLimit: DAILY_LIMIT, maxSlippageBps: MAX_SLIPPAGE_BPS, referenceRateUsdTry: referenceRate
            })
        );
        require(address(treasurer) == predictedTreasurer, "treasurer address mismatch");

        require(IERC20Like(USDC).transfer(address(account), FUNDING), "funding transfer failed");

        hub.bindAccount(AGENT_ID, address(account));
        ValidationRegistry(VALIDATION_REGISTRY)
            .validationRequest(address(hub), AGENT_ID, "https://github.com/Bekirerdem/verglas", REQUEST_HASH);

        vm.stopBroadcast();

        console.log("VerglasAccount (treasury v3):", address(account));
        console.log("VerglasTreasurer (shim-fed): ", address(treasurer));
        console.log("agentId (kept):              ", AGENT_ID);
        console.log("reclaimed from old vault:    ", oldBalance);
        console.log("reference USD/TRY (1e8):     ", referenceRate);
    }
}
