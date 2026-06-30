# ADR-0004 : Forcer le réseau Arbitrum Sepolia pour la connexion wallet

**Date :** 2026-02-27
**Statut :** Accepté

## Contexte

Les contrats du projet (ERC-7984, tokens USDC/RLC) sont déployés uniquement sur Arbitrum Sepolia. Il fallait s'assurer que les utilisateurs se connectent exclusivement sur ce réseau.

## Décision

La configuration Reown AppKit existante gère nativement l'enforcement du réseau grâce à la combinaison de deux paramètres :

1. **`defaultNetwork: arbitrumSepolia`** — Lors de la connexion wallet, AppKit demande au wallet de se connecter sur Arbitrum Sepolia. MetaMask (et les wallets EIP-3085 compatibles) gèrent une connexion **par site web** : le wallet connecte automatiquement la dApp sur le réseau demandé, indépendamment du réseau global affiché dans l'extension.

2. **`allowUnsupportedChain: false`** (changé de `true`) — Empêche la connexion sur des réseaux non listés dans la config.

3. **`networks: [arbitrumSepolia]`** — Seul réseau disponible. Retrait d'`arbitrum` mainnet qui était présent sans raison.

Aucun hook custom n'est nécessaire. Le comportement natif d'AppKit + MetaMask per-dApp suffit.

## Alternatives envisagées

- **Hook `useNetworkEnforcement`** avec détection du chain ID et `switchChain` automatique — Rejeté car AppKit wrappe tous les providers et rapporte toujours le `defaultNetwork` via ses hooks, rendant la détection du vrai chain impossible. De plus, le mécanisme per-dApp de MetaMask rend cette détection inutile.

## Conséquences

- **Positif :** Configuration minimale, aucun code custom à maintenir. Fonctionne avec tous les wallets supportés (MetaMask, Rabby, Coinbase Wallet, WalletConnect).
- **Négatif / Risques :** Aucun identifié. Le comportement per-dApp de MetaMask est un standard depuis 2023.
