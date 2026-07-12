import { describe, expect, it } from "vitest";
import { getAddress, isAddress, isHex } from "viem";
import { BLOCKCHAIN_IDS, dispatch, FUJI_DEPLOYMENT, fujiC, TELEPORTER_ADDRESS } from "../src/chains.js";
import { VerglasClient } from "../src/client.js";

describe("chain constants", () => {
  it("blockchain IDs are 32-byte hex", () => {
    for (const id of Object.values(BLOCKCHAIN_IDS)) {
      expect(isHex(id)).toBe(true);
      expect(id.length).toBe(66);
    }
    expect(BLOCKCHAIN_IDS.fujiC).not.toBe(BLOCKCHAIN_IDS.dispatch);
  });

  it("chain ids match the networks", () => {
    expect(fujiC.id).toBe(43113);
    expect(dispatch.id).toBe(779672);
  });

  it("deployment addresses are checksummed and unique", () => {
    const addresses = [
      FUJI_DEPLOYMENT.hub,
      FUJI_DEPLOYMENT.validationRegistry,
      FUJI_DEPLOYMENT.verifier,
      FUJI_DEPLOYMENT.account,
      FUJI_DEPLOYMENT.testUsd,
      FUJI_DEPLOYMENT.devIdentity,
      FUJI_DEPLOYMENT.gateOnDispatch,
      TELEPORTER_ADDRESS,
    ];
    for (const a of addresses) {
      expect(isAddress(a, { strict: true }), `${a} must be checksummed`).toBe(true);
      expect(getAddress(a)).toBe(a);
    }
    expect(new Set(addresses).size).toBe(addresses.length);
  });
});

describe("VerglasClient.fuji", () => {
  it("wires the live deployment as defaults", () => {
    const client = VerglasClient.fuji();
    expect(client.addresses.hub).toBe(FUJI_DEPLOYMENT.hub);
    expect(client.addresses.gate).toBe(FUJI_DEPLOYMENT.gateOnDispatch);
    expect(client.gateChain).toBeDefined();
  });

  it("refuses writes without a wallet", async () => {
    const client = VerglasClient.fuji();
    await expect(client.carryToDispatch(FUJI_DEPLOYMENT.agentId)).rejects.toThrow(/walletClient/);
  });
});
