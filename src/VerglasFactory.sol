// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {VerglasAccount} from "./VerglasAccount.sol";

/// @title VerglasFactory — one call deploys an owner-bound VerglasAccount
/// @notice The console's "create your vault" door. The caller becomes the
///         vault's owner; the factory holds no funds, has no owner and can
///         never touch a vault after birth — it only remembers who made what.
contract VerglasFactory {
    event VaultCreated(address indexed owner, address indexed account, address agent, address token);

    mapping(address => address[]) internal _vaultsOf;

    /// @param agent      The only address allowed to spend (the bot / keeper).
    /// @param token      ERC-20 the vault holds (USDC on Fuji).
    /// @param perTxLimit Max amount of a single spend, token base units.
    /// @param dailyLimit Cumulative cap per rolling 24h window, 0 = none.
    /// @param totalBudget Lifetime spend ceiling, token base units.
    /// @param whitelist  Allowed destinations (1..8, deduplicated by the vault).
    function createVault(
        address agent,
        address token,
        uint256 perTxLimit,
        uint256 dailyLimit,
        uint256 totalBudget,
        address[] calldata whitelist
    ) external returns (address account) {
        account = address(new VerglasAccount(msg.sender, agent, token, perTxLimit, dailyLimit, totalBudget, whitelist));
        _vaultsOf[msg.sender].push(account);
        emit VaultCreated(msg.sender, account, agent, token);
    }

    function vaultsOf(address owner) external view returns (address[] memory) {
        return _vaultsOf[owner];
    }
}
