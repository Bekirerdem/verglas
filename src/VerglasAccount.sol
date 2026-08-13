// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title VerglasAccount — a proof-generating bounded spend account for AI agents
/// @notice The rule engine lives in the contract: the owner sets the bounds, the agent
///         spends inside them, and every spend is folded into a Poseidon hash chain.
///         A weekly ZK proof (circuit #1: policy compliance) opens that chain to show
///         "every destination was whitelisted and every amount was under the limit"
///         without revealing any individual transaction.
/// @dev Commitment scheme (see architecture/2026-07-12-m1-teknik-tasarim):
///        leaf = Poseidon(to, amount)
///        c    = Poseidon(c_prev, leaf)
///      Total-budget and tx-count policies are enforced on-chain instantly via public
///      counters and are therefore NOT part of the circuit; only privacy-sensitive
///      checks (destination membership, per-tx amount) are proven in ZK.
///
///      Structure vs fuel: the whitelist and per-tx limit are STRUCTURE — they are
///      bound into every proof window as public inputs, so they are fixed at birth.
///      The total budget is FUEL — it lives outside the circuit, so the owner may
///      top it up (never mid-window semantics to break) instead of abandoning the
///      vault once the initial allowance is spent.
contract VerglasAccount {
    /// @dev BN254 scalar field — Poseidon inputs must stay below this.
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /// @dev Kept small so the whitelist fits as public inputs of circuit #1.
    uint256 public constant MAX_WHITELIST = 8;

    address public immutable owner;
    address public immutable agent;
    IERC20 public immutable token;
    uint256 public immutable perTxLimit;

    /// @notice Cumulative cap per rolling 24h window, 0 = no daily cap.
    ///         Like the total budget this is enforced through public counters —
    ///         instant, on-chain, outside the circuit — so it needs no change
    ///         to the proof system. Fixed at birth like the per-tx limit.
    uint256 public immutable dailyLimit;

    /// @notice The agent's lifetime spending allowance. Owner-increasable (fuel,
    ///         not structure — see the contract-level note); never decreasable,
    ///         the brake for "stop spending" is freeze().
    uint256 public totalBudget;

    address[] public whitelist;
    mapping(address => bool) public isWhitelisted;

    /// @notice Poseidon hash chain over all spends (starts at 0).
    uint256 public commitment;
    uint256 public txCount;
    uint256 public totalSpent;
    bool public frozen;

    /// @dev The 24h window opens with the first spend after the previous
    ///      window expires; it is not calendar-aligned.
    uint256 public dayStart;
    uint256 public spentToday;

    event Spend(address indexed to, uint256 amount, uint256 indexed txIndex, uint256 newCommitment);
    event Frozen();
    event Unfrozen();
    event OwnerWithdraw(address indexed to, uint256 amount);
    event BudgetIncreased(uint256 added, uint256 newBudget);

    error NotOwner();
    error NotAgent();
    error AccountFrozen();
    error NotInWhitelist(address to);
    error PerTxLimitExceeded(uint256 amount, uint256 limit);
    error DailyLimitExceeded(uint256 wouldBe, uint256 limit);
    error BudgetExceeded(uint256 wouldBe, uint256 budget);
    error BadWhitelistLength();
    error ZeroAddress();
    error ZeroAmount();
    error LimitAboveField();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address owner_,
        address agent_,
        address token_,
        uint256 perTxLimit_,
        uint256 dailyLimit_,
        uint256 totalBudget_,
        address[] memory whitelist_
    ) {
        if (owner_ == address(0) || agent_ == address(0) || token_ == address(0)) {
            revert ZeroAddress();
        }
        if (whitelist_.length == 0 || whitelist_.length > MAX_WHITELIST) revert BadWhitelistLength();
        // Amounts are bounded by perTxLimit, so keeping the limit below the field
        // keeps every Poseidon input in range.
        if (perTxLimit_ >= SNARK_SCALAR_FIELD) revert LimitAboveField();

        owner = owner_;
        agent = agent_;
        token = IERC20(token_);
        perTxLimit = perTxLimit_;
        dailyLimit = dailyLimit_;
        totalBudget = totalBudget_;
        dayStart = block.timestamp;

        for (uint256 i = 0; i < whitelist_.length; i++) {
            address dest = whitelist_[i];
            if (dest == address(0)) revert ZeroAddress();
            if (!isWhitelisted[dest]) {
                isWhitelisted[dest] = true;
                whitelist.push(dest);
            }
        }
    }

    /// @notice The agent's only door to the funds — every rule is checked here.
    function spend(address to, uint256 amount) external {
        if (msg.sender != agent) revert NotAgent();
        if (frozen) revert AccountFrozen();
        if (!isWhitelisted[to]) revert NotInWhitelist(to);
        if (amount > perTxLimit) revert PerTxLimitExceeded(amount, perTxLimit);
        if (dailyLimit != 0) {
            if (block.timestamp >= dayStart + 1 days) {
                dayStart = block.timestamp;
                spentToday = 0;
            }
            uint256 newToday = spentToday + amount;
            if (newToday > dailyLimit) revert DailyLimitExceeded(newToday, dailyLimit);
            spentToday = newToday;
        }
        uint256 newTotal = totalSpent + amount;
        if (newTotal > totalBudget) revert BudgetExceeded(newTotal, totalBudget);

        totalSpent = newTotal;
        uint256 txIndex = txCount++;
        uint256 leaf = PoseidonT3.hash([uint256(uint160(to)), amount]);
        uint256 newCommitment = PoseidonT3.hash([commitment, leaf]);
        commitment = newCommitment;

        if (!token.transfer(to, amount)) revert TransferFailed();
        emit Spend(to, amount, txIndex, newCommitment);
    }

    /// @notice The brake: the owner can cut the agent off at any moment.
    function freeze() external onlyOwner {
        frozen = true;
        emit Frozen();
    }

    function unfreeze() external onlyOwner {
        frozen = false;
        emit Unfrozen();
    }

    /// @notice Refuel: raise the agent's lifetime allowance. Increase-only — the
    ///         way to spend less is freeze(), not a retroactive budget cut.
    function increaseBudget(uint256 addedBudget) external onlyOwner {
        if (addedBudget == 0) revert ZeroAmount();
        totalBudget += addedBudget;
        emit BudgetIncreased(addedBudget, totalBudget);
    }

    /// @notice Owner exit — funds are never locked away from their owner, frozen or not.
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (!token.transfer(to, amount)) revert TransferFailed();
        emit OwnerWithdraw(to, amount);
    }

    function whitelistLength() external view returns (uint256) {
        return whitelist.length;
    }

    /// @notice What the current 24h window has consumed — 0 once it expires.
    function dailySpentNow() external view returns (uint256) {
        if (dailyLimit == 0 || block.timestamp >= dayStart + 1 days) return 0;
        return spentToday;
    }
}
