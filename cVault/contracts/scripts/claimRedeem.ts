/**
 * Phase 3 of the async redeem lifecycle — claims the assets, burning the escrowed shares and
 * transferring the underlying cUSDC to `receiver`.
 *
 *   claimable → claimed (shares burned, cUSDC sent to receiver)
 *
 * Anyone can run this to claim their own pending request. The claimer is the EOA derived from
 * `VAULT_OWNER_PRIVATE_KEY` (the signer); they must be the same `controller` that submitted
 * the `requestRedeem` (or an operator of that controller on the vault).
 *
 * Assumes the vault's Ownable `owner()` has already called `approveRedeem` — otherwise the
 * claimable bucket is empty and the script bails early.
 *
 * Env (loaded by dotenv-cli from .env):
 *   - VAULT_OWNER_PRIVATE_KEY   (signer = claimer)
 *   - VAULT_ADDRESS             (deployed ConfidentialERC7540)
 */

import { network } from "hardhat";
import { getAddress } from "viem";

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
};

const VAULT = getAddress(requireEnv("VAULT_ADDRESS"));

const { viem } = await network.create("arbitrumSepolia");
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const OWNER = getAddress(wallet.account.address);
console.log("Claimer:", OWNER);

const vault = await viem.getContractAt("ConfidentialERC7540", VAULT);

// Disambiguated 2-arg async-claim overload (vs the 4-arg sync `redeem` that reverts).
const vaultRedeemClaimAbi = [
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "controller", type: "address" },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const;

const log = (label: string, value: unknown) =>
  console.log(`${label.padEnd(28)} ${value}`);

// ─── 1. Pre-flight state ────────────────────────────────────────────────────────
const claimableBefore = await vault.read.claimableRedeemRequest([OWNER]);
log("claimableRedeemRequest:", claimableBefore);

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
if (claimableBefore === ZERO_HANDLE) {
  console.log(
    "\nℹ️  No claimable redeem request for this controller — the vault owner has not called" +
      " `approveRedeem` yet. Run that first, then re-run this script.",
  );
  process.exit(0);
}

// ─── 2. Claim — burns escrowed shares, converts to assets at live NAV, transfers to receiver ──
console.log("\nClaim redeem (status: claimed)");
const claimTx = await wallet.writeContract({
  address: VAULT,
  abi: vaultRedeemClaimAbi,
  functionName: "redeem",
  args: [OWNER, OWNER],
});
await publicClient.waitForTransactionReceipt({ hash: claimTx });
log("redeem (claim) tx:", claimTx);

// ─── 3. Post-claim state ────────────────────────────────────────────────────────
console.log("\nFinal state:");
log("user shares handle:", await vault.read.confidentialBalanceOf([OWNER]));
log("totalSupply handle:", await vault.read.confidentialTotalSupply());
log("totalAssets handle:", await vault.read.confidentialTotalAssets());

console.log("\n✅ Claim complete — cUSDC sent to receiver.");
