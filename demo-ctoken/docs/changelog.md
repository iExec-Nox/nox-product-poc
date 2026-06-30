# Changelog du projet

Historique chronologique des décisions et implémentations du projet Nox Confidential Token Demo.

---

### 2026-06-09 — Migration du réseau Arbitrum Sepolia → Ethereum Sepolia

Bascule complète de la démo sur **Ethereum Sepolia** (chainId 11155111) : config wagmi/AppKit (`arbitrumSepolia` → `sepolia`), liens explorer Arbiscan → Etherscan (`ARBISCAN_BASE_URL` → `EXPLORER_BASE_URL`, composant `ArbiscanLink` → `ExplorerLink`), RPC (`NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC`), suppression de l'étape Bridge du faucet, adresses contrats redéployées, et mise à jour de toute la copy/SEO. Supersède ADR-0004.

→ ADR : [ADR-0019](./decisions/0019-migrate-to-ethereum-sepolia.md)

### 2026-03-25 — Refonte modal Faucet avec sections collapsibles

Restructuration de la modal faucet en deux sections collapsibles numérotées "GET GAS" (ETH + Bridge) et "GET TOKENS" (RLC + USDC). Ajout d'une carte Bridge to Arbitrum Sepolia, warning réseau sous USDC, et composant `FaucetSection` réutilisable basé sur shadcn Collapsible.

→ ADR : [ADR-0018](./decisions/0018-revamp-faucet-modal-collapsible-sections.md)

### 2026-03-15 — Guide : Rate Limiting RPC & Cooldowns NoxCompute

Documentation de référence détaillant tous les appels RPC par action (Wrap, Unwrap, Transfer, AddViewer), les cooldowns NoxCompute, le polling en arrière-plan, et les pistes d'amélioration (batch, retry, fallback, polling interval).

→ Voir : [Guide RPC](./todo/0004-rpc-rate-limiting-guide.md)

### 2026-03-15 — Étude : Migration Activity Explorer vers Subgraph

Étude du subgraph Nox Protocol Indexer existant et de l'explorer iExec v2. Le subgraph indexe les handles et ACL mais pas les events token (Wrap, Unwrap, Transfer). Recommandation : étendre le subgraph avec des entités dédiées pour éliminer les appels RPC qui causent les erreurs 429.

→ Voir : [Étude Subgraph](./todo/0003-subgraph-activity-explorer.md)

### 2026-03-15 — Bloquer la fermeture des modales pendant une transaction

Blocage de tous les chemins de fermeture (X, Cancel, Escape, clic overlay) des modales Wrap, Transfer et Selective Disclosure quand une transaction blockchain est en cours. Empêche la perte de fonds sur les flows multi-étapes (ex: unwrap).

→ ADR : [ADR-0016](./decisions/0016-block-modal-close-during-tx.md)

### 2026-03-15 — Audit Clean & Accessibilité

Audit complet du codebase (Next.js, React, Web3, qualité, performance, accessibilité WCAG 2.1 AA). 44 findings identifiés : 5 critiques, 14 majeurs, 9 accessibilité, 16 mineurs. Build et lint passent sans erreur.

→ Voir : [Audit Clean & A11y](./todo/0002-audit-clean-a11y.md)

### 2026-03-15 — Conserver Shiki pour le syntax highlighting (Dev Mode)

Étude comparative Shiki vs prism-react-renderer pour le highlighting des snippets Solidity/TypeScript dans les modales Dev Mode. Décision de conserver Shiki pour le support natif Solidity, la qualité VS Code-identique, et la pérennité de l'écosystème. Optimisations identifiées : passage à `shiki/core` + JS engine + singleton highlighter pour réduire le bundle de ~70%.

→ ADR : [ADR-0015](./decisions/0015-syntax-highlighting-shiki.md)

### 2026-03-10 — Validation de balance dans les modales Unwrap et Transfer

Ajout de la validation de balance dans les modales Unwrap et Transfer pour empêcher les transactions avec un montant supérieur au solde disponible.

→ ADR : [ADR-0013](./decisions/0013-balance-validation-modals.md)

### 2026-03-10 — Account Abstraction via Reown AppKit

Recherche sur l'intégration Account Abstraction via Reown AppKit pour simplifier l'onboarding utilisateur.

→ Voir : [Étude AA](./todo/0001-reown-account-abstraction.md)

### 2026-03-08 — Réorganisation des composants par dossiers thématiques

Regroupement des 44 composants à plat en 6 sous-dossiers thématiques (layout, landing, dashboard, explorer, modals, shared) pour améliorer la lisibilité et la navigation. Mise à jour de tous les imports, aucun changement fonctionnel.

→ ADR : [ADR-0012](./decisions/0012-reorganize-components-folders.md)

### 2026-03-05 — Reduire la largeur du dropdown WalletButton

Reduction de la largeur du dropdown WalletButton de `w-[200px]` a `w-[150px]` pour un meilleur alignement visuel avec le bouton trigger.

→ ADR : [ADR-0008](./decisions/0008-wallet-dropdown-match-trigger-width.md)

### 2026-03-01 — Page Activity Explorer

Implémentation de la page `/explorer` avec table d'historique des transactions (Wrap, Transfer, Unwrap, Delegation), filtre dropdown par type d'action, pagination, liens Arbiscan, et données mock en attente du SDK. Suit le pattern Page → Content du dashboard avec tokens sémantiques light/dark.

→ ADR : [ADR-0007](./decisions/0007-activity-explorer-page.md)

### 2026-03-01 — Modale Selective Disclosure

Implémentation de la modale Selective Disclosure (délégation de vue ACL) avec formulaire d'ajout de viewer (adresse, scope Full Portfolio/Specific Token, sélection de tokens), code viewer dev mode, sections Current/Past Viewers statiques, et security note. Pattern Provider/Hook cohérent avec les modales existantes.

→ ADR : [ADR-0006](./decisions/0006-selective-disclosure-modal.md)

### 2026-02-27 — Forcer le réseau Arbitrum Sepolia

Restriction de la config AppKit à Arbitrum Sepolia uniquement (`allowUnsupportedChain: false`, retrait d'`arbitrum` mainnet). Le mécanisme per-dApp natif de MetaMask et AppKit `defaultNetwork` assurent la connexion sur le bon réseau sans code custom.

→ ADR : [ADR-0004](./decisions/0004-enforce-arbitrum-sepolia-network.md)

### 2026-02-26 — Connexion wallet via RainbowKit

Implémentation de la connexion wallet avec modale custom fidèle au design Figma, support Arbitrum + Arbitrum Sepolia, blur backdrop, et redirection post-connexion vers le dashboard.

→ ADR : [ADR-0001](./decisions/0001-wallet-connect-rainbowkit.md)

### 2026-02-27 — Modale Faucet

Ajout d'une modale Faucet (shadcn Dialog) avec 3 cartes token (ETH, RLC, USDC), accessible depuis le nav menu, l'empty portfolio et la topbar via un Context React.

→ ADR : [ADR-0003](./decisions/0003-faucet-modal.md)
