export {
  fujiC,
  avalancheC,
  dispatch,
  BLOCKCHAIN_IDS,
  TELEPORTER_ADDRESS,
  IDENTITY_REGISTRY_ADDRESS,
  IDENTITY_REGISTRY_MAINNET,
  REPUTATION_REGISTRY_MAINNET,
  USDC_MAINNET,
  FUJI_DEPLOYMENT,
  TREASURER_DEPLOYMENT,
  NETWORKS,
  DEFAULT_NETWORK,
  networkOf,
  type VerglasNetwork,
  type VerglasDeployment,
} from "./chains.js";
export {
  verglasFactoryAbi,
  verglasDispenserAbi,
  identityRegistryAbi,
  verglasAccountAbi,
  verglasHubAbi,
  validationRegistryAbi,
  verglasGateAbi,
  verglasTreasurerAbi,
  pythAbi,
} from "./abi.js";
export {
  VerglasClient,
  type VerglasAddresses,
  type AccountState,
  type Attestation,
  type Groth16Calldata,
} from "./client.js";
// Proving is Node-only (snarkjs + local artifacts) and deliberately not
// re-exported here so browser bundles stay clean: import "@verglas/sdk/prove".
