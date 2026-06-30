import { CONTRACTS } from "./contracts";

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  isNative?: boolean;
  address?: string;
  icon: string;
  coingeckoId?: string;
  wrappable?: boolean;
  confidentialAddress?: string;
}

export const tokens: TokenConfig[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    isNative: true,
    icon: "/icon-eth.svg",
    coingeckoId: "ethereum",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: CONTRACTS.USDC,
    icon: "/icon-usdc.svg",
    coingeckoId: "usd-coin",
    wrappable: true,
    confidentialAddress: CONTRACTS.cUSDC,
  },
  {
    symbol: "RLC",
    name: "iExec RLC",
    decimals: 9,
    address: CONTRACTS.RLC,
    icon: "/icon-rlc.svg",
    coingeckoId: "iexec-rlc",
    wrappable: true,
    confidentialAddress: CONTRACTS.cRLC,
  },
];

export const erc20Tokens = tokens.filter(
  (t): t is TokenConfig & { address: string } => !t.isNative && !!t.address,
);

export const nativeToken = tokens.find(t => t.isNative);

export const wrappableTokens = erc20Tokens.filter(t => t.wrappable);

export const confidentialTokens = wrappableTokens.map(t => ({
  ...t,
  symbol: `c${t.symbol}`,
  name: `Confidential ${t.name}`,
  address: t.confidentialAddress,
}));

export const coingeckoIds = tokens
  .map(t => t.coingeckoId)
  .filter(Boolean)
  .join(",");
