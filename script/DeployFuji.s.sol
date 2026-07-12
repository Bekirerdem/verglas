// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {ValidationRegistry, IIdentityRegistry} from "../src/ValidationRegistry.sol";
import {VerglasHub} from "../src/VerglasHub.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";
import {ITeleporterMessenger} from "../src/interfaces/ITeleporterMessenger.sol";

/// @notice Stand-in stablecoin for the Fuji E2E run; a real token takes its
///         place in later milestones. Same shape as the test MockToken.
contract TestUSD {
    string public constant name = "Verglas Test USD";
    string public constant symbol = "vUSD";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @notice Dev identity source for the Fuji E2E run; the canonical ERC-8004
///         Identity Registry (0x8004A...) takes its place in later milestones.
contract DevIdentity is IIdentityRegistry {
    mapping(uint256 => address) public owners;

    function set(uint256 agentId, address owner) external {
        owners[agentId] = owner;
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        require(owners[agentId] != address(0), "no agent");
        return owners[agentId];
    }
}

/// @notice Deploys the full C-Chain side of Verglas on Fuji and opens the
///         validation window the E2E run will prove.
/// @dev Run: forge script script/DeployFuji.s.sol --rpc-url fuji-c --broadcast
///      Reads PRIVATE_KEY from .env; deployer acts as both owner and agent.
contract DeployFuji is Script {
    /// @dev Canonical TeleporterMessenger, same address on every Avalanche EVM chain.
    address internal constant TELEPORTER = 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf;

    uint256 internal constant AGENT_ID = 1599;
    bytes32 internal constant REQUEST_HASH = keccak256("verglas-window-1");
    uint256 internal constant PER_TX = 200e6;
    uint256 internal constant BUDGET = 500e6;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        TestUSD token = new TestUSD();
        DevIdentity identity = new DevIdentity();
        Groth16Verifier verifier = new Groth16Verifier();
        ValidationRegistry registry = new ValidationRegistry(identity);
        VerglasHub hub = new VerglasHub(registry, verifier, ITeleporterMessenger(TELEPORTER));

        // Whitelist mirrors scripts/prove.js so the pre-generated proof binds.
        address[] memory wl = new address[](2);
        wl[0] = address(0xA1);
        wl[1] = address(0xB2);
        VerglasAccount account = new VerglasAccount(deployer, deployer, address(token), PER_TX, BUDGET, wl);
        token.mint(address(account), 1000e6);

        identity.set(AGENT_ID, deployer);
        hub.bindAccount(AGENT_ID, address(account));
        registry.validationRequest(address(hub), AGENT_ID, "https://github.com/Bekirerdem/verglas", REQUEST_HASH);

        vm.stopBroadcast();

        console.log("TestUSD:           ", address(token));
        console.log("DevIdentity:       ", address(identity));
        console.log("Groth16Verifier:   ", address(verifier));
        console.log("ValidationRegistry:", address(registry));
        console.log("VerglasHub:        ", address(hub));
        console.log("VerglasAccount:    ", address(account));
    }
}
