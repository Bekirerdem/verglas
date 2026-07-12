import { parseAbi } from "viem";

export const verglasAccountAbi = parseAbi([
  "function owner() view returns (address)",
  "function agent() view returns (address)",
  "function token() view returns (address)",
  "function perTxLimit() view returns (uint256)",
  "function totalBudget() view returns (uint256)",
  "function commitment() view returns (uint256)",
  "function txCount() view returns (uint256)",
  "function totalSpent() view returns (uint256)",
  "function frozen() view returns (bool)",
  "function whitelistLength() view returns (uint256)",
  "function whitelist(uint256 index) view returns (address)",
  "function spend(address to, uint256 amount)",
  "event Spend(address indexed to, uint256 amount, uint256 indexed txIndex, uint256 newCommitment)",
]);

export const verglasHubAbi = parseAbi([
  "function submitProof(uint256 agentId, bytes32 requestHash, uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[12] publicSignals, string responseURI, bytes32 responseHash)",
  "function carryAttestation(uint256 agentId, bytes32 destinationBlockchainID, address gate) returns (bytes32)",
  "function bindAccount(uint256 agentId, address account)",
  "function accountOf(uint256 agentId) view returns (address)",
  "function latestAttestation(uint256 agentId) view returns (bytes32 requestHash, uint256 finalCommitment, uint256 txCount, uint8 score, uint64 issuedAt)",
  "function checkpoints(address account) view returns (uint256 commitment, uint256 txCount)",
  "event AttestationIssued(uint256 indexed agentId, bytes32 indexed requestHash, uint256 finalCommitment, uint256 txCount)",
  "event AttestationCarried(uint256 indexed agentId, bytes32 indexed destinationBlockchainID, address gate, bytes32 messageID)",
]);

export const validationRegistryAbi = parseAbi([
  "function validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash)",
  "function getValidationStatus(bytes32 requestHash) view returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 responseHash, string tag, uint256 lastUpdate)",
  "function getAgentValidations(uint256 agentId) view returns (bytes32[] requestHashes)",
]);

export const verglasGateAbi = parseAbi([
  "function isCleared(uint256 agentId) view returns (bool)",
  "function attestationOf(uint256 agentId) view returns (bytes32 requestHash, uint256 finalCommitment, uint256 txCount, uint8 score, uint64 issuedAt)",
  "function minScore() view returns (uint8)",
  "function maxAge() view returns (uint64)",
  "function hub() view returns (address)",
  "function hubBlockchainID() view returns (bytes32)",
  "event AttestationReceived(uint256 indexed agentId, bytes32 indexed requestHash, uint8 score, uint64 issuedAt)",
]);
