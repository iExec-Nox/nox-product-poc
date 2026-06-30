# Nox Confidential Token Demo

A web3 frontend demo showcasing the **Nox confidential computing protocol** on Ethereum Sepolia. Users can wrap, transfer, and audit private tokens (cTokens) using the ERC-7984 standard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS v4 + shadcn/ui (New York) |
| Web3 | wagmi v2 + viem + Reown AppKit |
| Confidential | Nox SDK (`@iexec-nox/handle`) |
| Chain | Ethereum Sepolia (11155111) |
| Prices | CoinGecko API (via Next.js API route) |

---

## Features

- **Wallet connection** — MetaMask, Rabby, Coinbase Wallet, WalletConnect
- **Dashboard** — Portfolio overview with public & confidential balances
- **Faucet** — Quick access to testnet token faucets
- **Wrap / Unwrap** — Convert public tokens (USDC, RLC) into confidential tokens (cUSDC, cRLC) at 1:1 ratio
- **Confidential Transfer** — Send cTokens with encrypted amounts
- **Selective Disclosure** — Grant auditors read access to your confidential balance
- **Delegated View** — View balances shared with you by other users
- **Activity Explorer** — Transaction history with filtering
- **Developer Mode** — Inspect smart contract calls and Nox SDK methods
- **Light / Dark theme** — Full theme support

---

## Deployed Contracts (Ethereum Sepolia)

> Addresses below are placeholders pending redeployment on Ethereum Sepolia. Update `lib/contracts.ts` once the contracts are live.

| Contract | Address |
|----------|---------|
| USDC (ERC-20) | _TBD_ |
| cUSDC (ERC-7984) | _TBD_ |
| RLC (ERC-20) | _TBD_ |
| cRLC (ERC-7984) | _TBD_ |
| NoxCompute | _TBD_ |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A WalletConnect project ID ([cloud.reown.com](https://cloud.reown.com))

### Setup

```bash
git clone https://github.com/iExec-Nox/demo-ctoken.git
cd demo-ctoken
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_project_id>
NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC=<your_rpc_url>   # optional — avoids public RPC rate-limiting
```

### Run

```bash
npm run dev       # http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint
```

---

## Project Structure

```
app/
  (landing)/            # Landing page + Terms (Header + Footer layout)
  (app)/                # Dashboard, Activity, Delegated View (Topbar + DashboardHeader layout)
  api/prices/           # CoinGecko proxy
components/
  layout/               # Topbar, Header, Footer, DashboardHeader, MobileMenu
  landing/              # HeroSection, FeatureCard, FeaturesSection
  dashboard/            # DashboardContent, Assets, ActionCenter, TokenRow
  modals/               # Faucet, Wrap, Transfer, SelectiveDisclosure
  shared/               # Logo, CodeSection, InfoCard, ErrorMessage, TxStatus…
  explorer/             # ExplorerContent, ActivityTable
  delegated-view/       # DelegatedViewContent, DelegatedViewTable
  ui/                   # shadcn primitives
hooks/                  # Transaction hooks, balance hooks, UI hooks
lib/                    # Contracts, tokens, config, wagmi, gas, ABIs
```

---

## Operations

### Wrap / Unwrap

Convert public tokens (USDC, RLC) into confidential tokens (cUSDC, cRLC) at 1:1 ratio. Unwrap burns cTokens to recover the underlying ERC-20.

### Confidential Transfer

Transfer cTokens to another address. The amount is encrypted — no on-chain observer can determine it.

### Selective Disclosure

Grant a viewer (auditor, regulator) read access to your confidential balance. Access is per-handle and must be re-granted after each transaction.

### Delegated View

View confidential balances that other users have shared with you. Displays the list of tokens you have been granted access to, with decrypted amounts.

---

## License

MIT
