/**
 * Phase 3 of the async vault lifecycle — claims the shares for `controller`, converting the
 * previously-approved assets into shares at the live NAV and minting them to `receiver`.
 *
 *   claimable → claimed (shares minted to receiver)
 *
 * Anyone can run this to claim their own pending request. The claimer is the EOA derived from
 * `VAULT_OWNER_PRIVATE_KEY` (the signer); they must be the same `controller` that submitted
 * the `requestDeposit` (or an operator of that controller on the vault).
 *
 * Assumes the vault's Ownable `owner()` has already called `approveDeposit` — otherwise the
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
// Claimer = signer. Both `receiver` and `controller` are the signer itself.
const OWNER = getAddress(wallet.account.address);
console.log("Claimer:", OWNER);

const vault = await viem.getContractAt("ConfidentialERC7540", VAULT);

// Disambiguated 2-arg async-claim overload (vs the 3-arg sync `deposit` that reverts).
const vaultDepositClaimAbi = [
  {
    type: "function",
    name: "deposit",
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
const claimableBefore = await vault.read.claimableDepositRequest([OWNER]);
log("claimableDepositRequest:", claimableBefore);

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
if (claimableBefore === ZERO_HANDLE) {
  console.log(
    "\nℹ️  No claimable deposit request for this controller — the vault owner has not called" +
      " `approveDeposit` yet. Run that first, then re-run this script.",
  );
  process.exit(0);
}

// ─── 2. Claim — converts claimable assets to shares at live NAV, mints to receiver ──
console.log("\nClaim deposit (status: claimed)");
const claimTx = await wallet.writeContract({
  address: VAULT,
  abi: vaultDepositClaimAbi,
  functionName: "deposit",
  args: [OWNER, OWNER],
});
await publicClient.waitForTransactionReceipt({ hash: claimTx });
log("deposit (claim) tx:", claimTx);

// ─── 3. Post-claim state ────────────────────────────────────────────────────────
console.log("\nFinal state:");
log("user shares handle:", await vault.read.confidentialBalanceOf([OWNER]));
log("totalSupply handle:", await vault.read.confidentialTotalSupply());
log("totalAssets handle:", await vault.read.confidentialTotalAssets());

console.log("\n✅ Claim complete.");
