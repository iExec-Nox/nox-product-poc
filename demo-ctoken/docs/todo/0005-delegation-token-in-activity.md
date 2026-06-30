# Fix : Afficher le nom du token dans les Delegation de l'Activity Explorer

**Date :** 2026-03-15
**Statut :** À traiter
**Priorité :** Low — amélioration cosmétique, pas de régression fonctionnelle

## Problème

Dans la page Activity, les lignes de type "Delegation" affichent **"ACL"** dans la colonne Asset au lieu du nom du cToken concerné (ex: "cRLC", "cUSDC").

**Cause racine :** L'event on-chain `ViewerAdded(sender, viewer, handle)` ne contient **pas de champ token** — uniquement un handle (bytes32) opaque. Le code actuel hardcode `asset: "ACL"` (ligne 201 de `use-activity-history.ts`).

## Analyse des options

### Option A — Reverse lookup RPC via `confidentialBalanceOf` (partiel)

Pour chaque ViewerAdded event, comparer son `handle` avec le handle actuel de chaque cToken (`confidentialBalanceOf(user)` par TOKEN_PAIR).

| Avantage | Inconvénient |
|----------|-------------|
| Pas de dépendance externe | Ne fonctionne que si le handle n'a pas changé (= pas de tx depuis le grant) |
| 0 changement d'archi | +2 appels RPC par fetch (un par TOKEN_PAIR) |

**Verdict :** Fragile — les handles changent à chaque tx, donc les anciennes delegations resteraient "ACL".

### Option B — Cache localStorage côté client (fiable pour les tx depuis l'app) ✅

Stocker un mapping `txHash → { asset, viewer }` dans localStorage au moment de l'exécution de `useAddViewer`, puis le relire dans `useActivityHistory` pour enrichir les entries delegation.

| Avantage | Inconvénient |
|----------|-------------|
| 100% fiable pour les tx faites depuis l'app | Les tx faites depuis un autre client (Etherscan direct) restent "ACL" |
| 0 appel RPC supplémentaire | Dépend de localStorage (pas critique, fallback "ACL") |
| Simple à implémenter | |

**Verdict :** Meilleur compromis court-terme. Fallback gracieux sur "ACL" si pas de cache.

### Option C — Subgraph HandleRole (solution long-terme)

Utiliser le subgraph existant (TODO-0003) : l'entité `Handle` a un champ `operator` qui identifie le type d'opération, et le DAG parent/child permet de remonter au contrat token source.

| Avantage | Inconvénient |
|----------|-------------|
| 100% fiable, y compris historique | Dépend de la migration subgraph (TODO-0003 Phase 2) |
| Résout aussi d'autres problèmes | Plus long à implémenter |

**Verdict :** Solution définitive, mais pas immédiate.

## Plan d'implémentation — Option B

### Étape 1 : Créer un helper de cache delegation (`lib/delegation-cache.ts`)

```ts
const STORAGE_KEY = "nox-delegation-cache";

interface DelegationCacheEntry {
  asset: string;    // "cRLC", "cUSDC"
  viewer: string;   // adresse du viewer
}

export function cacheDelegation(txHash: string, entry: DelegationCacheEntry): void;
export function getDelegationCache(): Record<string, DelegationCacheEntry>;
```

Simple wrapper autour de `localStorage.getItem` / `setItem` avec JSON parse/stringify.

### Étape 2 : Écrire dans le cache depuis `useAddViewer`

Dans `hooks/use-add-viewer.ts`, après chaque `waitForTransactionReceipt` réussi (ligne 125-126), appeler `cacheDelegation(tx, { asset: token.symbol, viewer })`.

Le hook a déjà accès au `token.symbol` (via `handleEntries[].token`) et au `viewer` address.

### Étape 3 : Lire le cache dans `useActivityHistory`

Dans `hooks/use-activity-history.ts`, au moment de builder les delegation entries (lignes 196-206) :

```ts
const delegationCache = getDelegationCache();

for (const log of viewerLogs) {
  const cached = log.transactionHash ? delegationCache[log.transactionHash] : null;
  const viewer = log.args.viewer;
  allEntries.push({
    id: `${log.transactionHash}-${log.logIndex}`,
    type: "delegation",
    asset: cached?.asset ?? "ACL",  // ← enrichi si cache dispo
    amount: viewer ? `${viewer.slice(0, 6)}...${viewer.slice(-4)}` : "—",
    timestamp: getTs(log.blockNumber),
    txHash: log.transactionHash!,
  });
}
```

### Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `lib/delegation-cache.ts` | **Nouveau** — helper localStorage (< 20 lignes) |
| `hooks/use-add-viewer.ts` | +1 import, +1 ligne après chaque tx confirmé |
| `hooks/use-activity-history.ts` | +1 import, modifier le builder delegation (3 lignes) |

### Complexité

**Faible.** ~30 lignes de code ajoutées, 0 appel RPC supplémentaire, fallback transparent.

## Lien

- Dépend de : rien
- Lié à : TODO-0003 (subgraph — solution long-terme Option C)
