// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title VerglasDispenser — a tiny testnet USDC tap for workshops
/// @notice Anyone can claim a fixed drip once per cooldown into their own
///         wallet; the owner refills the pool by plain ERC-20 transfer and
///         can sweep it back. Testnet-only convenience, not a product surface.
contract VerglasDispenser {
    uint256 public constant COOLDOWN = 24 hours;

    IERC20 public immutable token;
    address public immutable owner;
    uint256 public amountPerClaim;
    mapping(address => uint256) public lastClaim;

    event Claimed(address indexed to, uint256 amount);

    error NotOwner();
    error CooldownActive(uint256 nextClaimAt);
    error TransferFailed();
    error ZeroAddress();

    constructor(IERC20 token_, uint256 amountPerClaim_) {
        token = token_;
        owner = msg.sender;
        amountPerClaim = amountPerClaim_;
    }

    function claim() external {
        uint256 last = lastClaim[msg.sender];
        if (last != 0 && block.timestamp < last + COOLDOWN) {
            revert CooldownActive(last + COOLDOWN);
        }
        lastClaim[msg.sender] = block.timestamp;
        if (!token.transfer(msg.sender, amountPerClaim)) revert TransferFailed();
        emit Claimed(msg.sender, amountPerClaim);
    }

    function nextClaimAt(address who) external view returns (uint256) {
        uint256 last = lastClaim[who];
        return last == 0 ? 0 : last + COOLDOWN;
    }

    function setAmount(uint256 amountPerClaim_) external {
        if (msg.sender != owner) revert NotOwner();
        amountPerClaim = amountPerClaim_;
    }

    function sweep(address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();
        if (!token.transfer(to, amount)) revert TransferFailed();
    }
}
