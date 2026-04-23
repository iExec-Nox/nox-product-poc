/**
 * Phase 1 of the async vault lifecycle — wraps USDC into cUSDC and submits a `requestDeposit`
 * to the vault. After this script runs the deposit sits in the `pending` bucket and is waiting
 * for the vault Ownable owner to call `approveDeposit`.
 *
 *   USDC → wrap into cUSDC → requestDeposit (pending)
 *
 * Anyone can run this as a depositor. The depositor is the EOA derived from
 * `VAULT_OWNER_PRIVATE_KEY` (the signer). It is used as both `owner_` and `controller` in the
 * request; it does NOT need to be the vault's Ownable `owner()` (that role only matters for
 * `approveDeposit`).
 *
 * Env (loaded by dotenv-cli from .env):
 *   - VAULT_OWNER_PRIVATE_KEY   (signer = depositor)
 *   - CUSDC_ADDRESS             (deployed `ERC20ToERC7984Wrapper` cUSDC)
 *   - VAULT_ADDRESS             (deployed ConfidentialERC7540)
 *
 * Prerequisites: the signer must hold at least `DEPOSIT_AMOUNT` of the underlying USDC.
 */

import { network } from "hardhat";
import { getAddress, parseAbi, type Address } from "viem";

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
};

const CUSDC = getAddress(requireEnv("CUSDC_ADDRESS"));
const VAULT = getAddress(requireEnv("VAULT_ADDRESS"));
// Live NoxCompute on Arbitrum Sepolia (matches `Nox.noxComputeContract()` for chainId 421614).
const NOX_COMPUTE: Address = "0xd464B198f06756a1d00be223634b85E0a731c229";

// USDC has 6 decimals.
const DEPOSIT_AMOUNT = 100_000n; // 0.1 USDC

const { viem } = await network.create("arbitrumSepolia");
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
// Depositor = signer. `controller` and `owner_` in the request are both the signer itself.
const OWNER = getAddress(wallet.account.address);
console.log("Depositor:", OWNER);

const wrapperAbi = parseAbi([
  "function underlying() external view returns (address)",
  "function wrap(address to, uint256 amount) external returns (bytes32)",
  "function setOperator(address operator, uint48 until) external",
  "function confidentialBalanceOf(address account) external view returns (bytes32)",
]);
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
]);
const noxAbi = parseAbi([
  "function allow(bytes32 handle, address account) external",
]);
const vaultRequestDepositAbi = [
  {
    type: "function",
    name: "requestDeposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "bytes32" },
      { name: "controller", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const vault = await viem.getContractAt("ConfidentialERC7540", VAULT);

const log = (label: string, value: unknown) =>
  console.log(`${label.padEnd(28)} ${value}`);

// ─── 0. Resolve underlying USDC + balance check ─────────────────────────────────
const USDC = (await publicClient.readContract({
  address: CUSDC,
  abi: wrapperAbi,
  functionName: "underlying",
})) as Address;
const usdcBal = (await publicClient.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [OWNER],
})) as bigint;
log("Underlying USDC:", USDC);
log("USDC balance:", `${usdcBal} (raw, 6 dec)`);
if (usdcBal < DEPOSIT_AMOUNT) {
  throw new Error(
    `Insufficient USDC: have ${usdcBal}, need ${DEPOSIT_AMOUNT}. Top up via faucet.`,
  );
}

// ─── 1. Approve cUSDC to spend USDC ─────────────────────────────────────────────
console.log("\n[1/6] Approve USDC for cUSDC wrapper");
const approveUsdcTx = await wallet.writeContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "approve",
  args: [CUSDC, DEPOSIT_AMOUNT],
});
await publicClient.waitForTransactionReceipt({ hash: approveUsdcTx });
log("approve tx:", approveUsdcTx);

// ─── 2. Wrap USDC → cUSDC ────────────────────────────────────────────────────────
console.log("\n[2/6] cUSDC.wrap(OWNER, amount)");
const wrapTx = await wallet.writeContract({
  address: CUSDC,
  abi: wrapperAbi,
  functionName: "wrap",
  args: [OWNER, DEPOSIT_AMOUNT],
});
await publicClient.waitForTransactionReceipt({ hash: wrapTx });
log("wrap tx:", wrapTx);

// ─── 3. Read the freshly-minted encrypted balance handle ────────────────────────
console.log("\n[3/6] Read encrypted cUSDC balance handle");
const balanceHandle = (await publicClient.readContract({
  address: CUSDC,
  abi: wrapperAbi,
  functionName: "confidentialBalanceOf",
  args: [OWNER],
})) as `0x${string}`;
log("balance handle:", balanceHandle);

// ─── 4. Set vault as operator on cUSDC ──────────────────────────────────────────
console.log("\n[4/6] cUSDC.setOperator(vault)");
const until = Math.floor(Date.now() / 1000) + 24 * 3600;
const setOpTx = await wallet.writeContract({
  address: CUSDC,
  abi: wrapperAbi,
  functionName: "setOperator",
  args: [VAULT, until],
});
await publicClient.waitForTransactionReceipt({ hash: setOpTx });
log("setOperator tx:", setOpTx);

// ─── 5. Grant persistent Nox ACL on balance handle to vault ─────────────────────
console.log("\n[5/6] NoxCompute.allow(balanceHandle, vault)");
const allowTx = await wallet.writeContract({
  address: NOX_COMPUTE,
  abi: noxAbi,
  functionName: "allow",
  args: [balanceHandle, VAULT],
});
await publicClient.waitForTransactionReceipt({ hash: allowTx });
log("allow tx:", allowTx);

// ─── 6. requestDeposit → status: pending ────────────────────────────────────────
console.log("\n[6/6] requestDeposit (status: pending)");
const reqDepositTx = await wallet.writeContract({
  address: VAULT,
  abi: vaultRequestDepositAbi,
  functionName: "requestDeposit",
  args: [balanceHandle, OWNER, OWNER],
});
await publicClient.waitForTransactionReceipt({ hash: reqDepositTx });
log("requestDeposit tx:", reqDepositTx);

const pendingHandle = await vault.read.pendingDepositRequest([OWNER]);
log("pendingDepositRequest:", pendingHandle);

console.log(
  "\n✅ Request submitted. Next step: the vault Ownable owner must call" +
    " `approveDeposit` with the pending handle above, then run `claimDeposit.ts`.",
);
