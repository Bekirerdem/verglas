import { describe, expect, it } from "vitest";
import { getAddress, isAddress, isHex } from "viem";
import {
  BLOCKCHAIN_IDS,
  dispatch,
  echo,
  FUJI_DEPLOYMENT,
  fujiC,
  IDENTITY_REGISTRY_ADDRESS,
  NETWORKS,
  TELEPORTER_ADDRESS,
  TREASURER_DEPLOYMENT,
} from "../src/chains.js";
import { VerglasClient } from "../src/client.js";

describe("chain constants", () => {
  it("blockchain IDs are 32-byte hex", () => {
    for (const id of Object.values(BLOCKCHAIN_IDS)) {
      expect(isHex(id)).toBe(true);
      expect(id.length).toBe(66);
    }
    expect(new Set(Object.values(BLOCKCHAIN_IDS)).size).toBe(Object.keys(BLOCKCHAIN_IDS).length);
  });

  it("chain ids match the networks", () => {
    expect(fujiC.id).toBe(43113);
    expect(dispatch.id).toBe(779672);
    expect(echo.id).toBe(173750);
  });

  it("deployment addresses are checksummed and unique", () => {
    const addresses: string[] = [
      FUJI_DEPLOYMENT.hub,
      FUJI_DEPLOYMENT.validationRegistry,
      FUJI_DEPLOYMENT.verifier,
      FUJI_DEPLOYMENT.account,
      FUJI_DEPLOYMENT.usdc,
      TREASURER_DEPLOYMENT.treasurer,
      TREASURER_DEPLOYMENT.account,
      TREASURER_DEPLOYMENT.pyth,
      IDENTITY_REGISTRY_ADDRESS,
      TELEPORTER_ADDRESS,
    ];
    const gate = NETWORKS.fuji.deployment?.gate;
    if (gate) addresses.push(gate.address);
    for (const a of addresses) {
      expect(isAddress(a, { strict: true }), `${a} must be checksummed`).toBe(true);
      expect(getAddress(a)).toBe(a);
    }
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it("agent ids are distinct canonical registrations", () => {
    expect(FUJI_DEPLOYMENT.agentId).not.toBe(TREASURER_DEPLOYMENT.agentId);
    expect(isHex(TREASURER_DEPLOYMENT.usdTryPriceId)).toBe(true);
    expect(TREASURER_DEPLOYMENT.usdTryPriceId.length).toBe(66);
  });
});

describe("VerglasClient.fuji", () => {
  it("wires the live deployment as defaults", () => {
    const client = VerglasClient.fuji();
    expect(client.addresses.hub).toBe(FUJI_DEPLOYMENT.hub);
    // The gate wiring mirrors the registry: both present or both absent.
    const gate = NETWORKS.fuji.deployment?.gate;
    expect(client.addresses.gate).toBe(gate?.address);
    expect(client.gateChain !== undefined).toBe(gate !== undefined);
  });

  it("refuses writes without a wallet", async () => {
    const client = VerglasClient.fuji();
    await expect(
      client.carryAttestation(FUJI_DEPLOYMENT.agentId, BLOCKCHAIN_IDS.echo, TELEPORTER_ADDRESS),
    ).rejects.toThrow(/walletClient/);
  });
});
