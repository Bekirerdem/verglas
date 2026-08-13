// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {VerglasFactory} from "../src/VerglasFactory.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";

contract MockToken {
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

contract VerglasFactoryTest is Test {
    VerglasFactory internal factory;
    MockToken internal token;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal agent = makeAddr("agent");
    address internal dexA = makeAddr("dexA");

    function setUp() public {
        factory = new VerglasFactory();
        token = new MockToken();
    }

    function _whitelist() internal view returns (address[] memory wl) {
        wl = new address[](1);
        wl[0] = dexA;
    }

    function test_CreateVault_CallerBecomesOwner() public {
        vm.prank(alice);
        address account = factory.createVault(agent, address(token), 200e6, 0, 500e6,_whitelist());

        VerglasAccount vault = VerglasAccount(account);
        assertEq(vault.owner(), alice);
        assertEq(vault.agent(), agent);
        assertEq(address(vault.token()), address(token));
        assertEq(vault.perTxLimit(), 200e6);
        assertEq(vault.totalBudget(), 500e6);
        assertEq(vault.whitelistLength(), 1);
        assertTrue(vault.isWhitelisted(dexA));
    }

    function test_CreateVault_RegistersPerOwner() public {
        vm.startPrank(alice);
        address a1 = factory.createVault(agent, address(token), 1e6, 0, 2e6,_whitelist());
        address a2 = factory.createVault(agent, address(token), 3e6, 0, 4e6,_whitelist());
        vm.stopPrank();
        vm.prank(bob);
        address b1 = factory.createVault(agent, address(token), 5e6, 0, 6e6,_whitelist());

        address[] memory aliceVaults = factory.vaultsOf(alice);
        assertEq(aliceVaults.length, 2);
        assertEq(aliceVaults[0], a1);
        assertEq(aliceVaults[1], a2);
        address[] memory bobVaults = factory.vaultsOf(bob);
        assertEq(bobVaults.length, 1);
        assertEq(bobVaults[0], b1);
    }

    function test_CreateVault_EmitsEvent() public {
        vm.expectEmit(true, false, false, false, address(factory));
        emit VerglasFactory.VaultCreated(alice, address(0), agent, address(token));
        vm.prank(alice);
        factory.createVault(agent, address(token), 200e6, 0, 500e6,_whitelist());
    }

    function test_CreateVault_VaultRulesEnforced() public {
        vm.prank(alice);
        address account = factory.createVault(agent, address(token), 200e6, 0, 500e6,_whitelist());
        VerglasAccount vault = VerglasAccount(account);
        token.mint(account, 1000e6);

        vm.prank(agent);
        vault.spend(dexA, 150e6);
        assertEq(token.balanceOf(dexA), 150e6);

        // the factory is nobody: it can neither spend nor freeze
        vm.prank(address(factory));
        vm.expectRevert(VerglasAccount.NotAgent.selector);
        vault.spend(dexA, 1e6);
        vm.prank(address(factory));
        vm.expectRevert(VerglasAccount.NotOwner.selector);
        vault.freeze();
    }

    function test_CreateVault_PassesDailyLimitThrough() public {
        vm.prank(alice);
        address account = factory.createVault(agent, address(token), 200e6, 300e6, 500e6, _whitelist());
        assertEq(VerglasAccount(account).dailyLimit(), 300e6);
    }

    function test_CreateVault_BadWhitelistReverts() public {
        address[] memory empty = new address[](0);
        vm.prank(alice);
        vm.expectRevert(VerglasAccount.BadWhitelistLength.selector);
        factory.createVault(agent, address(token), 1e6, 0, 2e6,empty);
    }
}
