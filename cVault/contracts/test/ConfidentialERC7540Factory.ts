import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * Smoke test for the factory: deploys a {cUSDC} asset + the factory, pre-computes a vault
 * address via CREATE2, then creates it and checks the emitted address matches.
 *
 * We do NOT exercise any confidential flow here — that would require a deployed NoxCompute.
 * Both the {cUSDC} and {ConfidentialERC7540} constructors only set strings / Ownable state
 * (no Nox calls), so this runs on a bare hardhat network.
 */
describe("ConfidentialERC7540Factory", async () => {
  const { viem } = await network.create();

  it("deploys and creates a vault at the predicted CREATE2 address", async () => {
    const asset = await viem.deployContract("cUSDC");
    const factory = await viem.deployContract("ConfidentialERC7540Factory");

    const [owner] = await viem.getWalletClients();
    const salt =
      "0x0000000000000000000000000000000000000000000000000000000000000001" as const;

    const predicted = await factory.read.predictVaultAddress([
      asset.address,
      "Confidential Vault cUSDC",
      "cvUSDC",
      "",
      owner.account.address,
      salt,
    ]);

    const hash = await factory.write.createVault([
      asset.address,
      "Confidential Vault cUSDC",
      "cvUSDC",
      "",
      owner.account.address,
      salt,
    ]);

    const publicClient = await viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const createdLog = receipt.logs.find(
      (l) => l.address.toLowerCase() === factory.address.toLowerCase(),
    );
    assert.ok(createdLog, "expected a Created event from the factory");

    // Topic 1 = indexed vault address.
    const deployedTopic = createdLog!.topics[1]!;
    const deployed = ("0x" + deployedTopic.slice(26)) as `0x${string}`;
    assert.equal(deployed.toLowerCase(), predicted.toLowerCase());
  });
});
