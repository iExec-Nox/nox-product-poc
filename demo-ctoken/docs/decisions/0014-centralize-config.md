# ADR-0014 : Centralisation de la configuration dans `lib/config.ts`

**Date :** 2026-03-15
**Statut :** Accepté (rétroactif — implémenté via PR #9)

## Contexte

Les constantes de configuration (URLs, RPC, timings, clés localStorage, WalletConnect) étaient dispersées dans 21 fichiers. Chaque valeur était dupliquée à plusieurs endroits :

- `ARBISCAN_BASE_URL` hardcodé dans 4 fichiers (arbiscan-link, activity-table, modales)
- `TEE_COOLDOWN_MS` (2000ms) copié dans 4 hooks (wrap, unwrap, transfer, add-viewer)
- URL de l'app dupliquée dans layout, sitemap, landing, footer
- URLs des faucets, CoinGecko, docs/github dispersées dans les composants
- WalletConnect projectId lu directement dans `lib/wagmi.ts`

Modifier une URL ou un timing obligeait à chercher et patcher N fichiers — source d'oublis et d'incohérences.

## Décision

Créer un fichier unique `lib/config.ts` contenant un objet `CONFIG` structuré par catégorie :

```ts
export const CONFIG = {
  urls:           { app, arbiscan, docs, github, contact, coingeckoApi, faucets },
  rpc:            { arbitrumSepolia },
  timing:         { teeCooldownMs, priceRefreshMs, activityPollMs },
  storage:        { devModeKey },
  walletConnect:  { projectId },
} as const;
```

Des **aliases de commodité** sont exportés pour les valeurs les plus fréquemment utilisées :

```ts
export const APP_URL = CONFIG.urls.app;
export const ARBISCAN_BASE_URL = CONFIG.urls.arbiscan;
export const RPC_URL = CONFIG.rpc.arbitrumSepolia;
export const TEE_COOLDOWN_MS = CONFIG.timing.teeCooldownMs;
```

Le WalletConnect projectId inclut un fallback `"demo"` avec `console.warn` si la variable d'environnement n'est pas définie.

### Périmètre

- **Inclus dans `lib/config.ts`** : URLs externes, RPC endpoints, timings, clés de storage, WalletConnect
- **Reste dans `lib/contracts.ts`** : adresses de contrats déployés (USDC, cRLC, NOX_COMPUTE…)
- **Reste dans `lib/tokens.ts`** : configuration des tokens (symboles, decimals, addresses)

## Fichiers impactés

21 fichiers migrés — principalement des remplacements d'imports :

| Catégorie | Fichiers | Valeurs migrées |
|-----------|----------|-----------------|
| URLs Arbiscan | arbiscan-link, activity-table, modales | `https://sepolia.arbiscan.io` → `ARBISCAN_BASE_URL` |
| URL App | layout, sitemap, landing, footer | URL de l'app → `APP_URL` |
| TEE Cooldown | use-wrap, use-unwrap, use-confidential-transfer, use-add-viewer | `2_000` → `TEE_COOLDOWN_MS` |
| Faucets | faucet-modal | URLs externes → `CONFIG.urls.faucets` |
| CoinGecko | prices route, use-token-prices | API URL → `CONFIG.urls.coingeckoApi` |
| RPC | wagmi, providers | Endpoint Tenderly → `RPC_URL` |
| Storage | use-dev-mode | `"nox-dev-mode"` → `CONFIG.storage.devModeKey` |
| WalletConnect | wagmi | `process.env` direct → `CONFIG.walletConnect.projectId` |

## Alternatives envisagées

- **Variables d'environnement pour tout** — rejeté : la plupart des valeurs sont statiques et n'ont pas besoin de varier par environnement. Alourdit `.env` inutilement.
- **Fichier JSON importé** — rejeté : pas de typage TypeScript natif, pas de computed values (ex: fallback WalletConnect).
- **Laisser les constantes dispersées** — rejeté : trop de duplication, risque d'incohérence à chaque modification.

## Conséquences

- **Positif :** Source unique de vérité pour toute la configuration. Modifier une URL ou un timing = 1 seul fichier à toucher. Les aliases permettent des imports courts (`import { TEE_COOLDOWN_MS } from "@/lib/config"`).
- **Négatif :** Fichier central qui peut grossir — à surveiller pour éviter le "god config". La séparation `config.ts` / `contracts.ts` / `tokens.ts` doit rester claire.
