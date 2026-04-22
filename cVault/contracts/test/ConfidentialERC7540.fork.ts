/**
 * Integration tests on a fork of Arbitrum Sepolia (chainId 421614), where the live NoxCompute
 * contract is deployed at `0xd464B198f06756a1d00be223634b85E0a731c229`.
 *
 * Scope:
 *   - Deployment on the fork with the live NoxCompute reachable.
 *   - Factory CREATE2 + ownership wiring on the vault.
 *   - Real Nox primitive exercised via `TestERC7984.mintPublic` (calls `Nox.toEuint256` under
 *     the hood, which invokes `NoxCompute.wrapAsPublicHandle`).
 *   - `approveDeposit` (external-input overload) rejects non-owner callers.
 *
 * Out of scope:
 *   The full request → approve → claim lifecycle requires gateway-signed `externalEuint256`
 *   inputs that can only be produced by the Nox handle SDK against a live gateway. Running
 *   that from a hardhat test is a separate follow-up.
 *
 * Running:
 *   export ARBITRUM_SEPOLIA_RPC_URL="https://..."
 *   npx hardhat test nodejs --network arbitrumSepoliaFork
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { encodeFunctionData, getAddress } from "viem";

describe("ConfidentialERC7540 — fork Arbitrum Sepolia", async () => {
  // Uses the default public Arbitrum Sepolia RPC (or ARBITRUM_SEPOLIA_RPC_URL if set).
  const { viem } = await network.create("arbitrumSepoliaFork");

  const deployFixture = async () => {
    const [admin, alice] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const asset = await viem.deployContract("cUSDC");

    const factory = await viem.deployContract("ConfidentialERC7540Factory");
    const salt =
      "0x0000000000000000000000000000000000000000000000000000000000000001" as const;
    const createTx = await factory.write.createVault([
      asset.address,
      "Confidential Vault cUSDC",
      "cvUSDC",
      "",
      admin.account.address,
      salt,
    ]);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: createTx,
    });
    const createdLog = receipt.logs.find(
      (l) => l.address.toLowerCase() === factory.address.toLowerCase(),
    );
    const vaultAddress = getAddress(
      `0x${createdLog!.topics[1]!.slice(26)}`,
    );
    const vault = await viem.getContractAt(
      "ConfidentialERC7540",
      vaultAddress,
    );

    return { admin, alice, publicClient, asset, factory, vault };
  };

  it("runs on the Arbitrum Sepolia fork (chainId 421614)", async () => {
    const { publicClient } = await deployFixture();
    assert.equal(await publicClient.getChainId(), 421614);
  });

  it("factory wires ownership correctly", async () => {
    const { admin, vault } = await deployFixture();
    assert.equal(
      await vault.read.owner(),
      getAddress(admin.account.address),
    );
  });

  it("vault exposes the asset address", async () => {
    const { asset, vault } = await deployFixture();
    assert.equal(await vault.read.asset(), getAddress(asset.address));
  });

  it("mintPublic on cUSDC calls real NoxCompute.wrapAsPublicHandle", async () => {
    // Proves the live NoxCompute contract is reachable from the fork; if chainId or the
    // hardcoded Nox address were wrong, `Nox.toEuint256` would revert.
    const { alice, asset, publicClient } = await deployFixture();
    const tx = await asset.write.mintPublic([alice.account.address, 1000n]);
    const r = await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(r.status, "success");
  });

  it("predictVaultAddress matches the deployed CREATE2 address", async () => {
    const { admin, asset, factory, publicClient } = await deployFixture();
    const salt =
      "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;
    const predicted = await factory.read.predictVaultAddress([
      asset.address,
      "Predicted",
      "PRD",
      "",
      admin.account.address,
      salt,
    ]);
    const tx = await factory.write.createVault([
      asset.address,
      "Predicted",
      "PRD",
      "",
      admin.account.address,
      salt,
    ]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    const createdLog = receipt.logs.find(
      (l) => l.address.toLowerCase() === factory.address.toLowerCase(),
    );
    const deployed = getAddress(`0x${createdLog!.topics[1]!.slice(26)}`);
    assert.equal(deployed, predicted);
  });

  it("approveDeposit (external-input overload) reverts when caller is not the owner", async () => {
    // Use encodeFunctionData on a narrowed 3-arg ABI fragment to disambiguate from the
    // handle-only overload, then send a raw call as `alice` and expect OwnableUnauthorized.
    const { alice, vault, publicClient } = await deployFixture();
    const approveDepositExternalAbi = [
      {
        type: "function",
        name: "approveDeposit",
        stateMutability: "nonpayable",
        inputs: [
          { name: "encryptedAssets", type: "bytes32" },
          { name: "inputProof", type: "bytes" },
          { name: "owner", type: "address" },
        ],
        outputs: [],
      },
    ] as const;

    const data = encodeFunctionData({
      abi: approveDepositExternalAbi,
      functionName: "approveDeposit",
      args: [
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x",
        alice.account.address,
      ],
    });

    await assert.rejects(
      publicClient.call({
        to: vault.address,
        data,
        account: alice.account.address,
      }),
      /OwnableUnauthorizedAccount/,
    );
  });
});
