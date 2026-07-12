// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {TeleporterMessageInput} from "../../src/interfaces/ITeleporterMessenger.sol";
import {ITeleporterReceiver} from "../../src/interfaces/ITeleporterReceiver.sol";

/// @notice Test double for the canonical Teleporter messenger: records the last
///         sendCrossChainMessage input and can replay it into a receiver, so a
///         two-chain hop runs inside a single EVM. Only the send path of
///         ITeleporterMessenger is implemented; callers cast the address.
contract MockTeleporterMessenger {
    bytes32 public lastDestinationBlockchainID;
    address public lastDestinationAddress;
    uint256 public lastRequiredGasLimit;
    bytes public lastMessage;
    uint256 public sendCount;

    function sendCrossChainMessage(TeleporterMessageInput calldata input) external returns (bytes32) {
        lastDestinationBlockchainID = input.destinationBlockchainID;
        lastDestinationAddress = input.destinationAddress;
        lastRequiredGasLimit = input.requiredGasLimit;
        lastMessage = input.message;
        sendCount++;
        return keccak256(abi.encode(sendCount, input.destinationBlockchainID));
    }

    /// @notice Delivers the last recorded message as the Teleporter would:
    ///         msg.sender is this mock, source chain and origin sender are the
    ///         relayer-attested values passed in.
    function deliverLast(address receiver, bytes32 sourceBlockchainID, address originSenderAddress) external {
        ITeleporterReceiver(receiver).receiveTeleporterMessage(sourceBlockchainID, originSenderAddress, lastMessage);
    }
}
