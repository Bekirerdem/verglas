// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IPyth, PythStructs} from "./interfaces/IPyth.sol";

/// @title VerglasOracle — an IPyth-compatible price shim fed by the keeper
/// @notice Pyth's free Hermes endpoint shuts down with the July 2026 protocol
///         migration, which would silently starve the treasurer's FX
///         circuit-breaker. This shim keeps the exact IPyth surface the
///         treasurer was built against, but the update data is produced by the
///         Verglas keeper from independent FX reference sources and signed with
///         the keeper key. Push authority is cryptographic, not caller-based:
///         `updatePriceFeeds` is reached through the treasurer's `payFX`, so a
///         `msg.sender` check would never see the keeper.
/// @dev The treasurer holds this address as an immutable `IPyth`, calls
///      `getUpdateFee` → `updatePriceFeeds` → `getPriceNoOlderThan` in one tx,
///      and normalizes exponents itself — none of that changes here. The web
///      console and keeper service additionally read `getPriceUnsafe`, which the
///      real Pyth exposes but the vendored interface trims; it is provided as a
///      plain function.
contract VerglasOracle {
    /// @dev One signed price observation. The signature is a 65-byte ECDSA
    ///      signature by the keeper over the EIP-191 hash of
    ///      `abi.encode(block.chainid, oracle, id, price, conf, expo, publishTime)`
    ///      — chain id and oracle address pin the payload to this deployment.
    struct PricePayload {
        bytes32 id;
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
        bytes signature;
    }

    /// @dev All deviation comparisons happen at this fixed-point exponent
    ///      (same convention as the treasurer).
    int32 internal constant TARGET_EXPO = -8;

    /// @notice Fat-finger guard: a new price may not deviate more than this from
    ///         the previous one (first push is exempt). USD/TRY rarely moves 2-3%
    ///         a day; 10% is a generous bound against a bad source read.
    uint256 public constant MAX_DEVIATION_BPS = 1000;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /// @notice Tolerated clock skew for `publishTime` against block time.
    uint256 public constant MAX_FUTURE_SKEW = 5 minutes;

    address public immutable owner;

    /// @notice The key whose signature authorizes price pushes. Rotatable by the
    ///         owner (same recoverability posture as the treasurer's operator).
    address public keeper;

    mapping(bytes32 => PythStructs.Price) internal prices;

    event PriceUpdated(bytes32 indexed id, int64 price, uint64 conf, int32 expo, uint256 publishTime);
    event KeeperSet(address indexed keeper);

    error NotOwner();
    error ZeroAddress();
    error NoFeeRequired();
    error BadSignature();
    error BadPrice();
    error NotMonotonic(uint256 publishTime, uint256 stored);
    error FuturePayload(uint256 publishTime, uint256 blockTime);
    error DeviationTooLarge(uint256 newRate, uint256 previousRate);
    error PriceUnavailable(bytes32 id);
    error StalePrice();

    constructor(address keeper_) {
        if (keeper_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// @notice Pyth-compatible: updates are free here — the keeper pays gas, not fees.
    function getUpdateFee(bytes[] calldata) external pure returns (uint256) {
        return 0;
    }

    /// @notice Pyth-compatible entry: decode, verify the keeper signature and the
    ///         sanity guards, then store. Callable by anyone carrying a validly
    ///         signed payload (in practice: the treasurer inside `payFX`, or the
    ///         keeper directly).
    function updatePriceFeeds(bytes[] calldata updateData) external payable {
        if (msg.value != 0) revert NoFeeRequired();
        for (uint256 i = 0; i < updateData.length; i++) {
            _apply(abi.decode(updateData[i], (PricePayload)));
        }
    }

    /// @notice Pyth-compatible read with staleness enforcement (reverts like the real one).
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (PythStructs.Price memory price) {
        price = prices[id];
        if (price.publishTime == 0) revert PriceUnavailable(id);
        if (block.timestamp > price.publishTime + age) revert StalePrice();
    }

    /// @notice Pyth-compatible read without an age check (console display, keeper telemetry).
    function getPriceUnsafe(bytes32 id) external view returns (PythStructs.Price memory price) {
        price = prices[id];
        if (price.publishTime == 0) revert PriceUnavailable(id);
    }

    /// @notice Keeper recoverability: rotate the signing key without redeploying
    ///         the oracle (the treasurer's reference to it is immutable).
    function setKeeper(address keeper_) external {
        if (msg.sender != owner) revert NotOwner();
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function _apply(PricePayload memory p) internal {
        bytes32 digest = keccak256(
            bytes.concat(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, address(this), p.id, p.price, p.conf, p.expo, p.publishTime))
            )
        );
        if (_recover(digest, p.signature) != keeper) revert BadSignature();

        if (p.price <= 0) revert BadPrice();
        PythStructs.Price storage stored = prices[p.id];
        if (p.publishTime <= stored.publishTime) revert NotMonotonic(p.publishTime, stored.publishTime);
        if (p.publishTime > block.timestamp + MAX_FUTURE_SKEW) {
            revert FuturePayload(p.publishTime, block.timestamp);
        }

        if (stored.publishTime != 0) {
            uint256 previous = _normalize(uint256(uint64(stored.price)), stored.expo);
            uint256 next = _normalize(uint256(uint64(p.price)), p.expo);
            uint256 deviation = next > previous ? next - previous : previous - next;
            if (deviation * BPS_DENOMINATOR > previous * MAX_DEVIATION_BPS) {
                revert DeviationTooLarge(next, previous);
            }
        }

        stored.price = p.price;
        stored.conf = p.conf;
        stored.expo = p.expo;
        stored.publishTime = p.publishTime;
        emit PriceUpdated(p.id, p.price, p.conf, p.expo, p.publishTime);
    }

    function _recover(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }

    /// @dev Same normalization the treasurer applies, so the deviation guard is
    ///      exponent-agnostic (a source switch from expo -5 to -8 must not trip it).
    function _normalize(uint256 price, int32 expo) internal pure returns (uint256) {
        if (expo == TARGET_EXPO) return price;
        if (expo > TARGET_EXPO) return price * (10 ** uint32(int32(expo - TARGET_EXPO)));
        return price / (10 ** uint32(int32(TARGET_EXPO - expo)));
    }
}
