export { fujiC, dispatch, BLOCKCHAIN_IDS, TELEPORTER_ADDRESS, FUJI_DEPLOYMENT } from "./chains.js";
export { verglasAccountAbi, verglasHubAbi, validationRegistryAbi, verglasGateAbi } from "./abi.js";
export {
  VerglasClient,
  type VerglasAddresses,
  type AccountState,
  type Attestation,
  type Groth16Calldata,
} from "./client.js";
// Proving is Node-only (snarkjs + local artifacts) and deliberately not
// re-exported here so browser bundles stay clean: import "@verglas/sdk/prove".
