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
  "function freeze()",
  "function unfreeze()",
  "function withdraw(address to, uint256 amount)",
  "event Spend(address indexed to, uint256 amount, uint256 indexed txIndex, uint256 newCommitment)",
  "event Frozen()",
  "event Unfrozen()",
]);

export const verglasFactoryAbi = parseAbi([
  "function createVault(address agent, address token, uint256 perTxLimit, uint256 totalBudget, address[] whitelist) returns (address account)",
  "function vaultsOf(address owner) view returns (address[] vaults)",
  "event VaultCreated(address indexed owner, address indexed account, address agent, address token)",
]);

export const verglasDispenserAbi = parseAbi([
  "function claim()",
  "function amountPerClaim() view returns (uint256)",
  "function nextClaimAt(address who) view returns (uint256)",
]);

export const verglasHubAbi = parseAbi([
  "function submitProof(uint256 agentId, bytes32 requestHash, uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[12] publicSignals, string responseURI, bytes32 responseHash)",
  "function carryAttestation(uint256 agentId, bytes32 destinationBlockchainID, address gate) returns (bytes32)",
  "function bindAccount(uint256 agentId, address account)",
  "function accountOf(uint256 agentId) view returns (address)",
  "function latestAttestation(uint256 agentId) view returns (bytes32 requestHash, uint256 finalCommitment, uint256 txCount, uint8 score, uint64 issuedAt)",
  "function checkpoints(address account) view returns (uint256 commitment, uint256 txCount)",
  "event AccountBound(uint256 indexed agentId, address indexed account)",
  "event AttestationIssued(uint256 indexed agentId, bytes32 indexed requestHash, uint256 finalCommitment, uint256 txCount)",
  "event AttestationCarried(uint256 indexed agentId, bytes32 indexed destinationBlockchainID, address gate, bytes32 messageID)",
]);

/** Canonical ERC-8004 Identity Registry surface the console needs: minting
    a fresh agentId (a real ERC-721) and reading ownership. */
export const identityRegistryAbi = parseAbi([
  "function register() returns (uint256 agentId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

export const validationRegistryAbi = parseAbi([
  "function validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash)",
  "function getValidationStatus(bytes32 requestHash) view returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 responseHash, string tag, uint256 lastUpdate)",
  "function getAgentValidations(uint256 agentId) view returns (bytes32[] requestHashes)",
]);

export const verglasTreasurerAbi = parseAbi([
  "function owner() view returns (address)",
  "function operator() view returns (address)",
  "function paused() view returns (bool)",
  "function account() view returns (address)",
  "function policy() view returns (uint256 dailyLimit, uint32 maxSlippageBps, uint256 referenceRateUsdTry)",
  "function spentToday() view returns (uint256)",
  "function payFX(address supplier, uint256 amountUsdc, bytes[] priceUpdate) payable",
  "function setPolicy((uint256 dailyLimit, uint32 maxSlippageBps, uint256 referenceRateUsdTry) policy)",
  "function setOperator(address operator)",
  "function pause()",
  "function unpause()",
  "event FxPayment(address indexed supplier, uint256 amount, uint256 rateUsdTry, uint256 indexed day)",
  "event PolicySet(uint256 dailyLimit, uint32 maxSlippageBps, uint256 referenceRateUsdTry)",
]);

/** Read-only Pyth surface for dashboards (display, not the enforced path). */
export const pythAbi = parseAbi([
  "function getPriceUnsafe(bytes32 id) view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
  "function getUpdateFee(bytes[] updateData) view returns (uint256)",
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
