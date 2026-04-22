import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys the {ConfidentialERC7540Factory}. Vault instances are created afterwards by calling
 * `factory.createVault(asset, name, symbol, contractURI, initialOwner)` from a script.
 *
 * NOTE: the contracts rely on a deployed NoxCompute contract for all encrypted ops. On
 * Arbitrum Sepolia (chainId 421614) the library auto-resolves the live address.
 */
export default buildModule("ConfidentialVaultFactory", (m) => {
  const factory = m.contract("ConfidentialERC7540Factory");
  return { factory };
});
