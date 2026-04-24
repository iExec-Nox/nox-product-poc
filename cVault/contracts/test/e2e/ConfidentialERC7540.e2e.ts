/**
 * End-to-end lifecycle test against LIVE Arbitrum Sepolia (chainId 421614).
 *
 * Exercises the full async vault flow (deposit + redeem) through the confidential stack,
 * using the `@iexec-nox/handle` SDK to decrypt handles and assert invariants after each
 * phase.
 *
 * Scope:
 *  - Fresh vault deployment via the factory (one per run, uses a random salt).
 *  - USDC → cUSDC wrap.
 *  - requestDeposit → approveDeposit → deposit(receiver, controller) claim.
 *  - requestRedeem → approveRedeem → redeem(receiver, controller) claim.
 *  - Invariant checks at every step: totalSupply, totalAssets, pending/claimable
 *    buckets, totalPendingDepositAssets, user balance.
 *  - First-deposit ratio is asserted to be 1:1 (seed mint) — this is what the OZ-style
 *    approve-time NAV refactor is designed to guarantee.
 *
 * Running:
 *   # required env (in .env):
 *   #   VAULT_OWNER_PRIVATE_KEY   signer playing all roles
 *   #   CUSDC_ADDRESS             deployed cUSDC wrapper
 *   #   FACTORY_ADDRESS           deployed ConfidentialERC7540Factory
 *   #   ARBITRUM_SEPOLIA_RPC_URL  RPC (also exposed as Hardhat keystore var)
 *
 *   npm run test:e2e:arbitrumSepolia
 *
 * NOTE: These tests use real gas. Keep `DEPOSIT_AMOUNT_USDC` small. One full lifecycle
 * run is ~8 txs.
 */

import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import { formatUnits, getAddress, parseAbi, type Address, type PublicClient } from "viem";
import { createViemHandleClient, type HandleClient } from "@iexec-nox/handle";

// ─────────────── Env ───────────────
const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
};
const CUSDC = getAddress(requireEnv("CUSDC_ADDRESS"));
const FACTORY = getAddress(requireEnv("FACTORY_ADDRESS"));
const NOX_COMPUTE: Address = "0xd464B198f06756a1d00be223634b85E0a731c229";
const USDC_DECIMALS = 6;
// Small amount — each lifecycle run consumes real gas + real USDC.
const DEPOSIT_AMOUNT_USDC = 10_000n; // 0.01 USDC

// Mirror the vault's `_decimalsOffset()` override (see ConfidentialERC7540.sol). The first
// deposit mints `assets * 10^offset` shares, so vault shares have `assetDecimals + offset`
// decimals. Keep this in sync with the contract.
const DECIMALS_OFFSET = 6n;
const SEED_SHARE_MULTIPLIER = 10n ** DECIMALS_OFFSET; // 10^6
const EXPECTED_SHARES_FIRST_DEPOSIT = DEPOSIT_AMOUNT_USDC * SEED_SHARE_MULTIPLIER;

// ─────────────── ABIs ───────────────
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
]);
const wrapperAbi = parseAbi([
  "function underlying() external view returns (address)",
  "function wrap(address to, uint256 amount) external returns (bytes32)",
  "function setOperator(address operator, uint48 until) external",
  "function confidentialBalanceOf(address account) external view returns (bytes32)",
]);
const noxAbi = parseAbi([
  "function allow(bytes32 handle, address account) external",
]);
const factoryAbi = parseAbi([
  "function createVault(address asset, string name, string symbol, string contractURI, address initialOwner, bytes32 salt) external returns (address)",
  "event ConfidentialERC7540Created(address indexed vault, address indexed asset, address indexed initialOwner, string name, string symbol, bytes32 salt)",
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
const vaultApproveRedeemAbi = [
  {
    type: "function",
    name: "approveRedeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "bytes32" },
      { name: "owner", type: "address" },
    ],
    outputs: [],
  },
] as const;
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

// ─────────────── Helpers ───────────────

/** EIP-1559 fee bump — Arbitrum Sepolia baseFee spikes during bursts, 3× + 0.1 gwei tip. */
async function bumpFees(publicClient: PublicClient) {
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const base = block.baseFeePerGas ?? 0n;
  const priority = 100_000_000n; // 0.1 gwei
  return { maxFeePerGas: base * 3n + priority, maxPriorityFeePerGas: priority };
}

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

async function decryptBigInt(handleClient: HandleClient, handle: `0x${string}`, label: string): Promise<bigint> {
  // An uninitialized euint256 storage slot (no Nox.toEuint256 ever written into it) reads as
  // bytes32(0). The SDK rejects that with "Handle chainId (0) does not match". Treat it as the
  // plaintext 0: nothing was ever written, so the counter is genuinely 0.
  if (handle === ZERO_HANDLE) {
    console.log(`    (zero-handle)  ${label.padEnd(32)} = 0`);
    return 0n;
  }
  const result = await handleClient.decrypt(handle);
  const raw = (result as { value?: unknown }).value ?? result;
  const v = typeof raw === "bigint" ? raw : BigInt(String(raw));
  console.log(`    decrypted ${label.padEnd(32)} = ${v}`);
  return v;
}

// ─────────────── Suite ───────────────

describe("ConfidentialERC7540 e2e — Arbitrum Sepolia (live)", async () => {
  const { viem } = await network.create("arbitrumSepolia");
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();
  const SIGNER = getAddress(wallet.account.address);
  console.log(`\nSigner (all roles): ${SIGNER}`);

  const handleClient = await createViemHandleClient(wallet);

  // Resolve underlying USDC from the cUSDC wrapper, verify signer has enough balance.
  const USDC = (await publicClient.readContract({
    address: CUSDC,
    abi: wrapperAbi,
    functionName: "underlying",
  })) as Address;
  const usdcBal = (await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [SIGNER],
  })) as bigint;
  console.log(`USDC: ${USDC} · signer bal = ${formatUnits(usdcBal, USDC_DECIMALS)} USDC`);
  assert(
    usdcBal >= DEPOSIT_AMOUNT_USDC,
    `Signer needs at least ${DEPOSIT_AMOUNT_USDC} atomic USDC to run the e2e; found ${usdcBal}.`,
  );

  let vaultAddress: Address;
  let vault: Awaited<ReturnType<typeof viem.getContractAt<"ConfidentialERC7540">>>;

  before(async () => {
    // ─── Deploy fresh vault via factory (random salt → fresh CREATE2 address each run) ───
    const salt = (`0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join("")}`) as `0x${string}`;
    const fees = await bumpFees(publicClient);
    const txHash = await wallet.writeContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "createVault",
      args: [CUSDC, "E2E Test Vault", "e2eV", "", SIGNER, salt],
      ...fees,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const createdLog = receipt.logs.find(
      (l) => l.address.toLowerCase() === FACTORY.toLowerCase(),
    );
    assert.ok(createdLog, "ConfidentialERC7540Created event not emitted");
    vaultAddress = getAddress(`0x${createdLog!.topics[1]!.slice(26)}`);
    vault = await viem.getContractAt("ConfidentialERC7540", vaultAddress);
    console.log(`\nFresh vault deployed at ${vaultAddress}`);
    console.log(`owner = ${await vault.read.owner()}`);
    assert.equal(await vault.read.owner(), SIGNER, "signer must be vault owner");
  });

  it("full deposit lifecycle: request → approve → claim, first deposit mints 1:1 shares", async () => {
    // ─── Wrap USDC → cUSDC ───
    console.log("\n[wrap] Approve USDC then wrap");
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [CUSDC, DEPOSIT_AMOUNT_USDC],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: CUSDC,
        abi: wrapperAbi,
        functionName: "wrap",
        args: [SIGNER, DEPOSIT_AMOUNT_USDC],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
    const cusdcHandle = (await publicClient.readContract({
      address: CUSDC,
      abi: wrapperAbi,
      functionName: "confidentialBalanceOf",
      args: [SIGNER],
    })) as `0x${string}`;
    const cusdcBal = await decryptBigInt(handleClient, cusdcHandle, "cUSDC balance");
    assert.equal(cusdcBal, DEPOSIT_AMOUNT_USDC, "cUSDC balance after wrap must equal deposit amount");

    // ─── Grant vault operator + Nox ACL on the balance handle ───
    console.log("\n[prep] setOperator + Nox.allow on balance handle");
    {
      const until = Math.floor(Date.now() / 1000) + 24 * 3600;
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: CUSDC,
        abi: wrapperAbi,
        functionName: "setOperator",
        args: [vaultAddress, until],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: NOX_COMPUTE,
        abi: noxAbi,
        functionName: "allow",
        args: [cusdcHandle, vaultAddress],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }

    // ─── requestDeposit ───
    console.log("\n[request] requestDeposit");
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: vaultAddress,
        abi: vaultRequestDepositAbi,
        functionName: "requestDeposit",
        args: [cusdcHandle, SIGNER, SIGNER],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }

    // Invariants after request:
    //   pending[signer]              = DEPOSIT_AMOUNT
    //   totalPendingDepositAssets    = DEPOSIT_AMOUNT
    //   totalSupply                  = 0
    //   user shares balance          = 0
    const pendingAssets = await decryptBigInt(
      handleClient,
      (await vault.read.pendingDepositRequest([SIGNER])) as `0x${string}`,
      "pendingDepositRequest[signer]",
    );
    assert.equal(pendingAssets, DEPOSIT_AMOUNT_USDC, "pending should equal the deposited amount");
    const totalPending = await decryptBigInt(
      handleClient,
      (await vault.read.totalPendingDepositAssets()) as `0x${string}`,
      "totalPendingDepositAssets",
    );
    assert.equal(totalPending, DEPOSIT_AMOUNT_USDC, "global pending counter should equal the deposited amount");
    const supplyBefore = await decryptBigInt(
      handleClient,
      (await vault.read.confidentialTotalSupply()) as `0x${string}`,
      "totalSupply (pre-approve)",
    );
    assert.equal(supplyBefore, 0n, "totalSupply must be 0 before any shares are minted");

    // ─── approveDeposit (this now mints shares + locks NAV) ───
    console.log("\n[approve] approveDeposit (OZ-style: convert + mint at fulfillment)");
    const pendingHandle = (await vault.read.pendingDepositRequest([SIGNER])) as `0x${string}`;
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: vaultAddress,
        abi: vaultApproveDepositAbi,
        functionName: "approveDeposit",
        args: [pendingHandle, SIGNER],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }

    // Invariants after approve:
    //   pending[signer]              = 0
    //   totalPendingDepositAssets    = 0
    //   claimable_assets[signer]     = DEPOSIT_AMOUNT
    //   claimable_shares[signer]     = DEPOSIT_AMOUNT (1:1 first deposit)
    //   totalSupply                  = DEPOSIT_AMOUNT (shares minted to vault)
    //   user shares balance          = 0 (still in escrow at vault)
    const pendingPost = await decryptBigInt(
      handleClient,
      (await vault.read.pendingDepositRequest([SIGNER])) as `0x${string}`,
      "pendingDepositRequest[signer]",
    );
    assert.equal(pendingPost, 0n, "pending must be drained after approve");
    const totalPendingPost = await decryptBigInt(
      handleClient,
      (await vault.read.totalPendingDepositAssets()) as `0x${string}`,
      "totalPendingDepositAssets",
    );
    assert.equal(totalPendingPost, 0n, "global pending counter must be 0 after approve");
    const claimableAssets = await decryptBigInt(
      handleClient,
      (await vault.read.claimableDepositRequest([SIGNER])) as `0x${string}`,
      "claimableDepositRequest[signer]",
    );
    assert.equal(claimableAssets, DEPOSIT_AMOUNT_USDC, "claimable assets must equal the approved amount");
    const supplyPost = await decryptBigInt(
      handleClient,
      (await vault.read.confidentialTotalSupply()) as `0x${string}`,
      "totalSupply (post-approve)",
    );
    assert.equal(
      supplyPost,
      EXPECTED_SHARES_FIRST_DEPOSIT,
      `first deposit mints assets × 10^${DECIMALS_OFFSET} shares (virtual-share inflation defense)`,
    );
    const userSharesPre = await decryptBigInt(
      handleClient,
      (await vault.read.confidentialBalanceOf([SIGNER])) as `0x${string}`,
      "user shares balance (pre-claim)",
    );
    assert.equal(userSharesPre, 0n, "shares are escrowed at the vault until the user claims");

    // ─── deposit claim (pure transfer) ───
    console.log("\n[claim] deposit(receiver, controller)");
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: vaultAddress,
        abi: vaultDepositClaimAbi,
        functionName: "deposit",
        args: [SIGNER, SIGNER],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }

    // Invariants after claim:
    //   claimable_assets[signer] = 0
    //   claimable_shares[signer] = 0
    //   user shares balance = DEPOSIT_AMOUNT
    //   totalSupply = DEPOSIT_AMOUNT (unchanged — just moved out of escrow)
    const claimablePost = await decryptBigInt(
      handleClient,
      (await vault.read.claimableDepositRequest([SIGNER])) as `0x${string}`,
      "claimableDepositRequest[signer]",
    );
    assert.equal(claimablePost, 0n, "claimable bucket must be empty after claim");
    const userShares = await decryptBigInt(
      handleClient,
      (await vault.read.confidentialBalanceOf([SIGNER])) as `0x${string}`,
      "user shares balance (post-claim)",
    );
    assert.equal(userShares, EXPECTED_SHARES_FIRST_DEPOSIT, "user must receive the escrowed shares in full");
    const supplyAfterClaim = await decryptBigInt(
      handleClient,
      (await vault.read.confidentialTotalSupply()) as `0x${string}`,
      "totalSupply (post-claim)",
    );
    assert.equal(supplyAfterClaim, EXPECTED_SHARES_FIRST_DEPOSIT, "totalSupply is unchanged on claim (transfer, not mint)");

    console.log("\n✅ Deposit lifecycle invariants verified.");
  });

  it("full redeem lifecycle: request → approve → claim, assets returned 1:1", async () => {
    // Prereq: the deposit lifecycle test above must run first (same describe block,
    // fresh vault, shares live on signer's confidentialBalanceOf). We redeem all of them.
    const shares = await decryptBigInt(
      handleClient,
      (await vault.read.confidentialBalanceOf([SIGNER])) as `0x${string}`,
      "shares to redeem",
    );
    assert(shares > 0n, "deposit lifecycle must have left shares on the signer");

    // Grant vault Nox ACL on the shares handle before requestRedeem.
    const sharesHandle = (await vault.read.confidentialBalanceOf([SIGNER])) as `0x${string}`;
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: NOX_COMPUTE,
        abi: noxAbi,
        functionName: "allow",
        args: [sharesHandle, vaultAddress],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }

    // ─── requestRedeem ───
    console.log("\n[request] requestRedeem");
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: vaultAddress,
        abi: vaultRequestRedeemAbi,
        functionName: "requestRedeem",
        args: [sharesHandle, SIGNER, SIGNER],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
    const pendingRedeem = await decryptBigInt(
      handleClient,
      (await vault.read.pendingRedeemRequest([SIGNER])) as `0x${string}`,
      "pendingRedeemRequest[signer]",
    );
    assert.equal(pendingRedeem, shares, "pending redeem must equal escrowed shares");
    const userSharesAfterRequest = await decryptBigInt(
      handleClient,
      (await vault.read.confidentialBalanceOf([SIGNER])) as `0x${string}`,
      "user shares balance (post-request)",
    );
    assert.equal(userSharesAfterRequest, 0n, "shares are escrowed on the vault at request time");

    // ─── approveRedeem (convert + burn) ───
    console.log("\n[approve] approveRedeem (OZ-style: convert + burn at fulfillment)");
    const supplyBeforeApprove = await decryptBigInt(
      handleClient,
      (await vault.read.confidentialTotalSupply()) as `0x${string}`,
      "totalSupply (pre-approveRedeem)",
    );
    const pendingRedeemHandle = (await vault.read.pendingRedeemRequest([SIGNER])) as `0x${string}`;
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: vaultAddress,
        abi: vaultApproveRedeemAbi,
        functionName: "approveRedeem",
        args: [pendingRedeemHandle, SIGNER],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }

    // Invariants after approveRedeem:
    //   pending_redeem[signer] = 0
    //   claimable_redeem_shares[signer] = shares
    //   totalSupply decreased by `shares` (burned at fulfillment)
    const pendingRedeemPost = await decryptBigInt(
      handleClient,
      (await vault.read.pendingRedeemRequest([SIGNER])) as `0x${string}`,
      "pendingRedeemRequest[signer]",
    );
    assert.equal(pendingRedeemPost, 0n, "pending redeem must be drained after approve");
    const claimableRedeemShares = await decryptBigInt(
      handleClient,
      (await vault.read.claimableRedeemRequest([SIGNER])) as `0x${string}`,
      "claimableRedeemRequest[signer]",
    );
    assert.equal(claimableRedeemShares, shares, "claimable redeem shares must equal what was pending");
    const supplyAfterApprove = await decryptBigInt(
      handleClient,
      (await vault.read.confidentialTotalSupply()) as `0x${string}`,
      "totalSupply (post-approveRedeem)",
    );
    assert.equal(
      supplyBeforeApprove - supplyAfterApprove,
      shares,
      "totalSupply must decrease by the burned escrowed shares on approve",
    );

    // ─── redeem claim (pure transferOut) ───
    console.log("\n[claim] redeem(receiver, controller)");
    {
      const fees = await bumpFees(publicClient);
      const tx = await wallet.writeContract({
        address: vaultAddress,
        abi: vaultRedeemClaimAbi,
        functionName: "redeem",
        args: [SIGNER, SIGNER],
        ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
    const claimableRedeemPost = await decryptBigInt(
      handleClient,
      (await vault.read.claimableRedeemRequest([SIGNER])) as `0x${string}`,
      "claimableRedeemRequest[signer]",
    );
    assert.equal(claimableRedeemPost, 0n, "claimable redeem bucket must be empty after claim");
    // cUSDC balance of signer must have increased by exactly `shares` (1:1 NAV).
    const cusdcPost = await decryptBigInt(
      handleClient,
      (await publicClient.readContract({
        address: CUSDC,
        abi: wrapperAbi,
        functionName: "confidentialBalanceOf",
        args: [SIGNER],
      })) as `0x${string}`,
      "signer cUSDC balance (post-redeem claim)",
    );
    // Symmetric to the first deposit: redeeming the full share balance recovers exactly the
    // original underlying amount because `shares = assets × (supply + 10^offset) / (assets_pre + 1)`
    // followed by `assets_out = shares × (assets + 1) / (supply + 10^offset)` cancels algebraically.
    assert.equal(
      cusdcPost,
      DEPOSIT_AMOUNT_USDC,
      "redeeming all shares must return the originally-deposited underlying amount",
    );

    console.log("\n✅ Redeem lifecycle invariants verified.");
  });
});
