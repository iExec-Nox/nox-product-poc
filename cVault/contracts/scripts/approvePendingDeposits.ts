/**
 * Admin tool: scans `DepositRequest` events on the vault, reads each unique controller's
 * current `pendingDepositRequest` handle, and calls `approveDeposit(handle, controller)` for
 * every non-zero bucket. The vault's `approveDeposit` internally uses `Nox.safeSub` so passing
 * the full current pending handle "settles everything pending" atomically.
 *
 * Signer must be the vault's Ownable `owner()` — otherwise `approveDeposit` reverts with
 * `OwnableUnauthorizedAccount`.
 *
 *   Env (loaded by dotenv-cli from .env):
 *     - VAULT_OWNER_PRIVATE_KEY  signer = vault owner
 *     - VAULT_ADDRESS            deployed ConfidentialERC7540
 *
 *   Run:
 *     npm run vault:approveAll:arbitrumSepolia
 */

import { network } from "hardhat";
import { getAbiItem, getAddress, parseAbi, type AbiEvent, type Address, type Hex } from "viem";

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
};

const VAULT = getAddress(requireEnv("VAULT_ADDRESS"));
const ZERO_HANDLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

const { viem } = await network.create("arbitrumSepolia");
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const SIGNER = getAddress(wallet.account.address);

const vault = await viem.getContractAt("ConfidentialERC7540", VAULT);

// Sanity-check: the signer is the vault owner, otherwise approveDeposit reverts with
// OwnableUnauthorizedAccount.
const vaultOwner = (await vault.read.owner()) as Address;
if (vaultOwner.toLowerCase() !== SIGNER.toLowerCase()) {
  throw new Error(
    `Signer ${SIGNER} is not the vault owner (${vaultOwner}). approveDeposit will revert.`,
  );
}

const log = (k: string, v: unknown) => console.log(`${k.padEnd(28)} ${v}`);
console.log("Vault:       ", VAULT);
console.log("Signer/owner:", SIGNER);

// ─── 1. Collect unique controllers from DepositRequest events ─────────────────────
// The event is declared in IConfidentialERC7540 as
//   DepositRequest(address indexed controller, address indexed owner, uint256 indexed requestId,
//                  address sender, euint256 assets)
// We reuse the full vault ABI so we can pull the event definition by name, which viem's `getLogs`
// accepts directly as the `event` parameter.
const depositRequestEvent = getAbiItem({
  abi: vault.abi,
  name: "DepositRequest",
}) as AbiEvent;

const logs = await publicClient.getLogs({
  address: VAULT,
  event: depositRequestEvent,
  fromBlock: 0n,
  toBlock: "latest",
});
log("DepositRequest logs:", logs.length);

const controllers = Array.from(
  new Set(
    logs
      .map((l) => (l.args as { controller?: Address }).controller)
      .filter((c): c is Address => !!c)
      .map((c) => getAddress(c)),
  ),
);
log("Unique controllers:", controllers.length);

// ─── 2. For each controller, read pending + approve if non-zero ───────────────────
const approveAbi = parseAbi([
  "function approveDeposit(bytes32 assets, address owner) external",
]);

// Arbitrum Sepolia baseFee spikes during bursts; 3× + 0.1 gwei tip absorbs it.
async function computeFees() {
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const base = block.baseFeePerGas ?? 0n;
  const priority = 100_000_000n;
  return { maxFeePerGas: base * 3n + priority, maxPriorityFeePerGas: priority };
}

let approvedCount = 0;
let skippedZero = 0;

for (const controller of controllers) {
  const pendingHandle = (await vault.read.pendingDepositRequest([controller])) as Hex;
  if (pendingHandle === ZERO_HANDLE) {
    skippedZero += 1;
    continue;
  }
  console.log(`\n→ approveDeposit(${controller})`);
  log("  pending handle:", pendingHandle);

  const fees = await computeFees();
  const tx = await wallet.writeContract({
    address: VAULT,
    abi: approveAbi,
    functionName: "approveDeposit",
    args: [pendingHandle, controller],
    ...fees,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  log("  tx:", tx);
  log("  status:", receipt.status);
  approvedCount += 1;
}

console.log(
  `\n✅ Done. Approved ${approvedCount}/${controllers.length} controller(s). ${skippedZero} had zero-handle pending (nothing to settle).`,
);
