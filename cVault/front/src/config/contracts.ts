import type { Address } from "viem";

/**
 * Contract addresses + chain params are hardcoded here — none of these are secret:
 *  - Addresses are deployed on-chain and publicly inspectable.
 *  - chainId is public protocol metadata.
 *  - A WalletConnect projectId gets embedded in the client bundle anyway.
 *
 * `NEXT_PUBLIC_*` overrides are still honoured when present, so you can point the same
 * front at a different deployment (local fork, staging, …) without a rebuild.
 */
function overrideOrDefault<T extends string>(envValue: string | undefined, fallback: T): T {
  return envValue && envValue.length > 0 ? (envValue as T) : fallback;
}

export const CHAIN_ID = Number(
  overrideOrDefault(process.env.NEXT_PUBLIC_CHAIN_ID, "421614"),
);

export const FACTORY_ADDRESS: Address = overrideOrDefault(
  process.env.NEXT_PUBLIC_FACTORY_ADDRESS,
  "0x17e44408A4C699E6d737C2C22cC012d3Bcd49dB2",
) as Address;

export const VAULT_ADDRESS: Address = overrideOrDefault(
  process.env.NEXT_PUBLIC_VAULT_ADDRESS,
  "0x5aed6A1be3C338Fc315b58Bc0948Ce41AcfE1B48",
) as Address;

export const CUSDC_ADDRESS: Address = overrideOrDefault(
  process.env.NEXT_PUBLIC_CUSDC_ADDRESS,
  "0x1ccec6bc60db15e4055d43dc2531bb7d4e5b808e",
) as Address;

export const RLC_ADDRESS: Address = overrideOrDefault(
  process.env.NEXT_PUBLIC_RLC_ADDRESS,
  "0x9923eD3cbd90CD78b910c475f9A731A6e0b8C963",
) as Address;

export const CRLC_ADDRESS: Address = overrideOrDefault(
  process.env.NEXT_PUBLIC_CRLC_ADDRESS,
  "0x92b23f4a59175415ced5cb37e64a1fc6a9d79af4",
) as Address;

/**
 * Registry of the confidential tokens this app knows how to wrap & deposit. Each entry ties the
 * ERC-20 underlying to its ERC-7984 wrapper (cToken) and carries UI metadata.
 */
export type SupportedToken = {
  id: "cUSDC" | "cRLC";
  underlyingSymbol: "USDC" | "RLC";
  confidentialSymbol: "cUSDC" | "cRLC";
  underlying: Address;
  confidential: Address;
  decimals: number;
  accent: string; // small color accent for the UI tile
};

export const SUPPORTED_TOKENS: readonly SupportedToken[] = [
  {
    id: "cUSDC",
    underlyingSymbol: "USDC",
    confidentialSymbol: "cUSDC",
    underlying: "0x0000000000000000000000000000000000000000" as Address, // resolved at runtime via cUSDC.underlying()
    confidential: CUSDC_ADDRESS,
    decimals: 6,
    accent: "#2775CA",
  },
  {
    id: "cRLC",
    underlyingSymbol: "RLC",
    confidentialSymbol: "cRLC",
    underlying: RLC_ADDRESS,
    confidential: CRLC_ADDRESS,
    decimals: 9,
    accent: "#FFD21F",
  },
] as const;

export function getTokenByConfidential(addr: Address | undefined): SupportedToken | undefined {
  if (!addr) return undefined;
  const lc = addr.toLowerCase();
  return SUPPORTED_TOKENS.find((t) => t.confidential.toLowerCase() === lc);
}

export const NOX_COMPUTE_ADDRESS: Address = overrideOrDefault(
  process.env.NEXT_PUBLIC_NOX_COMPUTE_ADDRESS,
  "0xd464B198f06756a1d00be223634b85E0a731c229",
) as Address;

export const WALLETCONNECT_PROJECT_ID = overrideOrDefault(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  "422765df2218d8e578aea5d08470c777",
);

export const ZERO_HANDLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
