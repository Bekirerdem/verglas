// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IPyth, PythStructs} from "../../src/interfaces/IPyth.sol";

/// @notice Minimal Pyth double for treasurer tests: the price is whatever the
///         test sets, the fee is fixed, and staleness reverts like the real one.
contract MockPyth is IPyth {
    uint256 public constant FEE = 1 wei;

    PythStructs.Price internal current;
    uint256 public updateCalls;

    error StalePrice();
    error InsufficientMockFee();

    function setPrice(int64 price, int32 expo, uint256 publishTime) external {
        current = PythStructs.Price({price: price, conf: 0, expo: expo, publishTime: publishTime});
    }

    function getPriceNoOlderThan(bytes32, uint256 age) external view returns (PythStructs.Price memory) {
        if (current.publishTime + age < block.timestamp) revert StalePrice();
        return current;
    }

    function getUpdateFee(bytes[] calldata) external pure returns (uint256) {
        return FEE;
    }

    function updatePriceFeeds(bytes[] calldata) external payable {
        if (msg.value < FEE) revert InsufficientMockFee();
        updateCalls++;
    }
}
