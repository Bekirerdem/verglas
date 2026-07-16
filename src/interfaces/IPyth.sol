// (c) Pyth Data Association. All rights reserved.
// See https://github.com/pyth-network/pyth-sdk-solidity for licensing terms.

// SPDX-License-Identifier: Apache-2.0

// Vendored from pyth-network/pyth-sdk-solidity (IPyth.sol / PythStructs.sol);
// trimmed to exactly the types and functions VerglasTreasurer calls,
// no semantic changes.

pragma solidity 0.8.25;

library PythStructs {
    // A price with a degree of uncertainty, represented as a price +- a
    // confidence interval, exposed at a fixed-point exponent (usually negative).
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
}

interface IPyth {
    /// @notice Returns the price of a price feed without older than `age` seconds
    ///         of the current time. Reverts with StalePrice if not satisfied.
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (PythStructs.Price memory price);

    /// @notice Returns the required fee to update an array of price updates.
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 feeAmount);

    /// @notice Updates price feeds with the given update messages (from Hermes).
    ///         The caller must pay at least `getUpdateFee(updateData)` wei.
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
}
