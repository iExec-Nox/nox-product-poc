# ADR-0017 : Page Delegated View — visualisation des ACL on-chain

**Date :** 2026-03-16
**Statut :** Accepté

## Contexte

Le protocole Nox permet de déléguer l'accès en lecture (VIEWER) sur un handle de balance confidentiel via `addViewer(handle, viewerAddress)` sur le contrat NoxCompute. Jusqu'ici, l'utilisateur n'avait aucune visibilité sur :

- **Qui lui a partagé un accès** (handles où il est VIEWER)
- **À qui il a donné accès** (handles sur lesquels il a appelé `addViewer`)

L'objectif est de créer une page `/delegated-view` qui expose ces deux perspectives, avec identification du token, statut Active/Outdated, et décryptage on-demand des valeurs.

### Contraintes identifiées

1. **Le subgraph Nox Protocol Indexer** (`HandleRole` entity) ne contient pas de champ `contract` sur l'entité `Handle` — impossible de savoir quel cToken (cRLC, cUSDC) est associé à un handle
2. **Les handles sont éphémères** — chaque transaction (wrap, transfer, unwrap) génère un nouveau handle de balance, rendant les grants précédents caducs
3. **Les valeurs sont chiffrées** — le décryptage nécessite le SDK Nox (`handleClient.decrypt()`) et ne peut se faire que côté client (Web Crypto API)

## Décision

### Approche : events on-chain + lookup balance (sans subgraph direct)

Après évaluation de deux approches (subgraph vs on-chain), nous avons retenu l'approche **on-chain events** pour résoudre le problème du token manquant.

#### Source de données

L'unique event exploité est `ViewerAdded(address indexed sender, address indexed viewer, bytes32 indexed handle)` émis par le contrat **NoxCompute** (`0x5633472D...`). C'est le seul event ACL disponible dans l'ABI.

- **"My grants"** : `ViewerAdded` filtré par `sender = userAddress`
- **"Shared with me"** : `ViewerAdded` filtré par `viewer = userAddress`

#### Résolution du token (handle → cToken)

Pour chaque handle trouvé dans les events, on appelle `confidentialBalanceOf(address)` sur chaque contrat cToken (cRLC, cUSDC). On compare le handle retourné avec celui de l'event :

- **Match** → on identifie le token (symbole + décimales) ET le grant est **Active**
- **Pas de match** → le handle a changé depuis le grant → **Outdated**, token inconnu

C'est cette mécanique qui donne le statut Active/Outdated "gratuitement" sans logique supplémentaire.

#### Décryptage des valeurs

Le hook `useDecryptHandle` appelle `handleClient.decrypt(handle)` qui retourne `{ value: bigint }`. Si le token est identifié (Active), on formate avec `formatUnits(value, decimals)`. Sinon, on affiche la valeur brute.

### Architecture des fichiers

```
lib/delegated-view.ts          # Types (DelegatedViewEntry, TokenInfo), config tabs, export CSV
hooks/use-delegated-view.ts    # React Query — events ViewerAdded + buildHandleTokenMap
hooks/use-decrypt-handle.ts    # Décryptage on-demand avec cache local + formatUnits
components/delegated-view/
  delegated-view-content.tsx   # Conteneur principal (tabs, pagination, états, dev mode)
  delegated-view-table.tsx     # Table desktop + cards mobile
app/(app)/delegated-view/
  page.tsx                     # Route page avec metadata
  loading.tsx                  # Skeleton loading
```

### Colonnes de la table

**"Shared with me" :**

| Token | Shared by | Handle | Value | Date | Details |
|-------|-----------|--------|-------|------|---------|
| cRLC `Active` | 0xab12...cd34 | 0x7bdc...2300 | ****** (decrypt) | 16/03/2026 | Arbiscan |

**"My grants" :**

| Token | Viewer | Handle | Date | Details |
|-------|--------|--------|------|---------|
| cRLC `Active` | 0xef56...7890 | 0x7bdc...2300 | 16/03/2026 | Arbiscan |

Pas de colonne "Value" dans "My grants" — le user est le grantor, pas le viewer.

### Fonctionnalités supplémentaires

- **Export CSV** : bouton dans le header, exporte toutes les entrées de l'onglet actif avec Token, Status, Handle, Value (si décryptée), Date, Tx Hash
- **Dev mode** : InfoCard explicative + CodeSection montrant le code `getContractEvents` / `confidentialBalanceOf` utilisé
- **Auto-refresh** : React Query avec `refetchInterval: 30_000`

## Alternatives envisagées

### 1. Subgraph direct via `graphql-request` (implémentation initiale, abandonnée)

Première approche : query directe du subgraph Nox Protocol Indexer (`HandleRole` entity).

**Avantages :** historique complet, données pré-indexées, pas d'appels RPC multiples.

**Problèmes rencontrés :**
- Le champ `operator` du subgraph retournait des valeurs inattendues (`"Add"` au lieu de `"Mint"`, `"Transfer"`, etc.)
- **Pas de champ `contract` sur l'entité `Handle`** — impossible d'identifier le token (cRLC vs cUSDC)
- Sans le token : pas de symbole, pas de décimales pour formatter les valeurs, pas d'icône, pas de filtre par token
- La valeur décryptée s'affichait en raw BigInt (`9000000` au lieu de `9.0 cUSDC`)

**Verdict :** Abandonné au profit de l'approche on-chain. Le subgraph pourra redevenir pertinent si un champ `contract` est ajouté à l'entité `Handle`.

### 2. SDK `handleClient.viewACL(handle)` (évaluée, reportée)

Le SDK `@iexec-nox/handle` beta.2 expose `viewACL(handle)` qui retourne `{ isPublic, admins[], viewers[] }`.

**Avantages :** donne la liste complète des rôles (ADMIN + VIEWER) par handle.

**Inconvénients :**
- Interroge le subgraph en interne (même limitation `contract` manquant)
- Nécessite un appel par handle (N appels réseau)
- Pour "My grants" : utile seulement si on veut aussi afficher les ADMIN (auto-attribués par le protocole)
- Pour "Shared with me" : nécessite de connaître les handles au préalable (donc toujours besoin des events)

**Verdict :** Reporté. Pourra enrichir la page avec une colonne "Role" (VIEWER/ADMIN) quand le besoin sera confirmé.

## Évolutions futures

### Phase 2 — Avec update subgraph (`contract` field)

Si les développeurs du subgraph ajoutent un champ `contract: Bytes!` sur l'entité `Handle` :

- **Token systématique** : même pour les handles Outdated, on pourra identifier cRLC vs cUSDC
- **Décimales toujours correctes** : plus de valeurs "raw"
- **Filtre par token** : dropdown comme dans l'Activity explorer
- **Icônes token** : afficher `rlc.svg` / `usdc.svg` dans la table
- **Retour possible au subgraph** comme source primaire (plus performant que les events on-chain pour l'historique long)

### Phase 2 — Avec SDK `viewACL`

- **Colonne Role** : afficher VIEWER / ADMIN par entrée
- **Vue par handle** : grouper les accès par handle au lieu d'une liste plate
- **Approche hybride** : events `ViewerAdded` pour la découverte + `viewACL` pour l'enrichissement

### Phase 3 — Fonctionnalités additionnelles

- **Revoke** : bouton pour révoquer un accès VIEWER (nécessite un `removeViewer` côté contrat — pas encore disponible dans l'ABI)
- **Viewer list** : sur le Dashboard, afficher la liste des viewers du handle courant
- **Notifications** : alerter quand un handle change et que les grants deviennent Outdated

## Conséquences

### Positives

- L'utilisateur a une visibilité complète sur ses délégations ACL
- L'identification du token et le statut Active/Outdated fonctionnent sans dépendance au subgraph
- Le décryptage formate correctement les valeurs quand le token est identifié
- L'export CSV permet le reporting pour les audits/compliance
- L'architecture est prête pour évoluer (ajout de Role, filtre par token, etc.)

### Négatives

- Les handles Outdated n'ont pas de token identifié (affiche "Unknown") — résolu en Phase 2 avec le champ `contract` du subgraph
- Pas de colonne Role (VIEWER/ADMIN) — toutes les entrées viennent de `ViewerAdded` donc sont implicitement VIEWER
- `graphql` et `graphql-request` restent dans les dépendances (peer dep de `@iexec-nox/handle` beta.2) même si le code applicatif ne les utilise plus directement
- `fromBlock: 0n` scanne tout l'historique des events — acceptable tant que le volume reste faible, à surveiller en production
