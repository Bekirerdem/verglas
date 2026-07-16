// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {VerglasAccount} from "./VerglasAccount.sol";
import {IPyth, PythStructs} from "./interfaces/IPyth.sol";

/// @title VerglasTreasurer — a corporate treasury brain on top of a VerglasAccount
/// @notice The treasurer is the account's `agent`: it adds the two treasury rules
///         the vault itself does not know about — a per-calendar-day spending cap
///         and an FX circuit-breaker checked against a live Pyth price — and then
///         delegates to `account.spend()`, where the whitelist, per-tx limit,
///         total budget and the owner's freeze are enforced as always. Because the
///         account never cares who its agent is, the treasurer's vault inherits the
///         weekly ZK policy-compliance proof machinery unchanged.
/// @dev Composition, not modification: `VerglasAccount` stays untouched. If the
///      owner freezes the account directly, `payFX` reverts inside `spend()` no
///      matter what state the treasurer is in — the vault's brake always wins.
contract VerglasTreasurer {
    /// @notice Treasury policy, owner-set as one unit (mirrors Hazinedar's Policy).
    /// @dev `referenceRateUsdTry` is the USD/TRY rate the owner underwrote the
    ///      current payment run at, in 1e8 fixed-point. `maxSlippageBps` bounds how
    ///      far the live market may drift from it before autonomous payments stop
    ///      and a human has to look again. There is no on-chain swap (the ramp is
    ///      outside the product), so this is a circuit-breaker, not AMM slippage.
    struct Policy {
        uint256 dailyLimit;
        uint32 maxSlippageBps;
        uint256 referenceRateUsdTry;
    }

    /// @dev All rate comparisons happen at this fixed-point exponent.
    int32 internal constant TARGET_EXPO = -8;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /// @dev FX feeds pause on weekends ("schedule"-tagged); one closed day must
    ///      not brick the treasurer, but a multi-day-stale price must never pass.
    uint256 public constant MAX_PRICE_AGE = 26 hours;

    address public immutable owner;
    VerglasAccount public immutable account;
    IPyth public immutable pyth;
    bytes32 public immutable priceId;

    /// @notice The keeper key allowed to trigger payments. Rotatable by the owner
    ///         (Hazinedar's set_agent recoverability, reborn).
    address public operator;
    bool public paused;
    Policy public policy;

    /// @notice USDC spent per calendar-day epoch (block.timestamp / 1 days).
    ///         Lazily initialized — a new day starts at zero without a reset tx.
    mapping(uint256 => uint256) public spentOfDay;

    event FxPayment(address indexed supplier, uint256 amount, uint256 rateUsdTry, uint256 indexed day);
    event PolicySet(uint256 dailyLimit, uint32 maxSlippageBps, uint256 referenceRateUsdTry);
    event OperatorSet(address indexed operator);
    event Paused();
    event Unpaused();

    error NotOwner();
    error NotOperator();
    error TreasurerPaused();
    error ZeroAddress();
    error ZeroAmount();
    error ZeroReferenceRate();
    error DailyLimitExceeded(uint256 wouldBe, uint256 limit);
    error SlippageExceeded(uint256 currentRate, uint256 referenceRate, uint32 maxSlippageBps);
    error InsufficientFee(uint256 sent, uint256 required);
    error BadPythPrice();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(VerglasAccount account_, address operator_, IPyth pyth_, bytes32 priceId_, Policy memory policy_) {
        if (operator_ == address(0) || address(pyth_) == address(0)) revert ZeroAddress();
        if (policy_.referenceRateUsdTry == 0) revert ZeroReferenceRate();
        owner = account_.owner();
        account = account_;
        pyth = pyth_;
        priceId = priceId_;
        operator = operator_;
        policy = policy_;
    }

    /// @notice The keeper's only door. Refreshes the Pyth feed, checks the FX
    ///         circuit-breaker and the daily cap, then lets the vault enforce
    ///         everything else (whitelist, per-tx limit, budget, freeze).
    /// @param supplier    Payee — must be on the account's whitelist.
    /// @param amountUsdc  Amount in USDC base units (6 decimals).
    /// @param priceUpdate Hermes update data for `priceId`; msg.value covers the fee.
    function payFX(address supplier, uint256 amountUsdc, bytes[] calldata priceUpdate) external payable {
        if (msg.sender != operator) revert NotOperator();
        if (paused) revert TreasurerPaused();
        if (amountUsdc == 0) revert ZeroAmount();

        uint256 fee = pyth.getUpdateFee(priceUpdate);
        if (msg.value < fee) revert InsufficientFee(msg.value, fee);
        pyth.updatePriceFeeds{value: fee}(priceUpdate);

        PythStructs.Price memory p = pyth.getPriceNoOlderThan(priceId, MAX_PRICE_AGE);
        if (p.price <= 0) revert BadPythPrice();
        uint256 currentRate = _normalize(uint256(uint64(p.price)), p.expo);

        Policy memory pol = policy;
        uint256 deviation = currentRate > pol.referenceRateUsdTry
            ? currentRate - pol.referenceRateUsdTry
            : pol.referenceRateUsdTry - currentRate;
        if (deviation * BPS_DENOMINATOR > pol.referenceRateUsdTry * pol.maxSlippageBps) {
            revert SlippageExceeded(currentRate, pol.referenceRateUsdTry, pol.maxSlippageBps);
        }

        uint256 day = block.timestamp / 1 days;
        uint256 spent = spentOfDay[day] + amountUsdc;
        if (spent > pol.dailyLimit) revert DailyLimitExceeded(spent, pol.dailyLimit);
        spentOfDay[day] = spent;

        account.spend(supplier, amountUsdc);
        emit FxPayment(supplier, amountUsdc, currentRate, day);
    }

    /// @notice USDC spent in the current calendar-day epoch.
    function spentToday() external view returns (uint256) {
        return spentOfDay[block.timestamp / 1 days];
    }

    function setPolicy(Policy calldata policy_) external onlyOwner {
        if (policy_.referenceRateUsdTry == 0) revert ZeroReferenceRate();
        policy = policy_;
        emit PolicySet(policy_.dailyLimit, policy_.maxSlippageBps, policy_.referenceRateUsdTry);
    }

    /// @notice Keeper recoverability: rotate the operator without touching funds.
    function setOperator(address operator_) external onlyOwner {
        if (operator_ == address(0)) revert ZeroAddress();
        operator = operator_;
        emit OperatorSet(operator_);
    }

    /// @notice A treasurer-local brake — stops FX payments without freezing the
    ///         vault itself. The account's own freeze() sits above this one.
    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    /// @dev Pyth reports prices at a feed-chosen exponent (USD/TRY was -5 at the
    ///      time of writing); normalize to TARGET_EXPO so policy comparisons never
    ///      depend on what the feed happens to report.
    function _normalize(uint256 price, int32 expo) internal pure returns (uint256) {
        if (expo == TARGET_EXPO) return price;
        if (expo > TARGET_EXPO) return price * (10 ** uint32(int32(expo - TARGET_EXPO)));
        return price / (10 ** uint32(int32(TARGET_EXPO - expo)));
    }
}
