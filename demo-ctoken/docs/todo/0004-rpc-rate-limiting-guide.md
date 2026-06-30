# Guide : Rate Limiting RPC & Cooldowns NoxCompute

> Document de référence pour investiguer les erreurs liées au RPC Arbitrum Sepolia et aux cooldowns entre transactions.

---

## Contexte du problème

L'app effectue de **nombreux appels RPC** : polling des balances (~4s), estimation de gas avant chaque tx, `waitForTransactionReceipt`, etc. Sur le RPC public Arbitrum Sepolia, on atteint rapidement le **rate limit** (erreurs 429), surtout en environnement Vercel avec plusieurs utilisateurs.

En parallèle, **NoxCompute (TEE)** a un temps de traitement entre les transactions séquentielles. Sans cooldown, les appels échouent silencieusement.

---

## Détail des appels RPC par action

Chaque action utilisateur déclenche une séquence précise d'appels RPC. Le type indique si c'est un appel direct au nœud Arbitrum (RPC), un appel au wallet (Wallet = MetaMask/Rabby qui envoie la tx via le RPC aussi), ou un appel hors-chaîne (Handle Gateway).

### Wrap (approve + wrap) — `hooks/use-wrap.ts`

| # | Appel | Type | Ligne | Description |
|---|-------|------|-------|-------------|
| 1 | `estimateFeesPerGas()` | RPC | ~77 | Gas EIP-1559 pour approve (+20% buffer) |
| 2 | `writeContractAsync()` — `ERC20.approve(cToken, amount)` | Wallet → RPC | ~72 | Envoie la tx approve |
| 3 | `waitForTransactionReceipt({ hash })` | RPC (polling) | ~84 | Poll toutes les ~1s jusqu'au minage |
| — | **⏱ Cooldown 2s** | — | ~87 | Attend que NoxCompute traite l'approve |
| 4 | `estimateFeesPerGas()` | RPC | ~97 | Gas EIP-1559 pour wrap (+20% buffer) |
| 5 | `writeContractAsync()` — `cToken.wrap(user, amount)` | Wallet → RPC | ~92 | Envoie la tx wrap |
| 6 | `waitForTransactionReceipt({ hash })` | RPC (polling) | ~103 | Poll jusqu'au minage |
| 7 | `invalidateBalances()` | — | ~106 | Déclenche un refetch des balances (→ RPC calls via wagmi) |

**Total : ~6 appels RPC directs + N polls + refetch balances**

---

### Unwrap (encrypt + unwrap + finalize) — `hooks/use-unwrap.ts`

| # | Appel | Type | Ligne | Description |
|---|-------|------|-------|-------------|
| 1 | `estimateFeesPerGas()` | RPC | ~139 | Gas EIP-1559 (pré-calculé, réutilisé pour unwrap) |
| 2 | `handleClient.encryptInput(amount, "uint256", cToken)` | Handle Gateway | ~146 | Chiffre le montant hors-chaîne (pas un appel RPC) |
| 3 | `writeContractAsync()` — `cToken.unwrap(user, user, handle, proof)` | Wallet → RPC | ~155 | Envoie la tx unwrap |
| 4 | `waitForTransactionReceipt({ hash })` | RPC (polling) | ~172 | Poll + récupère le receipt pour décoder l'event |
| 5 | `decodeEventLog()` — extraction `UnwrapRequested.amount` | Local | ~182 | Pas d'appel RPC — décode depuis le receipt |
| — | **⏱ Cooldown 2s** | — | ~206 | Attend que NoxCompute traite le burn |
| 6 | `estimateFeesPerGas()` | RPC | ~74 | Gas EIP-1559 pour finalizeUnwrap (+20% buffer) |
| 7 | `writeContractAsync()` — `cToken.finalizeUnwrap(handle, amount, proof)` | Wallet → RPC | ~76 | Envoie la tx finalize |
| 8 | `invalidateBalances()` | — | ~87 | Refetch balances |

**Total : ~7 appels RPC directs + N polls + 1 appel Handle Gateway + refetch balances**

**En cas de retry finalize** (si l'étape 7 échoue) :
- ⏱ Cooldown 2s supplémentaire (ligne ~105)
- Ré-exécution des étapes 6-7-8

---

### Transfer (encrypt + transfer) — `hooks/use-confidential-transfer.ts`

| # | Appel | Type | Ligne | Description |
|---|-------|------|-------|-------------|
| 1 | `estimateFeesPerGas()` | RPC | ~84 | Gas EIP-1559 (+20% buffer) |
| 2 | `handleClient.encryptInput(amount, "uint256", cToken)` | Handle Gateway | ~90 | Chiffre le montant hors-chaîne |
| 3 | `writeContractAsync()` — `cToken.confidentialTransfer(recipient, handle, proof)` | Wallet → RPC | ~99 | Envoie la tx transfer |
| 4 | `waitForTransactionReceipt({ hash })` | RPC (polling) | ~110 | Poll jusqu'au minage |
| 5 | `invalidateBalances()` | — | ~113 | Refetch balances |

**Total : ~4 appels RPC directs + N polls + 1 appel Handle Gateway + refetch balances**

---

### Add Viewer / ACL — `hooks/use-add-viewer.ts`

| # | Appel | Type | Ligne | Description |
|---|-------|------|-------|-------------|
| 1 | `estimateFeesPerGas()` | RPC | ~73 | Gas EIP-1559 (1 seule fois, réutilisé pour tout) |
| 2 | `readContract()` — `cToken.confidentialBalanceOf(user)` | RPC | ~89 | **× N tokens** — lit le handle de balance de chaque token |
| — | **Boucle par handle trouvé :** | | | |
| 3 | `writeContractAsync()` — `NoxCompute.addViewer(handle, viewer)` | Wallet → RPC | ~115 | Envoie la tx addViewer |
| 4 | `waitForTransactionReceipt({ hash })` | RPC (polling) | ~124 | Poll jusqu'au minage |
| — | **⏱ Cooldown 2s** | — | ~128 | Avant le prochain addViewer |

**Total par token : 1 readContract + 1 writeContract + N polls + 1 cooldown**
**Avec 2 tokens (cRLC + cUSDC) : ~7 appels RPC + 2×N polls**

---

### Appels RPC en arrière-plan (permanents sur le dashboard)

En plus des actions utilisateur, ces hooks **tournent en continu** :

| Hook | Appel RPC | Fréquence | Fichier |
|------|-----------|-----------|---------|
| `useBalance()` | `eth_getBalance` | ~4s (par bloc) | `hooks/use-token-balances.ts` |
| `useReadContracts()` | `eth_call` × 3 tokens ERC-20 | ~4s (par bloc) | `hooks/use-token-balances.ts` |
| `useGasPrice()` | `eth_gasPrice` | ~4s (par bloc) | `hooks/use-estimated-fee.ts` |
| Balances confidentielles | `eth_call` × N cTokens | Sur refetch | `hooks/use-token-balances.ts` |

**Estimation : ~5-8 appels RPC toutes les ~4 secondes, soit ~75-120 calls/minute juste pour le polling.**

---

## 1. Configuration RPC actuelle

**Fichiers :** `lib/config.ts` (URL) + `lib/wagmi.ts` (transport)

```typescript
// lib/config.ts
export const CONFIG = {
  rpc: {
    arbitrumSepolia: "https://arbitrum-sepolia.gateway.tenderly.co",
  },
  // ...
} as const;
export const RPC_URL = CONFIG.rpc.arbitrumSepolia;

// lib/wagmi.ts
import { RPC_URL } from "@/lib/config";
transports: {
  [arbitrumSepolia.id]: http(RPC_URL),
}
```

**Problème :** Le transport `http()` utilise les défauts viem — pas de config de retry, pas de batch, pas de polling interval custom. Tenderly rate-limite sur les requêtes intensives (Activity Explorer).

**Piste d'amélioration :**
```typescript
// Exemple avec retry et batch
import { http, fallback } from "viem";

http(rpcUrl, {
  batch: true,                    // Batch JSON-RPC calls
  retryCount: 3,                  // Retry on failure
  retryDelay: 1000,               // 1s between retries
  timeout: 10_000,                // 10s timeout per request
})

// Ou avec fallback sur plusieurs RPCs
fallback([
  http(primaryRpc),
  http("https://sepolia-rollup.arbitrum.io/rpc"),  // public en backup
])
```

---

## 2. Polling des balances (source principale de load RPC)

**Fichiers :** `hooks/use-token-balances.ts`

wagmi poll les balances automatiquement (~4s par défaut). Avec 3 tokens ERC-20 + 1 ETH natif + les balances confidentielles, ça génère beaucoup de calls.

**Hooks concernés :**
- `useBalance()` — ETH natif
- `useReadContracts()` — ERC-20 balances (batch, mais toujours fréquent)
- `useGasPrice()` dans `hooks/use-estimated-fee.ts` — refresh chaque bloc

**Piste :** Augmenter le `pollingInterval` dans la config wagmi ou par hook :
```typescript
useBalance({ address, pollingInterval: 15_000 }) // 15s au lieu de 4s
```

---

## 3. Cooldowns entre transactions séquentielles (2s)

NoxCompute (TEE) a un **délai de traitement** entre les étapes. On a mis des cooldowns de 2 secondes.

| Hook | Fichier | Ligne | Moment du cooldown |
|------|---------|-------|--------------------|
| `useWrap` | `hooks/use-wrap.ts` | ~86 | Après approve, avant wrap |
| `useUnwrap` | `hooks/use-unwrap.ts` | ~105 | Avant retry finalize |
| `useUnwrap` | `hooks/use-unwrap.ts` | ~205 | Après unwrap tx, avant finalize |
| `useAddViewer` | `hooks/use-add-viewer.ts` | ~127 | Entre chaque addViewer dans la boucle |

**Pattern utilisé :**
```typescript
await publicClient.waitForTransactionReceipt({ hash: tx });
// Small cooldown — NoxCompute rate-limits rapid successive calls
await new Promise((r) => setTimeout(r, 2000));
```

**Si les erreurs persistent :** essayer 3000ms. Le TEE peut être plus lent sous charge.

---

## 4. `waitForTransactionReceipt` — aucune option custom

Tous les hooks utilisent `waitForTransactionReceipt` avec les **défauts viem** (pas de timeout, pas de pollingInterval, pas de confirmations).

**Fichiers concernés :**
- `hooks/use-wrap.ts` (×2 : approve + wrap)
- `hooks/use-unwrap.ts` (×1 : unwrap, puis finalize)
- `hooks/use-confidential-transfer.ts` (×1)
- `hooks/use-add-viewer.ts` (×1 par token dans la boucle)

**Piste :** Ajouter un timeout et un polling plus espacé :
```typescript
await publicClient.waitForTransactionReceipt({
  hash: tx,
  timeout: 60_000,           // 60s max
  pollingInterval: 4_000,    // Poll toutes les 4s (au lieu de ~1s)
  confirmations: 1,          // 1 confirmation suffit sur Arbitrum
});
```

---

## 5. Estimation de gas (appels RPC supplémentaires)

**Fichier :** `lib/gas.ts`

```typescript
export async function estimateGasOverrides(publicClient) {
  const fees = await publicClient.estimateFeesPerGas();
  return {
    maxFeePerGas: (fees.maxFeePerGas * 120n) / 100n,         // +20% buffer
    maxPriorityFeePerGas: (fees.maxPriorityFeePerGas * 120n) / 100n,
  };
}
```

**Appelé avant chaque writeContract** — c'est un appel RPC à chaque étape de chaque transaction. Sur un wrap (approve + wrap), c'est 2 appels `estimateFeesPerGas` supplémentaires.

**Pourquoi le buffer 20% :** MetaMask sous-estime le gas sur Arbitrum Sepolia. Sans ça, les tx échouent.

---

## 6. Gestion d'erreurs — pas de détection rate-limit

**Fichier :** `lib/utils.ts`

```typescript
export function formatTransactionError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Transaction failed";
  // Détecte uniquement le rejet user, tronque le reste à 200 chars
}
```

**Problème :** Les erreurs 429 (rate limit) sont traitées comme des erreurs génériques. Pas de retry automatique, pas de message spécifique à l'utilisateur.

**Piste :** Détecter les erreurs rate-limit et informer l'utilisateur :
```typescript
const isRateLimited =
  message.includes("429") ||
  message.includes("rate limit") ||
  message.includes("Too Many Requests");

if (isRateLimited) return "RPC rate limited — please wait a moment and retry";
```

---

## 7. QueryClient React Query — défauts

**Fichier :** `components/providers.tsx`

```typescript
const [queryClient] = useState(() => new QueryClient());
```

Aucune config custom. **Défauts wagmi/React Query v5 :**
- `retry: 3` avec backoff exponentiel
- `staleTime: 0` (immédiatement stale)
- `gcTime: 5 min` (garbage collection)

Les 3 retries avec backoff ajoutent des appels RPC supplémentaires en cas d'erreur.

---

## 8. CoinGecko API — ISR 60s

**Fichier :** `app/api/prices/route.ts`

Cache ISR de 60s. Pas de retry côté serveur. Retourne 502/503 en cas d'échec. Pas un problème de rate-limit RPC mais peut ajouter de la confusion si les prix ne se chargent pas.

---

## Checklist d'investigation

1. **Vérifier les logs réseau** (Network tab) — chercher les réponses 429 du RPC
2. **Compter les appels RPC par seconde** — polling balances + gas price + estimateFeesPerGas
3. **Tester avec un RPC dédié** — Alchemy / Infura via `NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC`
4. **Augmenter les cooldowns** si NoxCompute échoue (2s → 3s)
5. **Ajouter `batch: true`** au transport viem pour regrouper les calls
6. **Réduire le polling** — `pollingInterval: 15_000` sur les hooks de balance
7. **Ajouter un timeout** à `waitForTransactionReceipt` pour éviter les blocages
8. **Détecter les 429** dans `formatTransactionError` pour un message clair

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `lib/config.ts` | URL RPC centralisée |
| `lib/wagmi.ts` | Config transport wagmi |
| `lib/gas.ts` | Estimation gas avec buffer 20% |
| `lib/utils.ts` | Formatage des erreurs tx |
| `hooks/use-wrap.ts` | Flow wrap avec cooldown |
| `hooks/use-unwrap.ts` | Flow unwrap avec 2 cooldowns |
| `hooks/use-confidential-transfer.ts` | Flow transfer |
| `hooks/use-add-viewer.ts` | Flow ACL avec cooldown en boucle |
| `hooks/use-token-balances.ts` | Polling des balances |
| `hooks/use-estimated-fee.ts` | Gas price auto-refresh |
| `components/providers.tsx` | QueryClient (défauts) |
| `app/api/prices/route.ts` | CoinGecko ISR 60s |
