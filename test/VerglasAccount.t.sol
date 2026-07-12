// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

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

contract VerglasAccountTest is Test {
    VerglasAccount internal account;
    MockToken internal token;

    address internal owner = makeAddr("owner");
    address internal agent = makeAddr("agent");
    address internal dexA = makeAddr("dexA");
    address internal dexB = makeAddr("dexB");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant PER_TX = 200e6;
    uint256 internal constant BUDGET = 500e6;
    uint256 internal constant FUNDING = 1000e6;

    function setUp() public {
        token = new MockToken();
        account = new VerglasAccount(owner, agent, address(token), PER_TX, BUDGET, _whitelist());
        token.mint(address(account), FUNDING);
    }

    function _whitelist() internal view returns (address[] memory wl) {
        wl = new address[](2);
        wl[0] = dexA;
        wl[1] = dexB;
    }

    function _spend(address to, uint256 amount) internal {
        vm.prank(agent);
        account.spend(to, amount);
    }

    function test_SpendTransfersAndCounts() public {
        _spend(dexA, 150e6);
        assertEq(token.balanceOf(dexA), 150e6);
        assertEq(token.balanceOf(address(account)), FUNDING - 150e6);
        assertEq(account.totalSpent(), 150e6);
        assertEq(account.txCount(), 1);
    }

    function test_CommitmentChainMatchesRecomputation() public {
        _spend(dexA, 100e6);
        _spend(dexB, 50e6);
        _spend(dexA, 25e6);

        uint256 c = 0;
        c = PoseidonT3.hash([c, PoseidonT3.hash([uint256(uint160(dexA)), 100e6])]);
        c = PoseidonT3.hash([c, PoseidonT3.hash([uint256(uint160(dexB)), 50e6])]);
        c = PoseidonT3.hash([c, PoseidonT3.hash([uint256(uint160(dexA)), 25e6])]);

        assertEq(account.commitment(), c);
        assertEq(account.txCount(), 3);
    }

    function test_SpendEmitsEvent() public {
        uint256 leaf = PoseidonT3.hash([uint256(uint160(dexA)), 10e6]);
        uint256 expected = PoseidonT3.hash([uint256(0), leaf]);
        vm.expectEmit(true, true, false, true);
        emit VerglasAccount.Spend(dexA, 10e6, 0, expected);
        _spend(dexA, 10e6);
    }

    function test_RevertWhen_CallerNotAgent() public {
        vm.prank(stranger);
        vm.expectRevert(VerglasAccount.NotAgent.selector);
        account.spend(dexA, 1e6);
    }

    function test_RevertWhen_DestinationNotWhitelisted() public {
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(VerglasAccount.NotInWhitelist.selector, stranger));
        account.spend(stranger, 1e6);
    }

    function test_RevertWhen_PerTxLimitExceeded() public {
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(VerglasAccount.PerTxLimitExceeded.selector, PER_TX + 1, PER_TX));
        account.spend(dexA, PER_TX + 1);
    }

    function test_RevertWhen_BudgetExceededCumulatively() public {
        _spend(dexA, 200e6);
        _spend(dexB, 200e6);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(VerglasAccount.BudgetExceeded.selector, 600e6, BUDGET));
        account.spend(dexA, 200e6);
    }

    function test_FreezeBlocksSpendAndUnfreezeRestores() public {
        vm.prank(owner);
        account.freeze();

        vm.prank(agent);
        vm.expectRevert(VerglasAccount.AccountFrozen.selector);
        account.spend(dexA, 1e6);

        vm.prank(owner);
        account.unfreeze();
        _spend(dexA, 1e6);
        assertEq(account.txCount(), 1);
    }

    function test_RevertWhen_FreezeCallerNotOwner() public {
        vm.prank(agent);
        vm.expectRevert(VerglasAccount.NotOwner.selector);
        account.freeze();
    }

    function test_OwnerWithdrawWorksWhileFrozen() public {
        vm.prank(owner);
        account.freeze();
        vm.prank(owner);
        account.withdraw(owner, FUNDING);
        assertEq(token.balanceOf(owner), FUNDING);
    }

    function test_RevertWhen_WithdrawCallerNotOwner() public {
        vm.prank(agent);
        vm.expectRevert(VerglasAccount.NotOwner.selector);
        account.withdraw(agent, 1e6);
    }

    function test_RevertWhen_WhitelistEmptyOrTooLarge() public {
        address[] memory empty = new address[](0);
        vm.expectRevert(VerglasAccount.BadWhitelistLength.selector);
        new VerglasAccount(owner, agent, address(token), PER_TX, BUDGET, empty);

        address[] memory big = new address[](9);
        for (uint256 i = 0; i < 9; i++) {
            big[i] = address(uint160(i + 1));
        }
        vm.expectRevert(VerglasAccount.BadWhitelistLength.selector);
        new VerglasAccount(owner, agent, address(token), PER_TX, BUDGET, big);
    }

    function test_ConstructorDeduplicatesWhitelist() public {
        address[] memory dup = new address[](3);
        dup[0] = dexA;
        dup[1] = dexA;
        dup[2] = dexB;
        VerglasAccount acc = new VerglasAccount(owner, agent, address(token), PER_TX, BUDGET, dup);
        assertEq(acc.whitelistLength(), 2);
    }

    function test_RevertWhen_TransferFails() public {
        // Drain the account via owner withdraw, then agent spend must revert.
        vm.prank(owner);
        account.withdraw(owner, FUNDING);
        vm.prank(agent);
        vm.expectRevert(VerglasAccount.TransferFailed.selector);
        account.spend(dexA, 1e6);
    }
}
