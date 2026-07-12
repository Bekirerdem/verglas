// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

interface IIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @title ValidationRegistry — ERC-8004 Validation Registry (Verglas deployment)
/// @notice Avalanche has canonical ERC-8004 Identity and Reputation registries
///         (0x8004A…, 0x8004B…) but no canonical Validation Registry. Verglas
///         deploys this one, event-compatible with the reference implementation
///         so ERC-8004 explorers can index it as-is.
/// @dev Spec flow: the agent's owner requests validation from a chosen validator;
///      only that validator can respond; responses may be updated over time.
contract ValidationRegistry {
    struct Request {
        address validatorAddress;
        uint256 agentId;
        string requestURI;
        uint256 timestamp;
    }

    struct Response {
        uint8 response;
        string responseURI;
        bytes32 responseHash;
        string tag;
        uint256 lastUpdate;
        bool exists;
    }

    IIdentityRegistry public immutable identityRegistry;

    mapping(bytes32 => Request) internal _requests;
    mapping(bytes32 => bool) internal _requestExists;
    mapping(bytes32 => Response) internal _responses;
    mapping(uint256 => bytes32[]) internal _agentValidations;
    mapping(address => bytes32[]) internal _validatorRequests;

    event ValidationRequest(
        address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash
    );
    event ValidationResponse(
        address indexed validatorAddress,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint8 response,
        string responseURI,
        bytes32 responseHash,
        string tag
    );

    error ZeroValidator();
    error NotAgentOwner();
    error SelfValidation();
    error RequestAlreadyExists();
    error UnknownRequest();
    error NotRequestedValidator();
    error ScoreAbove100();

    constructor(IIdentityRegistry identityRegistry_) {
        identityRegistry = identityRegistry_;
    }

    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external {
        if (validatorAddress == address(0)) revert ZeroValidator();
        address agentOwner = identityRegistry.ownerOf(agentId);
        if (msg.sender != agentOwner) revert NotAgentOwner();
        if (validatorAddress == agentOwner) revert SelfValidation();
        if (_requestExists[requestHash]) revert RequestAlreadyExists();

        _requestExists[requestHash] = true;
        _requests[requestHash] = Request({
            validatorAddress: validatorAddress, agentId: agentId, requestURI: requestURI, timestamp: block.timestamp
        });
        _agentValidations[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequest(validatorAddress, agentId, requestURI, requestHash);
    }

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        if (!_requestExists[requestHash]) revert UnknownRequest();
        Request storage req = _requests[requestHash];
        if (msg.sender != req.validatorAddress) revert NotRequestedValidator();
        if (response > 100) revert ScoreAbove100();

        _responses[requestHash] = Response({
            response: response,
            responseURI: responseURI,
            responseHash: responseHash,
            tag: tag,
            lastUpdate: block.timestamp,
            exists: true
        });

        emit ValidationResponse(
            req.validatorAddress, req.agentId, requestHash, response, responseURI, responseHash, tag
        );
    }

    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            string memory tag,
            uint256 lastUpdate
        )
    {
        if (!_requestExists[requestHash]) revert UnknownRequest();
        Request storage req = _requests[requestHash];
        Response storage res = _responses[requestHash];
        return (req.validatorAddress, req.agentId, res.response, res.responseHash, res.tag, res.lastUpdate);
    }

    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentValidations[agentId];
    }

    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory) {
        return _validatorRequests[validatorAddress];
    }
}
