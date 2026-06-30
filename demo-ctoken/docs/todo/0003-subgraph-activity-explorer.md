# Étude : Migration Activity Explorer vers Subgraph

**Date :** 2026-03-15
**Statut :** À traiter

## Contexte

La page Activity utilise `getContractEvents` avec `fromBlock: 0n` sur le RPC Tenderly pour récupérer l'historique des transactions. Cela provoque un flood de requêtes RPC → erreurs 429 (Too Many Requests) systématiques à l'ouverture de la page.

L'explorer iExec (https://github.com/iExecBlockchainComputing/explorer-v2) résout ce problème en utilisant **The Graph** (subgraph auto-hébergé) pour toutes les lectures d'historique, sans aucun appel RPC pour les events.

## Subgraph existant

Un subgraph Nox Protocol Indexer est déployé sur The Graph :
- **ID :** `BjQAX2HpmsSAzURJimKDhjZZnkSJtaczA8RPumggrStb`
- **Version :** 0.3.0
- **Réseau indexé :** Arbitrum Sepolia
- **Endpoint :** `https://api.thegraph.com/subgraphs/id/QmVuujNrwUdQMrhdSvEwzigJSTqbqRJoGgHEgF7FVpcUaK`

### Entités disponibles

| Entité | Champs clés | Description |
|--------|-------------|-------------|
| **Handle** | `id`, `operator`, `isPubliclyDecryptable`, `plaintext`, `parentHandles`, `childHandles`, `roles`, `blockNumber`, `blockTimestamp`, `transactionHash` | DAG des handles chiffrés NoxCompute |
| **HandleRole** | `id`, `handle`, `account`, `role` (ADMIN/VIEWER), `grantedBy`, `blockNumber`, `blockTimestamp`, `transactionHash` | ACL : qui a accès à quel handle |

### Opérateurs indexés sur Handle

| Opérateur | Correspondance token | Compte |
|-----------|---------------------|--------|
| `Mint` | Wrap (public → cToken) | 31 |
| `Burn` | Unwrap (cToken → public) | 10 |
| `Transfer` | Confidential Transfer | 27 |
| `PlaintextToEncrypted` | Encryption (input wrap) | 213 |

### Ce qui manque pour l'Activity Explorer

| Donnée nécessaire | Disponible ? | Détail |
|-------------------|-------------|--------|
| Wrap : from, to, amount, token | Non | `operator: "Mint"` existe mais pas d'adresses/montant explicites |
| Unwrap : receiver, cleartextAmount | Non | `operator: "Burn"` existe mais pas les champs spécifiques |
| ConfidentialTransfer : from, to | Non | `operator: "Transfer"` existe mais pas d'adresses explicites |
| Viewer delegation : account, grantedBy | **Oui** | Bien indexé dans `HandleRole` avec `role: VIEWER` |

## Recommandations

### 1. Étendre le subgraph (demande à l'équipe backend)

Ajouter des entités dédiées pour les events token :

```graphql
type WrapEvent @entity {
  id: Bytes!
  user: Bytes!          # adresse qui wrap
  token: Bytes!         # adresse du cToken
  amount: BigInt!       # montant wrappé
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type UnwrapEvent @entity {
  id: Bytes!
  receiver: Bytes!
  token: Bytes!
  cleartextAmount: BigInt!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type ConfidentialTransferEvent @entity {
  id: Bytes!
  from: Bytes!
  to: Bytes!
  token: Bytes!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}
```

Events à indexer dans les mappings :
- `Transfer(from, to, value)` sur les ERC-20 (filtré `to = cTokenAddress` pour les wraps)
- `UnwrapFinalized(receiver, cleartextAmount)` sur les cTokens
- `ConfidentialTransfer(from, to)` sur les cTokens

### 2. Côté frontend (notre app) — migration progressive

**Phase 1 — Immédiat (sans modification subgraph) :**
- Utiliser `HandleRole` pour les delegations (remplace les queries RPC pour les ACL)
- Migrer `use-activity-history.ts` vers React Query (retry, cache, stale data)
- Ajouter un range de blocs borné pour les queries RPC restantes

**Phase 2 — Après extension subgraph :**
- Remplacer tous les `getContractEvents` par des queries GraphQL
- Pagination native via `first` + `skip`
- Polling via React Query `refetchInterval: 10_000`
- Suppression complète de la dépendance RPC pour l'historique

### 3. Pattern de query (référence explorer iExec)

L'explorer iExec utilise un pattern "look-ahead" pour la pagination :

```graphql
{
  events(first: 16, skip: $skip, orderBy: blockTimestamp, orderDirection: desc) { ... }
  hasNext: events(first: 1, skip: $nextSkip) { id }
  hasNextNext: events(first: 1, skip: $nextNextSkip) { id }
}
```

Pas besoin de query `count` séparée — les probes déterminent s'il y a des pages suivantes.

## Problème actuel (rappel)

Le hook `use-activity-history.ts` :
- 4 queries `getContractEvents` avec `fromBlock: 0n` (scanne toute la chaîne)
- Polling toutes les 30s via `setInterval`
- Pas de cache, pas de retry, pas de pagination
- Résultat : flood de requêtes RPC → 429 Too Many Requests sur Tenderly
- Tri cassé (`localeCompare` sur format `DD/MM/YYYY` au lieu de timestamp numérique)
