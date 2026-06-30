/**
 * Contract addresses — Ethereum Sepolia (chainId: 11155111)
 *
 * Single source of truth for all deployed contract addresses.
 * Update this file when contracts are redeployed.
 *
 * Verified on-chain: each cToken's underlying() points to its public ERC-20.
 */

export const CONTRACTS = {
  /** Testnet USDC (ERC-20, decimals: 6) — underlying of cUSDC */
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  /** Confidential USDC (ERC-7984, decimals: 6) */
  cUSDC: "0x6d339DC7291DDBFD76d12E8b85f2dc8C32007c2C",
  /** iExec RLC (ERC-20, decimals: 9) — underlying of cRLC */
  RLC: "0x26A738b6D33EF4D94FF084D3552961b8f00639Cd",
  /** Confidential RLC (ERC-7984, decimals: 9) */
  cRLC: "0xf961385B39EB765872CF9939dd39702527C8d768",
  /** NoxCompute proxy — addViewer / isViewer */
  NOX_COMPUTE: "0x24ef36ec5b626d7dcd09a98f3083c2758f0f77bf",
} as const;

/** Null address — used to filter native tokens (ETH) in contract calls */
export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

/** Null handle (bytes32) — indicates an uninitialized confidential balance */
export const ZERO_HANDLE = ("0x" + "0".repeat(64)) as `0x${string}`;
