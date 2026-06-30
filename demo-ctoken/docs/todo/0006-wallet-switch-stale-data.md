# Fix : Données stales lors d'un changement de wallet à la volée

**Date :** 2026-03-26
**Statut :** À traiter
**Priorité :** High — bug UX signalé, affiche les données d'un autre wallet

## Problème

Quand un utilisateur connecté switch de compte dans MetaMask (ou Rabby), l'app continue d'afficher les données de l'ancien wallet (balances déchiffrées, état des modales, historique d'activité) au lieu de reset pour le nouveau compte.

**Cause racine :** Plusieurs hooks et composants stockent des données wallet-spécifiques dans un `useState` local sans réagir au changement de `address` retourné par wagmi.

## Composants impactés

### 1. `useDecryptBalance` — CRITIQUE

**Fichier :** `hooks/use-decrypt-balance.ts:11`

`decryptedAmounts` est un `Record<string, string>` en `useState` jamais reset au changement d'adresse. Le `useCallback` (ligne 34) ne dépend pas de `address`.

**Symptôme :** Wallet A déchiffre 100 cRLC → switch vers Wallet B → "100 cRLC" toujours affiché.

**Fix proposé :** Ajouter un `useEffect` qui reset `decryptedAmounts` à `{}` quand `address` change.

```ts
const { address } = useAccount();

useEffect(() => {
  setDecryptedAmounts({});
}, [address]);
```

### 2. `ConfidentialTokenRow` — CRITIQUE

**Fichier :** `components/dashboard/confidential-assets.tsx:95-96`

`decryptState` et `decryptedAmount` persistent car le composant est monté avec `key={token.symbol}`. Le `key` ne change pas au switch de wallet → React réutilise l'instance existante.

**Symptôme :** L'icône eye reste en "revealed" avec le montant de l'ancien wallet.

**Fix proposé :** Changer le `key` pour inclure l'adresse du wallet.

```tsx
// Dans ConfidentialAssets (ligne 56)
<ConfidentialTokenRow key={`${token.symbol}-${address}`} ... />
```

### 3. Modales (wrap, transfer, selective disclosure) — HIGH

**Fichiers :** `components/modals/wrap-modal.tsx:96-103`, `transfer-modal.tsx`, `selective-disclosure-modal.tsx`

Le `useEffect` de reset dépend de `[open, activeTab, ...]` mais pas de `address`. Si la modale est ouverte pendant un switch, le formulaire et l'état de transaction persistent.

**Fix proposé :** Ajouter `address` dans les dépendances du `useEffect` de reset.

```ts
const { address } = useAccount();

useEffect(() => {
  setAmount("");
  resetWrap();
  resetUnwrap();
}, [open, activeTab, address, resetWrap, resetUnwrap, setDropdownOpen]);
```

### 4. Hooks de transaction — MEDIUM

**Fichiers :** `hooks/use-wrap.ts`, `use-unwrap.ts`, `use-confidential-transfer.ts`, `use-add-viewer.ts`

`step`, `error`, et `txHash` persistent entre les wallets. Les futures transactions utilisent la bonne adresse (dépendance correcte dans le `useCallback`), mais l'état précédent reste visible.

**Fix proposé :** Ajouter un `useEffect` qui appelle `reset()` quand `address` change.

```ts
const { address } = useAccount();

useEffect(() => {
  reset();
}, [address]); // eslint-disable-line react-hooks/exhaustive-deps
```

### 5. `useActivityHistory` — MEDIUM

**Fichier :** `hooks/use-activity-history.ts:70-75`

`address` est bien dans les dépendances du `useEffect` (ligne 235), mais `setEntries([])` n'est appelé que si `!address`. Lors d'un changement d'adresse (A → B), les anciennes entrées restent affichées pendant le refetch.

**Fix proposé :** Clear les entrées immédiatement au début de l'effet.

```ts
useEffect(() => {
  setEntries([]);
  setIsLoading(true);

  if (!address || !publicClient) {
    setIsLoading(false);
    return;
  }
  // ... fetch
}, [address, publicClient]);
```

## Ce qui fonctionne déjà

| Hook | Pourquoi c'est OK |
|---|---|
| `useConfidentialBalances` | `useReadContracts` avec `address` dans les args — wagmi re-fetch auto |
| `useTokenBalances` | Même pattern wagmi |
| `useHandleClient` | Query key inclut l'adresse — nouveau client créé automatiquement |
| `useDevMode` | Agnostique au wallet (localStorage global) |

## Plan d'implémentation

1. Fixes #1 et #2 ensemble (dashboard — impact visuel le plus fort)
2. Fix #3 (modales — nécessite de tester les 3 modales)
3. Fixes #4 et #5 ensemble (hooks — plus mineur)
4. Test manuel : connecter Wallet A → déchiffrer balances → ouvrir modale → switch vers Wallet B dans MetaMask → vérifier que tout reset

## Estimation

5 fichiers à modifier, ~15 lignes de code ajoutées. Pas de changement d'architecture.
