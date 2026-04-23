/**
 * End-to-end interaction script against a deployed {ConfidentialERC7540} on Arbitrum Sepolia.
 *
 *   USDC  →  wrap into cUSDC  →  requestDeposit (pending)  →  approveDeposit (claimable)
 *         →  deposit (claimed, shares minted)
 *
 * Same key (`VAULT_OWNER_PRIVATE_KEY`) plays both roles for simplicity:
 *   - depositor: approves USDC, wraps, requests, claims
 *   - vault Ownable owner: approves the deposit
 *
 * Env (loaded by dotenv-cli from .env):
 *   - VAULT_OWNER_PRIVATE_KEY   (signer)
 *   - VAULT_OWNER_ADDRESS       (used as `owner_` / `controller`)
 *   - CUSDC_ADDRESS             (deployed `ERC20ToERC7984Wrapper` cUSDC)
 *   - VAULT_ADDRESS             (deployed ConfidentialERC7540)
 *
 * Prerequisites:
 *   The signer must hold at least `DEPOSIT_AMOUNT` of the underlying USDC (the ERC-20
 *   wrapped by cUSDC). Get it from an Arbitrum Sepolia faucet first.
 *
 * The script uses the *handle-only* overloads on the vault (`requestDeposit(euint256, …)` etc.)
 * to avoid needing a gateway-signed input proof: the encrypted balance handle minted by
 * `cUSDC.wrap` is reused directly, with a persistent Nox ACL grant to the vault.
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
const OWNER = getAddress(requireEnv("VAULT_OWNER_ADDRESS"));
// Live NoxCompute on Arbitrum Sepolia (matches `Nox.noxComputeContract()` for chainId 421614).
const NOX_COMPUTE: Address = "0xd464B198f06756a1d00be223634b85E0a731c229";

// USDC has 6 decimals.
const DEPOSIT_AMOUNT = 100_000n; // 0.1 USDC

const { viem } = await network.create("arbitrumSepolia");
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
console.log("Signer:", wallet.account.address);

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
  "function isAllowed(bytes32 handle, address account) view returns (bool)",
]);
// Disambiguated 3-arg / 2-arg overloads on the vault.
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
const vaultApproveDepositAbi = [
  {
    type: "function",
    name: "approveDeposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "bytes32" },
      { name: "owner", type: "address" },
    ],
    outputs: [],
  },
] as const;
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

// ─── 1. Approve cUSDC to spend our USDC ─────────────────────────────────────────────
console.log("\n[1/8] Approve USDC for cUSDC wrapper");
const approveUsdcTx = await wallet.writeContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "approve",
  args: [CUSDC, DEPOSIT_AMOUNT],
});
await publicClient.waitForTransactionReceipt({ hash: approveUsdcTx });
log("approve tx:", approveUsdcTx);

// ─── 2. Wrap USDC → cUSDC ────────────────────
console.log("\n[2/8] cUSDC.wrap(OWNER, amount)");
const wrapTx = await wallet.writeContract({
  address: CUSDC,
  abi: wrapperAbi,
  functionName: "wrap",
  args: [OWNER, DEPOSIT_AMOUNT],
});
await publicClient.waitForTransactionReceipt({ hash: wrapTx });
log("wrap tx:", wrapTx);

// ─── 3. Read the freshly-minted encrypted balance handle ────────────────────────
console.log("\n[3/8] Read encrypted cUSDC balance handle");
const balanceHandle = (await publicClient.readContract({
  address: CUSDC,
  abi: wrapperAbi,
  functionName: "confidentialBalanceOf",
  args: [OWNER],
})) as `0x${string}`;
log("balance handle:", balanceHandle);

// ─── 4. Set vault as operator on cUSDC (so vault can `confidentialTransferFrom`) ─
console.log("\n[4/8] cUSDC.setOperator(vault)");
const until = Math.floor(Date.now() / 1000) + 24 * 3600; // +1 day
const setOpTx = await wallet.writeContract({
  address: CUSDC,
  abi: wrapperAbi,
  functionName: "setOperator",
  args: [VAULT, until],
});
await publicClient.waitForTransactionReceipt({ hash: setOpTx });
log("setOperator tx:", setOpTx);

// ─── 5. Grant persistent Nox ACL on balance handle to vault ─────────────────────
// `allow` (not `allowTransient`) because the next call (`requestDeposit`) is in a separate tx
// and transient ACL doesn't survive across tx boundaries.
console.log("\n[5/8] NoxCompute.allow(balanceHandle, vault)");
const allowTx = await wallet.writeContract({
  address: NOX_COMPUTE,
  abi: noxAbi,
  functionName: "allow",
  args: [balanceHandle, VAULT],
});
await publicClient.waitForTransactionReceipt({ hash: allowTx });
log("allow tx:", allowTx);

// ─── 5b. ACL diagnostics — confirms `allow` actually took effect on-chain ───────
const ownerAllowed = (await publicClient.readContract({
  address: NOX_COMPUTE,
  abi: noxAbi,
  functionName: "isAllowed",
  args: [balanceHandle, OWNER],
})) as boolean;
const vaultAllowed = (await publicClient.readContract({
  address: NOX_COMPUTE,
  abi: noxAbi,
  functionName: "isAllowed",
  args: [balanceHandle, VAULT],
})) as boolean;
log("ACL: owner allowed:", ownerAllowed);
log("ACL: vault allowed:", vaultAllowed);
if (!vaultAllowed) {
  throw new Error("vault not allowed on balance handle — `allow` tx didn't take effect");
}

// Sanity: check the vault actually has the 3-arg requestDeposit overload by inspecting bytecode.
const vaultCode = await publicClient.getCode({ address: VAULT });
if (!vaultCode || vaultCode.length < 10) {
  throw new Error(`No bytecode at VAULT_ADDRESS=${VAULT}`);
}
// 0x93a04498 = selector of requestDeposit(bytes32,address,address)
if (!vaultCode.includes("93a04498")) {
  console.warn(
    "⚠️  Selector 0x93a04498 (handle-only requestDeposit) NOT found in vault bytecode. " +
      "The deployed vault was likely compiled without the 3-arg overload — redeploy.",
  );
}

// ─── 6. requestDeposit (handle-only overload) → state: pending ──────────────────
console.log("\n[6/8] requestDeposit (status: pending)");
// Simulate first so any contract-side revert returns a decoded reason instead of raw "0x".
await publicClient.simulateContract({
  account: wallet.account,
  address: VAULT,
  abi: vaultRequestDepositAbi,
  functionName: "requestDeposit",
  args: [balanceHandle, OWNER, OWNER],
});
const reqDepositTx = await wallet.writeContract({
  address: VAULT,
  abi: vaultRequestDepositAbi,
  functionName: "requestDeposit",
  args: [balanceHandle, OWNER, OWNER],
});
await publicClient.waitForTransactionReceipt({ hash: reqDepositTx });
log("requestDeposit tx:", reqDepositTx);

const pendingHandle = (await vault.read.pendingDepositRequest([OWNER])) as `0x${string}`;
log("pendingDepositRequest:", pendingHandle);

// ─── 7. approveDeposit (Ownable owner) → state: claimable ───────────────────────
console.log("\n[7/8] approveDeposit (status: claimable)");
const approveTx = await wallet.writeContract({
  address: VAULT,
  abi: vaultApproveDepositAbi,
  functionName: "approveDeposit",
  args: [pendingHandle, OWNER],
});
await publicClient.waitForTransactionReceipt({ hash: approveTx });
log("approveDeposit tx:", approveTx);

const claimableHandle = (await vault.read.claimableDepositRequest([OWNER])) as `0x${string}`;
log("claimableDepositRequest:", claimableHandle);

// ─── 8. deposit (claim) → state: claimed, shares minted to receiver ─────────────
console.log("\n[8/8] deposit(receiver, controller) (status: claimed)");
const claimTx = await wallet.writeContract({
  address: VAULT,
  abi: vaultDepositClaimAbi,
  functionName: "deposit",
  args: [OWNER, OWNER],
});
await publicClient.waitForTransactionReceipt({ hash: claimTx });
log("deposit (claim) tx:", claimTx);

// ─── Final state ────────────────────────────────────────────────────────────────
console.log("\nFinal state:");
log("user shares handle:", await vault.read.confidentialBalanceOf([OWNER]));
log("totalSupply handle:", await vault.read.confidentialTotalSupply());
log("totalAssets handle:", await vault.read.confidentialTotalAssets());

console.log("\n✅ Lifecycle complete: pending → claimable → claimed");
