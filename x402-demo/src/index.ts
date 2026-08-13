// verglas x402 demo — the smallest possible paid API, so the pay_x402 tool has
// a real seller to talk to. The buyer side is standard x402 (exact scheme,
// EIP-3009). The seller side is self-facilitated: signatures are verified
// through the community Ultravioleta facilitator, but settlement is submitted
// by this worker itself with pinned gas — Fuji's fee estimation is flaky and
// the facilitator's settle endpoint currently 400s on it (contract_call_failed,
// reproduced 2026-08-13; swap back to facilitator settle when it heals).
import { Hono } from "hono";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

const MERCHANT = "0x26e5BFd903C065D3BF2ACa299E87535A12d7709B";
const USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";
const PRICE = 10000n; // 0.01 USDC
const NETWORK = "avalanche-fuji";
const FACILITATOR = "https://facilitator.ultravioletadao.xyz";

const USDC_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
]);

type Env = { X402_SETTLE_KEY: `0x${string}` };

const requirements = (resource: string) => ({
  scheme: "exact",
  network: NETWORK,
  maxAmountRequired: PRICE.toString(),
  resource,
  description: "Verglas demo: a tiny paid report for agent buyers",
  mimeType: "application/json",
  payTo: MERCHANT,
  maxTimeoutSeconds: 300,
  asset: USDC,
  extra: { name: "USD Coin", version: "2" },
});

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.json({
    service: "verglas x402 demo",
    paid: { "/frost-report": "0.01 USDC over x402, avalanche-fuji" },
    buyer_side: "https://verglas.xyz/docs",
  }),
);

app.get("/frost-report", async (c) => {
  const reqs = requirements(c.req.url);
  const deny = (error: string, status = 402) =>
    c.json({ error, accepts: [reqs], x402Version: 1 }, status as 402);

  const header = c.req.header("X-PAYMENT");
  if (!header) return deny("X-PAYMENT header is required");

  let payload: {
    network?: string;
    payload?: {
      signature?: `0x${string}`;
      authorization?: Record<"from" | "to" | "value" | "validAfter" | "validBefore" | "nonce", string>;
    };
  };
  try {
    payload = JSON.parse(atob(header));
  } catch {
    return deny("X-PAYMENT is not base64 JSON");
  }
  const auth = payload.payload?.authorization;
  const sig = payload.payload?.signature;
  if (!auth || !sig) return deny("payment payload is missing authorization or signature");
  if (payload.network !== NETWORK) return deny(`wrong network: ${payload.network}`);
  if (auth.to.toLowerCase() !== MERCHANT.toLowerCase()) return deny("authorization pays the wrong recipient");
  if (BigInt(auth.value) < PRICE) return deny(`authorized ${auth.value}, price is ${PRICE}`);
  if (BigInt(auth.validBefore) < BigInt(Math.floor(Date.now() / 1000) + 10))
    return deny("authorization expires too soon");

  // Signature + balance checks ride the community facilitator (this part works).
  const verify = await fetch(`${FACILITATOR}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x402Version: 1, paymentPayload: payload, paymentRequirements: reqs }),
  });
  const verdict = (await verify.json()) as { isValid?: boolean; invalidReason?: string };
  if (!verdict.isValid) return deny(`verification failed: ${verdict.invalidReason ?? verify.status}`);

  // Self-settle with pinned fees; the merchant key both submits and receives.
  const account = privateKeyToAccount(c.env.X402_SETTLE_KEY.trim() as `0x${string}`);
  const pub = createPublicClient({ chain: avalancheFuji, transport: http() });
  const wallet = createWalletClient({ chain: avalancheFuji, transport: http(), account });
  const r = `0x${sig.slice(2, 66)}` as `0x${string}`;
  const s = `0x${sig.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(sig.slice(130, 132), 16);
  let hash: `0x${string}`;
  try {
    hash = await wallet.writeContract({
      address: USDC,
      abi: USDC_ABI,
      functionName: "transferWithAuthorization",
      args: [
        auth.from as `0x${string}`,
        auth.to as `0x${string}`,
        BigInt(auth.value),
        BigInt(auth.validAfter),
        BigInt(auth.validBefore),
        auth.nonce as `0x${string}`,
        v,
        r,
        s,
      ],
      gas: 120_000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return deny(`settlement reverted: ${hash}`);
  } catch (e) {
    return deny(`settlement failed: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  }

  c.header(
    "X-PAYMENT-RESPONSE",
    btoa(JSON.stringify({ success: true, transaction: hash, network: NETWORK, payer: auth.from })),
  );
  return c.json({
    service: "verglas frost report",
    status: "frost holds",
    note: "this JSON was bought over x402 — the buyer's float is governed by a Verglas vault",
    network: NETWORK,
    issuedAt: new Date().toISOString(),
  });
});

export default app;
