export const CONFIG = {
  urls: {
    app: "https://cdefi.iex.ec",
    etherscan: "https://sepolia.etherscan.io",
    docs: "https://docs.iex.ec",
    github: "https://github.com/iExec-Nox/demo-ctoken",
    contact: "https://airtable.com/applLw3eU2LlWXv76/pagDYHSWf5kUuJGv1/form",
    coingeckoApi: "https://api.coingecko.com/api/v3/simple/price",
    faucets: {
      eth: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
      rlc: "https://explorer.iex.ec/ethereum-sepolia-testnet/account?accountTab=Faucet",
      usdc: "https://faucet.circle.com/",
    },
  },
  rpc: {
    ethereumSepolia:
      process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC ??
      "https://ethereum-sepolia-rpc.publicnode.com",
  },
  // Nox subgraph (Ethereum Sepolia) — must match the SDK's NETWORK_CONFIGS
  // entry for chain 11155111. Powers the Delegated View and Activity Explorer
  // (the public RPC cannot serve historical eth_getLogs over the full range).
  subgraph: {
    ethereumSepolia:
      process.env.NEXT_PUBLIC_NOX_SUBGRAPH_URL ??
      "https://thegraph.ethereum-sepolia-testnet.noxprotocol.io/api/subgraphs/id/9CsccKwvgYFo72zZeU4k4wj2NEBLdWhVE3EUandgmzgo",
  },
  timing: {
    teeCooldownMs: 2_000,
    priceRefreshMs: 60_000,
    activityPollMs: 30_000,
  },
  storage: {
    devModeKey: "nox-dev-mode",
  },
  walletConnect: {
    projectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo",
  },
  gtm: {
    id: "GTM-P7KSD4T",
  },
} as const;

if (CONFIG.walletConnect.projectId === "demo") {
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set — WalletConnect will not work. " +
    "Get a project ID at https://cloud.reown.com"
  );
}

// Convenience aliases
export const APP_URL = CONFIG.urls.app;
export const EXPLORER_BASE_URL = CONFIG.urls.etherscan;
export const RPC_URL = CONFIG.rpc.ethereumSepolia;
export const SUBGRAPH_URL = CONFIG.subgraph.ethereumSepolia;
export const TEE_COOLDOWN_MS = CONFIG.timing.teeCooldownMs;
