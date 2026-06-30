# ADR-0018 : Refonte de la modal Faucet avec sections collapsibles

**Date :** 2026-03-25
**Statut :** Accepté

## Contexte

La modal faucet actuelle affiche 3 cartes (ETH, RLC, USDC) en ligne sans hiérarchie. Les utilisateurs ne distinguent pas clairement les deux étapes nécessaires : d'abord obtenir du gas (ETH) pour payer les frais de transaction, puis obtenir des tokens (RLC, USDC) pour interagir avec le protocole. Le nouveau design Figma introduit une restructuration en deux sections numérotées et collapsibles pour guider l'onboarding.

De plus, une nouvelle carte "Bridge to Arbitrum Sepolia" est ajoutée pour faciliter le transfert d'ETH depuis Sepolia vers Arbitrum Sepolia.

## Décision

### Structure de la modal

Deux sections collapsibles indépendantes (ouvertes par défaut, non exclusives) :

1. **GET GAS** — Deux cartes compactes côte à côte :
   - "Ethereum (Gas)" → lien faucet ETH externe
   - "Bridge to Arbitrum Sepolia" → lien bridge Arbitrum existant + subtitle "Takes ~10 minutes"

2. **GET TOKENS** — Deux cartes pleine largeur empilées :
   - "Faucet RLC" → lien faucet RLC externe
   - "Faucet USDC" → lien faucet USDC externe + warning rouge "Tokens will only appear if you select Arbitrum Sepolia Network"

### Composants

- **`FaucetSection`** (nouveau) : section collapsible numérotée utilisant shadcn `Collapsible` (Radix). Badge numéroté + titre uppercase + chevron animé.
- **`FaucetCard`** (modifié) : ajout de variants `compact` / `full`, props optionnelles `subtitle` et `warning`.
- **`FaucetModal`** (refondu) : restructuré avec les deux sections, titre "Faucets" conservé, footer avec limites.

### Dépendance ajoutée

- `@radix-ui/react-collapsible` via shadcn CLI (`npx shadcn@latest add collapsible`).

### URLs réutilisées

Toutes les URLs sont déjà dans `lib/config.ts` : `CONFIG.urls.faucets.eth`, `CONFIG.urls.faucets.rlc`, `CONFIG.urls.faucets.usdc`, `CONFIG.urls.bridge`.

## Alternatives envisagées

| Alternative | Raison du rejet |
|-------------|----------------|
| Accordion exclusif (un seul ouvert) | Le design Figma montre les deux sections ouvertes — l'utilisateur doit voir l'ensemble |
| Sections non-collapsibles | Le collapsible réduit la surcharge visuelle et guide le flow |
| Garder le layout 3 cartes en ligne | Ne distingue pas gas vs tokens, pas de place pour la carte bridge |

## Conséquences

- **Positif :** Onboarding plus clair avec un flow en 2 étapes numérotées, ajout du bridge facilite le transfert d'ETH vers Arbitrum, warning USDC réduit la confusion réseau
- **Négatif / Risques :** Aucun identifié — les URLs et le provider sont inchangés
