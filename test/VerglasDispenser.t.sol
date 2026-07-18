// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {VerglasDispenser, IERC20} from "../src/VerglasDispenser.sol";

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

contract VerglasDispenserTest is Test {
    VerglasDispenser internal dispenser;
    MockToken internal token;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        token = new MockToken();
        dispenser = new VerglasDispenser(IERC20(address(token)), 2e6);
        token.mint(address(dispenser), 100e6);
    }

    function test_ClaimDrips() public {
        vm.prank(alice);
        dispenser.claim();
        assertEq(token.balanceOf(alice), 2e6);
        assertEq(token.balanceOf(address(dispenser)), 98e6);
    }

    function test_ClaimCooldown() public {
        vm.prank(alice);
        dispenser.claim();
        vm.prank(alice);
        vm.expectRevert();
        dispenser.claim();

        vm.warp(block.timestamp + 24 hours);
        vm.prank(alice);
        dispenser.claim();
        assertEq(token.balanceOf(alice), 4e6);
    }

    function test_ClaimIndependentPerAddress() public {
        vm.prank(alice);
        dispenser.claim();
        vm.prank(bob);
        dispenser.claim();
        assertEq(token.balanceOf(bob), 2e6);
    }

    function test_EmptyPoolReverts() public {
        vm.prank(address(this));
        dispenser.sweep(address(0xdead), 100e6);
        vm.prank(alice);
        vm.expectRevert(VerglasDispenser.TransferFailed.selector);
        dispenser.claim();
    }

    function test_OnlyOwnerAdmin() public {
        vm.prank(alice);
        vm.expectRevert(VerglasDispenser.NotOwner.selector);
        dispenser.setAmount(5e6);
        vm.prank(alice);
        vm.expectRevert(VerglasDispenser.NotOwner.selector);
        dispenser.sweep(alice, 1e6);
    }
}
