import { cookieStorage, createStorage, http } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { sepolia } from "@reown/appkit/networks";
import { RPC_URL, CONFIG } from "@/lib/config";

export const projectId = CONFIG.walletConnect.projectId;

export const networks = [sepolia];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
  transports: {
    [sepolia.id]: http(RPC_URL),
  },
});
