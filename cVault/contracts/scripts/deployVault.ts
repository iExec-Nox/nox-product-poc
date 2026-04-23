/**
 * Deploys a {ConfidentialERC7540} vault by calling `createVault` on an existing factory.
 *
 * Required env (loaded by dotenv-cli from .env):
 *   - VAULT_OWNER_PRIVATE_KEY: deployer key (used by the hardhat network config).
 *   - VAULT_OWNER_ADDRESS:     `initialOwner` of the new vault.
 *   - FACTORY_ADDRESS:         `ConfidentialERC7540Factory` address.
 *   - CUSDC_ADDRESS:           underlying asset (cUSDC).
 */

import { network } from "hardhat";
import { getAddress } from "viem";
import { generatePrivateKey } from "viem/accounts";

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
};

const FACTORY = getAddress(requireEnv("FACTORY_ADDRESS"));
const ASSET = getAddress(requireEnv("CUSDC_ADDRESS"));
const INITIAL_OWNER = getAddress(requireEnv("VAULT_OWNER_ADDRESS"));
const NAME = "Confidential Vault cUSDC";
const SYMBOL = "cvUSDC";
const URI = "";
// Random 32-byte salt → fresh CREATE2 address each run. `generatePrivateKey()` returns
// 32 random bytes hex-encoded, which is exactly the bytes32 shape we need.
const salt = generatePrivateKey();

const { viem } = await network.create("arbitrumSepolia");
const publicClient = await viem.getPublicClient();
const factory = await viem.getContractAt("ConfidentialERC7540Factory", FACTORY);

console.log("Factory:       ", FACTORY);
console.log("Asset (cUSDC): ", ASSET);
console.log("Initial owner: ", INITIAL_OWNER);
console.log("Salt:          ", salt);

const txHash = await factory.write.createVault([
  ASSET,
  NAME,
  SYMBOL,
  URI,
  INITIAL_OWNER,
  salt,
]);
console.log("\ncreateVault tx:", txHash);

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
const createdLog = receipt.logs.find(
  (l) => l.address.toLowerCase() === FACTORY.toLowerCase(),
);
if (!createdLog) throw new Error("ConfidentialERC7540Created event not found");

const deployed = getAddress(`0x${createdLog.topics[1]!.slice(26)}`);
console.log(`\nVault deployed at: ${deployed}`);
console.log(`\nAdd to .env:\nVAULT_ADDRESS=${deployed}`);
