/**
 * Phase 1 of the async redeem lifecycle — submits a `requestRedeem` to the vault. After this
 * script runs the redeem sits in the `pending` bucket and is waiting for the vault Ownable
 * owner to call `approveRedeem`.
 *
 *   vault shares (held by user) → requestRedeem (shares escrowed into the vault, pending)
 *
 * Anyone holding shares can run this as a redeemer. The redeemer is the EOA derived from
 * `VAULT_OWNER_PRIVATE_KEY` (the signer); it's used as both `owner_` and `controller` — it
 * does NOT need to be the vault's Ownable `owner()` (that role only matters for
 * `approveRedeem`).
 *
 * Env (loaded by dotenv-cli from .env):
 *   - VAULT_OWNER_PRIVATE_KEY   (signer = redeemer)
 *   - VAULT_ADDRESS             (deployed ConfidentialERC7540)
 *
 * Prerequisites: the signer must already hold vault shares (i.e. have completed a prior
 * deposit + approve + claim cycle).
 */

import { network } from "hardhat";
import { getAddress, parseAbi, type Address } from "viem";

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
};

const VAULT = getAddress(requireEnv("VAULT_ADDRESS"));
// Live NoxCompute on Arbitrum Sepolia (matches `Nox.noxComputeContract()` for chainId 421614).
const NOX_COMPUTE: Address = "0xd464B198f06756a1d00be223634b85E0a731c229";

const { viem } = await network.create("arbitrumSepolia");
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const OWNER = getAddress(wallet.account.address);
console.log("Redeemer:", OWNER);

const vault = await viem.getContractAt("ConfidentialERC7540", VAULT);

const noxAbi = parseAbi([
  "function allow(bytes32 handle, address account) external",
]);
const vaultRequestRedeemAbi = [
  {
    type: "function",
    name: "requestRedeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "bytes32" },
      { name: "controller", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const log = (label: string, value: unknown) =>
  console.log(`${label.padEnd(28)} ${value}`);

// ─── 1. Read the user's current shares balance handle on the vault ──────────────
console.log("\n[1/3] Read encrypted shares balance handle on the vault");
const sharesHandle = (await vault.read.confidentialBalanceOf([OWNER])) as `0x${string}`;
log("shares handle:", sharesHandle);

if (sharesHandle === "0x0000000000000000000000000000000000000000000000000000000000000000") {
  throw new Error(
    "No vault shares balance for this signer — run the deposit flow first " +
      "(request → approve → claim).",
  );
}

// ─── 2. Grant persistent Nox ACL on the shares handle to the vault ──────────────
// Needed so the vault can do its internal `_transfer(owner_, vault, shares)` (which uses
// `Nox.safeSub` on the NoxCompute side → caller=vault must be allowed on the handle).
console.log("\n[2/3] NoxCompute.allow(sharesHandle, vault)");
const allowTx = await wallet.writeContract({
  address: NOX_COMPUTE,
  abi: noxAbi,
  functionName: "allow",
  args: [sharesHandle, VAULT],
});
await publicClient.waitForTransactionReceipt({ hash: allowTx });
log("allow tx:", allowTx);

// ─── 3. requestRedeem → status: pending ─────────────────────────────────────────
console.log("\n[3/3] requestRedeem (status: pending)");
const reqRedeemTx = await wallet.writeContract({
  address: VAULT,
  abi: vaultRequestRedeemAbi,
  functionName: "requestRedeem",
  args: [sharesHandle, OWNER, OWNER],
});
await publicClient.waitForTransactionReceipt({ hash: reqRedeemTx });
log("requestRedeem tx:", reqRedeemTx);

const pendingHandle = await vault.read.pendingRedeemRequest([OWNER]);
log("pendingRedeemRequest:", pendingHandle);

console.log(
  "\n✅ Request submitted. Next step: the vault Ownable owner must call `approveRedeem`" +
    " with the pending handle above, then run `claimRedeem.ts`.",
);
