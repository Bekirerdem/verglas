// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {VerglasOracle} from "../src/VerglasOracle.sol";
import {VerglasAccount} from "../src/VerglasAccount.sol";
import {VerglasTreasurer} from "../src/VerglasTreasurer.sol";
import {IPyth, PythStructs} from "../src/interfaces/IPyth.sol";

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

/// @notice Oracle shim unit tests: only a keeper-signed payload moves the price,
///         every sanity guard bites, and the Pyth read semantics (staleness
///         revert, unsafe read) match what the treasurer and console expect.
contract VerglasOracleTest is Test {
    VerglasOracle internal oracle;

    address internal keeper;
    uint256 internal keeperKey;
    address internal stranger;
    uint256 internal strangerKey;

    bytes32 internal constant PRICE_ID = keccak256("usd-try");
    int64 internal constant RATE = 47_00000000; // 47.0 USD/TRY at 1e8

    function setUp() public {
        (keeper, keeperKey) = makeAddrAndKey("keeper");
        (stranger, strangerKey) = makeAddrAndKey("stranger");
        oracle = new VerglasOracle(keeper);
        vm.warp(1_770_000_000); // realistic clock so publishTime math is honest
    }

    function _signed(bytes32 id, int64 price, uint64 conf, int32 expo, uint256 publishTime, uint256 key)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            bytes.concat(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, address(oracle), id, price, conf, expo, publishTime))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encode(
            VerglasOracle.PricePayload({
                id: id,
                price: price,
                conf: conf,
                expo: expo,
                publishTime: publishTime,
                signature: abi.encodePacked(r, s, v)
            })
        );
    }

    function _push(int64 price, uint256 publishTime) internal {
        bytes[] memory update = new bytes[](1);
        update[0] = _signed(PRICE_ID, price, 0, -8, publishTime, keeperKey);
        oracle.updatePriceFeeds(update);
    }

    function test_KeeperSignedPushStoresAndReads() public {
        _push(RATE, block.timestamp);

        PythStructs.Price memory p = oracle.getPriceUnsafe(PRICE_ID);
        assertEq(p.price, RATE);
        assertEq(p.expo, -8);
        assertEq(p.publishTime, block.timestamp);

        p = oracle.getPriceNoOlderThan(PRICE_ID, 60);
        assertEq(p.price, RATE);
    }

    function test_UpdateFeeIsZero() public view {
        bytes[] memory update = new bytes[](2);
        assertEq(oracle.getUpdateFee(update), 0);
    }

    function test_RevertWhen_SignerNotKeeper() public {
        bytes[] memory update = new bytes[](1);
        update[0] = _signed(PRICE_ID, RATE, 0, -8, block.timestamp, strangerKey);
        vm.expectRevert(VerglasOracle.BadSignature.selector);
        oracle.updatePriceFeeds(update);
    }

    function test_RevertWhen_PayloadTampered() public {
        // Sign one price, then swap a different price into the payload.
        bytes memory signed = _signed(PRICE_ID, RATE, 0, -8, block.timestamp, keeperKey);
        VerglasOracle.PricePayload memory p = abi.decode(signed, (VerglasOracle.PricePayload));
        p.price = RATE + 1e8;

        bytes[] memory update = new bytes[](1);
        update[0] = abi.encode(p);
        vm.expectRevert(VerglasOracle.BadSignature.selector);
        oracle.updatePriceFeeds(update);
    }

    function test_RevertWhen_ValueSent() public {
        bytes[] memory update = new bytes[](1);
        update[0] = _signed(PRICE_ID, RATE, 0, -8, block.timestamp, keeperKey);
        vm.deal(address(this), 1 ether);
        vm.expectRevert(VerglasOracle.NoFeeRequired.selector);
        oracle.updatePriceFeeds{value: 1}(update);
    }

    function test_RevertWhen_PublishTimeNotMonotonic() public {
        _push(RATE, block.timestamp);

        // Same publishTime again — replaying the very same signed payload.
        bytes[] memory update = new bytes[](1);
        update[0] = _signed(PRICE_ID, RATE, 0, -8, block.timestamp, keeperKey);
        vm.expectRevert(abi.encodeWithSelector(VerglasOracle.NotMonotonic.selector, block.timestamp, block.timestamp));
        oracle.updatePriceFeeds(update);
    }

    function test_RevertWhen_PublishTimeInFuture() public {
        uint256 future = block.timestamp + oracle.MAX_FUTURE_SKEW() + 1;
        bytes[] memory update = new bytes[](1);
        update[0] = _signed(PRICE_ID, RATE, 0, -8, future, keeperKey);
        vm.expectRevert(abi.encodeWithSelector(VerglasOracle.FuturePayload.selector, future, block.timestamp));
        oracle.updatePriceFeeds(update);
    }

    function test_RevertWhen_PriceNotPositive() public {
        bytes[] memory update = new bytes[](1);
        update[0] = _signed(PRICE_ID, 0, 0, -8, block.timestamp, keeperKey);
        vm.expectRevert(VerglasOracle.BadPrice.selector);
        oracle.updatePriceFeeds(update);
    }

    function test_RevertWhen_DeviationExceedsBound() public {
        _push(RATE, block.timestamp);

        // 10% is the bound; 10.01% must trip.
        int64 moved = RATE + int64(uint64((uint256(uint64(RATE)) * 1001) / 10_000));
        bytes[] memory update = new bytes[](1);
        update[0] = _signed(PRICE_ID, moved, 0, -8, block.timestamp + 1, keeperKey);
        vm.expectRevert(
            abi.encodeWithSelector(
                VerglasOracle.DeviationTooLarge.selector, uint256(uint64(moved)), uint256(uint64(RATE))
            )
        );
        oracle.updatePriceFeeds(update);
    }

    function test_DeviationExactlyAtBoundPasses() public {
        _push(RATE, block.timestamp);

        int64 moved = RATE - int64(uint64((uint256(uint64(RATE)) * 1000) / 10_000));
        _push(moved, block.timestamp + 1);
        assertEq(oracle.getPriceUnsafe(PRICE_ID).price, moved);
    }

    function test_DeviationGuardIsExponentAgnostic() public {
        _push(RATE, block.timestamp);

        // Same 47.0 rate reported at expo -5 — zero deviation, must pass.
        bytes[] memory update = new bytes[](1);
        update[0] = _signed(PRICE_ID, 4_700_000, 0, -5, block.timestamp + 1, keeperKey);
        oracle.updatePriceFeeds(update);

        PythStructs.Price memory p = oracle.getPriceUnsafe(PRICE_ID);
        assertEq(p.price, 4_700_000);
        assertEq(p.expo, -5);
    }

    function test_RevertWhen_PriceStale() public {
        _push(RATE, block.timestamp);
        vm.warp(block.timestamp + 61);
        vm.expectRevert(VerglasOracle.StalePrice.selector);
        oracle.getPriceNoOlderThan(PRICE_ID, 60);

        // The unsafe read still serves the old price (console semantics).
        assertEq(oracle.getPriceUnsafe(PRICE_ID).price, RATE);
    }

    function test_RevertWhen_NoPriceYet() public {
        vm.expectRevert(abi.encodeWithSelector(VerglasOracle.PriceUnavailable.selector, PRICE_ID));
        oracle.getPriceUnsafe(PRICE_ID);
        vm.expectRevert(abi.encodeWithSelector(VerglasOracle.PriceUnavailable.selector, PRICE_ID));
        oracle.getPriceNoOlderThan(PRICE_ID, 60);
    }

    function test_OwnerRotatesKeeper() public {
        (address newKeeper, uint256 newKey) = makeAddrAndKey("newKeeper");
        oracle.setKeeper(newKeeper);

        // The old key is out...
        bytes[] memory update = new bytes[](1);
        update[0] = _signed(PRICE_ID, RATE, 0, -8, block.timestamp, keeperKey);
        vm.expectRevert(VerglasOracle.BadSignature.selector);
        oracle.updatePriceFeeds(update);

        // ...and the new one is in.
        update[0] = _signed(PRICE_ID, RATE, 0, -8, block.timestamp, newKey);
        oracle.updatePriceFeeds(update);
        assertEq(oracle.getPriceUnsafe(PRICE_ID).price, RATE);
    }

    function test_RevertWhen_SetKeeperCallerNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(VerglasOracle.NotOwner.selector);
        oracle.setKeeper(stranger);
    }
}

/// @notice The load-bearing integration: the treasurer runs `payFX` against the
///         shim exactly as it did against Pyth — fee query, keeper-signed feed
///         update, staleness-checked read and the FX breaker — in a single tx.
contract VerglasOracleTreasurerIntegrationTest is Test {
    VerglasOracle internal oracle;
    VerglasAccount internal account;
    VerglasTreasurer internal treasurer;
    MockToken internal token;

    address internal keeper;
    uint256 internal keeperKey;
    address internal owner = makeAddr("owner");
    address internal dexA = address(0xA1);

    bytes32 internal constant PRICE_ID = keccak256("usd-try");
    int64 internal constant RATE = 47_00000000;

    function setUp() public {
        (keeper, keeperKey) = makeAddrAndKey("keeper");
        oracle = new VerglasOracle(keeper);
        token = new MockToken();
        vm.warp(1_770_000_000);

        address[] memory wl = new address[](1);
        wl[0] = dexA;
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        account = new VerglasAccount(owner, predicted, address(token), 5e6, 100e6, wl);
        treasurer = new VerglasTreasurer(
            account,
            keeper, // the keeper key is also the payFX operator, as on Fuji
            IPyth(address(oracle)),
            PRICE_ID,
            VerglasTreasurer.Policy({dailyLimit: 10e6, maxSlippageBps: 200, referenceRateUsdTry: uint256(uint64(RATE))})
        );
        token.mint(address(account), 50e6);
    }

    function test_PayFXRunsAgainstShimInOneTx() public {
        bytes32 digest = keccak256(
            bytes.concat(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encode(block.chainid, address(oracle), PRICE_ID, RATE, uint64(0), int32(-8), block.timestamp)
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(keeperKey, digest);

        bytes[] memory update = new bytes[](1);
        update[0] = abi.encode(
            VerglasOracle.PricePayload({
                id: PRICE_ID,
                price: RATE,
                conf: 0,
                expo: -8,
                publishTime: block.timestamp,
                signature: abi.encodePacked(r, s, v)
            })
        );

        vm.prank(keeper);
        treasurer.payFX(dexA, 3e6, update); // zero fee — no value attached

        assertEq(token.balanceOf(dexA), 3e6);
        assertEq(treasurer.spentToday(), 3e6);
        assertEq(oracle.getPriceUnsafe(PRICE_ID).price, RATE);
    }

    function test_PayFXRevertsOnStaleShimPrice() public {
        // Seed a price, let it age past MAX_PRICE_AGE, then pay with no update.
        bytes32 digest = keccak256(
            bytes.concat(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encode(block.chainid, address(oracle), PRICE_ID, RATE, uint64(0), int32(-8), block.timestamp)
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(keeperKey, digest);
        bytes[] memory update = new bytes[](1);
        update[0] = abi.encode(
            VerglasOracle.PricePayload({
                id: PRICE_ID,
                price: RATE,
                conf: 0,
                expo: -8,
                publishTime: block.timestamp,
                signature: abi.encodePacked(r, s, v)
            })
        );
        oracle.updatePriceFeeds(update);

        vm.warp(block.timestamp + 27 hours);
        bytes[] memory empty = new bytes[](0);
        vm.prank(keeper);
        vm.expectRevert(VerglasOracle.StalePrice.selector);
        treasurer.payFX(dexA, 1e6, empty);
    }
}
