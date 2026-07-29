// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";
import {VerglasTreasurer} from "../src/VerglasTreasurer.sol";
import {ValidationRegistry, IIdentityRegistry} from "../src/ValidationRegistry.sol";
import {VerglasHub} from "../src/VerglasHub.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {IPyth} from "../src/interfaces/IPyth.sol";
import {ITeleporterMessenger} from "../src/interfaces/ITeleporterMessenger.sol";
import {MockPyth} from "./mocks/MockPyth.sol";
import {MockTeleporterMessenger} from "./mocks/MockTeleporterMessenger.sol";

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

contract MockIdentity is IIdentityRegistry {
    mapping(uint256 => address) public owners;

    function set(uint256 agentId, address owner) external {
        owners[agentId] = owner;
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        require(owners[agentId] != address(0), "no agent");
        return owners[agentId];
    }
}

/// @notice Treasurer unit tests: the two treasury rules (daily epoch cap,
///         FX circuit-breaker) plus the composition guarantee that the vault's
///         own checks — above all the owner's freeze — always win.
contract VerglasTreasurerTest is Test {
    VerglasAccount internal account;
    VerglasTreasurer internal treasurer;
    MockToken internal token;
    MockPyth internal pyth;

    address internal owner = makeAddr("owner");
    address internal operator = makeAddr("operator");
    address internal dexA = address(0xA1);
    address internal dexB = address(0xB2);

    bytes32 internal constant PRICE_ID = keccak256("usd-try");
    uint256 internal constant PER_TX = 5e6;
    uint256 internal constant BUDGET = 100e6;
    uint256 internal constant DAILY_LIMIT = 5e6;
    uint32 internal constant MAX_SLIPPAGE_BPS = 200; // 2%
    uint256 internal constant REF_RATE = 47_00000000; // 47.0 USD/TRY at 1e8

    function setUp() public {
        token = new MockToken();
        pyth = new MockPyth();

        // Account and treasurer need each other's address at construction;
        // precompute the treasurer's like the deploy script does.
        address[] memory wl = new address[](2);
        wl[0] = dexA;
        wl[1] = dexB;
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        account = new VerglasAccount(owner, predicted, address(token), PER_TX, BUDGET, wl);
        treasurer = new VerglasTreasurer(
            account,
            operator,
            IPyth(address(pyth)),
            PRICE_ID,
            VerglasTreasurer.Policy({
                dailyLimit: DAILY_LIMIT, maxSlippageBps: MAX_SLIPPAGE_BPS, referenceRateUsdTry: REF_RATE
            })
        );
        assertEq(address(treasurer), predicted, "predicted treasurer address mismatch");

        token.mint(address(account), 50e6);
        pyth.setPrice(int64(uint64(REF_RATE)), -8, block.timestamp);
        vm.deal(operator, 1 ether);
    }

    function _pay(address to, uint256 amount) internal {
        bytes[] memory update = new bytes[](1);
        uint256 fee = pyth.FEE(); // read before prank — the prank applies to the next external call
        vm.prank(operator);
        treasurer.payFX{value: fee}(to, amount, update);
    }

    function test_PayFXTransfersWithinLimits() public {
        _pay(dexA, 3e6);
        assertEq(token.balanceOf(dexA), 3e6);
        assertEq(treasurer.spentToday(), 3e6);
        assertEq(account.txCount(), 1);
        assertEq(pyth.updateCalls(), 1);
    }

    function test_RevertWhen_CallerNotOperator() public {
        bytes[] memory update = new bytes[](1);
        vm.prank(owner);
        vm.expectRevert(VerglasTreasurer.NotOperator.selector);
        treasurer.payFX(dexA, 1e6, update);
    }

    function test_RevertWhen_ZeroAmount() public {
        bytes[] memory update = new bytes[](1);
        vm.prank(operator);
        vm.expectRevert(VerglasTreasurer.ZeroAmount.selector);
        treasurer.payFX{value: 1}(dexA, 0, update);
    }

    function test_OwnerCanPauseAndUnpause() public {
        vm.prank(owner);
        treasurer.pause();

        bytes[] memory update = new bytes[](1);
        vm.prank(operator);
        vm.expectRevert(VerglasTreasurer.TreasurerPaused.selector);
        treasurer.payFX{value: 1}(dexA, 1e6, update);

        vm.prank(owner);
        treasurer.unpause();
        _pay(dexA, 1e6);
        assertEq(treasurer.spentToday(), 1e6);
    }

    function test_RevertWhen_PauseCallerNotOwner() public {
        vm.prank(operator);
        vm.expectRevert(VerglasTreasurer.NotOwner.selector);
        treasurer.pause();
    }

    function test_RevertWhen_DailyLimitExceeded() public {
        bytes[] memory update = new bytes[](1);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(VerglasTreasurer.DailyLimitExceeded.selector, 6e6, DAILY_LIMIT));
        treasurer.payFX{value: 1}(dexA, 6e6, update);
    }

    function test_DailyLimitAccumulatesAcrossPayments() public {
        _pay(dexA, 3e6);
        _pay(dexB, 2e6); // exactly at the cap
        assertEq(treasurer.spentToday(), DAILY_LIMIT);

        bytes[] memory update = new bytes[](1);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(VerglasTreasurer.DailyLimitExceeded.selector, 6e6, DAILY_LIMIT));
        treasurer.payFX{value: 1}(dexA, 1e6, update);
    }

    function test_DailyLimitResetsNextEpoch() public {
        _pay(dexA, 5e6);
        assertEq(treasurer.spentToday(), 5e6);

        vm.warp(block.timestamp + 1 days);
        pyth.setPrice(int64(uint64(REF_RATE)), -8, block.timestamp);
        assertEq(treasurer.spentToday(), 0); // lazily reset — fresh day, fresh counter
        _pay(dexB, 4e6);
        assertEq(treasurer.spentToday(), 4e6);
    }

    function test_RevertWhen_SlippageExceeded() public {
        // 2.1% above reference — past the 2% breaker.
        uint256 moved = REF_RATE + (REF_RATE * 210) / 10_000;
        pyth.setPrice(int64(uint64(moved)), -8, block.timestamp);

        bytes[] memory update = new bytes[](1);
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(VerglasTreasurer.SlippageExceeded.selector, moved, REF_RATE, MAX_SLIPPAGE_BPS)
        );
        treasurer.payFX{value: 1}(dexA, 1e6, update);
    }

    function test_SlippageExactlyAtBoundPasses() public {
        // Exactly 2% below reference — the breaker trips only strictly past the bound.
        uint256 moved = REF_RATE - (REF_RATE * uint256(MAX_SLIPPAGE_BPS)) / 10_000;
        pyth.setPrice(int64(uint64(moved)), -8, block.timestamp);
        _pay(dexA, 1e6);
        assertEq(treasurer.spentToday(), 1e6);
    }

    function test_NormalizeHandlesFeedExponent() public {
        // Same 47.0 rate reported at expo -5 (like the live feed) must normalize
        // to zero deviation against the 1e8 reference.
        pyth.setPrice(int64(uint64(4_700_000)), -5, block.timestamp);
        _pay(dexA, 1e6);
        assertEq(treasurer.spentToday(), 1e6);
    }

    function test_RevertWhen_InsufficientFee() public {
        bytes[] memory update = new bytes[](1);
        uint256 fee = pyth.FEE();
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(VerglasTreasurer.InsufficientFee.selector, 0, fee));
        treasurer.payFX(dexA, 1e6, update);
    }

    function test_RevertWhen_PriceStale() public {
        vm.warp(block.timestamp + 27 hours); // past MAX_PRICE_AGE with no fresh publish
        bytes[] memory update = new bytes[](1);
        vm.prank(operator);
        vm.expectRevert(MockPyth.StalePrice.selector);
        treasurer.payFX{value: 1}(dexA, 1e6, update);
    }

    function test_RevertWhen_SupplierNotWhitelisted() public {
        // The vault's own rule bubbles up through the treasurer untouched.
        address stranger = makeAddr("stranger");
        bytes[] memory update = new bytes[](1);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(VerglasAccount.NotInWhitelist.selector, stranger));
        treasurer.payFX{value: 1}(stranger, 1e6, update);
    }

    /// @notice The load-bearing composition test: the owner freezes the VAULT,
    ///         not the treasurer — and the treasurer is silenced anyway.
    function test_RevertWhen_AccountFrozenTrumpsTreasurer() public {
        vm.prank(owner);
        account.freeze();
        assertFalse(treasurer.paused()); // treasurer itself is not paused

        bytes[] memory update = new bytes[](1);
        vm.prank(operator);
        vm.expectRevert(VerglasAccount.AccountFrozen.selector);
        treasurer.payFX{value: 1}(dexA, 1e6, update);
    }

    function test_OwnerRotatesOperator() public {
        address newOperator = makeAddr("newOperator");
        vm.prank(owner);
        treasurer.setOperator(newOperator);

        bytes[] memory update = new bytes[](1);
        vm.prank(operator); // the old key is out
        vm.expectRevert(VerglasTreasurer.NotOperator.selector);
        treasurer.payFX{value: 1}(dexA, 1e6, update);

        vm.deal(newOperator, 1 ether);
        vm.prank(newOperator);
        treasurer.payFX{value: 1}(dexA, 1e6, update);
        assertEq(treasurer.spentToday(), 1e6);
    }

    function test_RevertWhen_SetPolicyCallerNotOwner() public {
        vm.prank(operator);
        vm.expectRevert(VerglasTreasurer.NotOwner.selector);
        treasurer.setPolicy(VerglasTreasurer.Policy({dailyLimit: 1, maxSlippageBps: 1, referenceRateUsdTry: REF_RATE}));
    }

    function test_OwnerUpdatesPolicy() public {
        vm.prank(owner);
        treasurer.setPolicy(
            VerglasTreasurer.Policy({dailyLimit: 9e6, maxSlippageBps: 500, referenceRateUsdTry: 48_00000000})
        );
        (uint256 dailyLimit, uint32 slippage, uint256 ref) = treasurer.policy();
        assertEq(dailyLimit, 9e6);
        assertEq(slippage, 500);
        assertEq(ref, 48_00000000);
    }
}

/// @notice Composition end-to-end: the treasurer's vault runs the exact proof
///         window from scripts/prove.js (spends routed through payFX instead of
///         a direct agent) and the Hub verifies and stamps it unchanged — the
///         treasurer inherits the trust machine for free.
contract VerglasTreasurerHubIntegrationTest is Test {
    VerglasAccount internal account;
    VerglasTreasurer internal treasurer;
    ValidationRegistry internal registry;
    VerglasHub internal hub;
    Groth16Verifier internal verifier;
    MockToken internal token;
    MockIdentity internal identity;
    MockPyth internal pyth;
    MockTeleporterMessenger internal teleporter;

    address internal owner = makeAddr("owner");
    address internal operator = makeAddr("operator");
    address internal dexA = address(0xA1);
    address internal dexB = address(0xB2);

    uint256 internal constant AGENT_ID = 1599;
    uint256 internal constant PER_TX = 200e6;
    uint256 internal constant BUDGET = 500e6;
    bytes32 internal constant REQUEST_HASH = keccak256("verglas-window-1");
    bytes32 internal constant PRICE_ID = keccak256("usd-try");
    uint256 internal constant REF_RATE = 47_00000000;

    // The exact proof VerglasHubTest uses (scripts/prove.js, 100e6/50e6/25e6 window).
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
    uint256 internal constant FINAL_COMMITMENT = 0x26c940775b3a475a598ceabb052a8fb0c9669be2ae1e5b182a51bc1900848e03;

    function setUp() public {
        token = new MockToken();
        identity = new MockIdentity();
        pyth = new MockPyth();
        verifier = new Groth16Verifier();
        registry = new ValidationRegistry(identity);
        teleporter = new MockTeleporterMessenger();
        hub = new VerglasHub(registry, identity, verifier, ITeleporterMessenger(address(teleporter)));

        address[] memory wl = new address[](2);
        wl[0] = dexA;
        wl[1] = dexB;
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        account = new VerglasAccount(owner, predicted, address(token), PER_TX, BUDGET, wl);
        treasurer = new VerglasTreasurer(
            account,
            operator,
            IPyth(address(pyth)),
            PRICE_ID,
            VerglasTreasurer.Policy({dailyLimit: 1000e6, maxSlippageBps: 200, referenceRateUsdTry: REF_RATE})
        );
        token.mint(address(account), 1000e6);
        pyth.setPrice(int64(uint64(REF_RATE)), -8, block.timestamp);
        vm.deal(operator, 1 ether);

        identity.set(AGENT_ID, owner);
        vm.prank(owner);
        hub.bindAccount(AGENT_ID, address(account));
        vm.prank(owner);
        registry.validationRequest(address(hub), AGENT_ID, "ipfs://request", REQUEST_HASH);
    }

    function _publicSignals() internal pure returns (uint256[12] memory ps) {
        ps[1] = FINAL_COMMITMENT;
        ps[2] = 3;
        ps[3] = uint256(uint160(address(0xA1)));
        ps[4] = uint256(uint160(address(0xB2)));
        ps[11] = PER_TX;
    }

    function test_FullPipeline_TreasurerAccountHubProof() public {
        bytes[] memory update = new bytes[](1);
        vm.startPrank(operator);
        treasurer.payFX{value: 1}(dexA, 100e6, update);
        treasurer.payFX{value: 1}(dexB, 50e6, update);
        treasurer.payFX{value: 1}(dexA, 25e6, update);
        vm.stopPrank();

        // The commitment chain is identical to a direct-agent window.
        assertEq(account.commitment(), FINAL_COMMITMENT);

        hub.submitProof(AGENT_ID, REQUEST_HASH, pA, pB, pC, _publicSignals(), "ipfs://response", keccak256("resp"));
        (address validator,, uint8 score,,,) = registry.getValidationStatus(REQUEST_HASH);
        assertEq(validator, address(hub));
        assertEq(score, 100);
    }
}
