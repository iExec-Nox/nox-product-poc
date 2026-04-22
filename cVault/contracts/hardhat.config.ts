import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    // EDR-simulated fork of Arbitrum Sepolia. chainId is preserved (421614),
    // so `Nox.noxComputeContract()` resolves to the live NoxCompute deployment.
    // Defaults to the public Arbitrum Sepolia RPC; override via `ARBITRUM_SEPOLIA_RPC_URL`
    // for higher rate limits.
    arbitrumSepoliaFork: {
      type: "edr-simulated",
      chainType: "generic",
      chainId: 421614,
      forking: {
        url:
          process.env.ARBITRUM_SEPOLIA_RPC_URL ??
          "https://sepolia-rollup.arbitrum.io/rpc",
      },
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});
