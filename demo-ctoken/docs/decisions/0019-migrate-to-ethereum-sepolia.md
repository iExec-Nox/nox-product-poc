# ADR-0019 : Migration du réseau Arbitrum Sepolia → Ethereum Sepolia

**Date :** 2026-06-09
**Statut :** Accepté

## Contexte

La démo tournait jusqu'ici sur **Arbitrum Sepolia** (chainId 421614). On souhaite la faire tourner **uniquement sur Ethereum Sepolia** (chainId 11155111). Comme tous les contrats (tokens USDC/RLC, cTokens ERC-7984, NoxCompute) sont redéployés sur Ethereum Sepolia, le L2 Arbitrum n'a plus de raison d'être — y compris l'étape de bridge L1 → L2 du faucet.

Ce changement remplace et supersède [ADR-0004](./0004-enforce-arbitrum-sepolia-network.md) (forçage du réseau Arbitrum Sepolia).

## Décision

Bascule de toute la configuration chaîne sur `sepolia` :

1. **Réseau wagmi / AppKit** — `arbitrumSepolia` → `sepolia` dans `lib/wagmi.ts` et `components/providers.tsx` (`networks`, `defaultNetwork`, transport). `allowUnsupportedChain: false` est conservé (même enforcement qu'ADR-0004, désormais sur Ethereum Sepolia).
2. **Explorer** — Arbiscan → **Etherscan Sepolia**. La constante `ARBISCAN_BASE_URL` devient `EXPLORER_BASE_URL` (= `https://sepolia.etherscan.io`) et le composant partagé `ArbiscanLink` devient `ExplorerLink`, pour éviter un nom de chaîne trompeur dans l'abstraction.
3. **RPC** — `CONFIG.rpc.ethereumSepolia`, lu depuis `NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC` avec fallback public `https://ethereum-sepolia-rpc.publicnode.com`. La variable d'env `NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC` est renommée.
4. **Faucet** — Suppression de la carte « Bridge to Arbitrum Sepolia » (plus de bridge L2). La section « Get Gas » ne garde que le faucet ETH. Warnings et libellés mis à jour pour Ethereum Sepolia (voir et supersède l'organisation d'[ADR-0018](./0018-revamp-faucet-modal-collapsible-sections.md)).
5. **Contrats** — Les 5 adresses de `lib/contracts.ts` sont remplacées par celles redéployées sur Ethereum Sepolia.
6. **Copy / SEO** — Toutes les mentions « Arbitrum » visibles utilisateur (topbar, modales Wrap/Transfer, explorer, terms, metadata) deviennent « Ethereum ».

## Alternatives envisagées

- **Garder `ARBISCAN_BASE_URL` / `ArbiscanLink` et ne changer que l'URL** — Rejeté : le nom resterait trompeur. Le projet valorise des abstractions au nom neutre (`EXPLORER_BASE_URL`).
- **Support multi-chaîne (Arbitrum + Ethereum)** — Rejeté : la demande est explicitement « uniquement Ethereum ». Le multi-chaîne ajouterait de la complexité sans bénéfice pour la démo.

## Conséquences

- **Positif :** Plus d'étape de bridge dans le faucet → onboarding simplifié. Configuration toujours centralisée (`lib/config.ts`, `lib/wagmi.ts`, `lib/contracts.ts`).
- **Négatif / Risques :** Dépend du redéploiement effectif des contrats sur Ethereum Sepolia. Le gas sur Ethereum Sepolia se comporte différemment d'Arbitrum, mais le buffer 20 % de `lib/gas.ts` reste pertinent.
