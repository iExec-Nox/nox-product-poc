# ADR-0005 : Modale Wrap / Unwrap avec Context React

**Date :** 2026-02-28
**Statut :** Accepté

## Contexte

Les boutons Wrap et Unwrap dans l'Action Center du dashboard sont en placeholder (onClick vide). Il faut une modale permettant à l'utilisateur de convertir ses tokens publics en tokens confidentiels (wrap) et inversement (unwrap).

## Décision

- Créer une modale Wrap/Unwrap (shadcn Dialog + Radix) fidèle au design Figma
- Gérer l'état via un Context React (`WrapModalProvider`) — même pattern que `FaucetModalProvider`
- 2 onglets : Wrap (public → cToken) et Unwrap (cToken → public)
- Sélecteur token dropdown : USDC et RLC (depuis `erc20Tokens` dans `lib/tokens.ts`)
- Affichage du solde réel via `useTokenBalances()` pour indiquer le montant disponible
- Input montant avec validation (pas > solde) + bouton MAX
- Détails transaction : ratio 1:1, gas estimé (~0.0001 ETH)
- CTA désactivé si montant invalide
- Progress tracker statique (Approve → Wrap/Unwrap → Confirmed)
- Section "How it works" + "Function called" (dev mode, code statique)

## Points d'entrée

| Source | Action |
|--------|--------|
| Action Center "Wrap" | Ouvre la modale avec onglet Wrap actif |
| Action Center "Unwrap" | Ouvre la modale avec onglet Unwrap actif |

## Fichiers créés

- `components/wrap-modal-provider.tsx` — Context + hook `useWrapModal()`
- `components/wrap-modal.tsx` — Modale complète

## Fichiers modifiés

- `components/action-center.tsx` — Branchement onClick
- `components/providers.tsx` — Ajout `WrapModalProvider` dans la stack

## Hors scope (à intégrer avec le SDK)

- Transactions réelles (wrap/unwrap on-chain)
- Progression dynamique (Approve → Wrap → Confirmed)
- Approbation ERC-20 (allowance)

## Conséquences

- Les boutons Wrap/Unwrap sont fonctionnels côté UI
- Le formulaire valide les montants contre les soldes réels du wallet
- Le CTA est noop — à brancher sur `lib/nox-sdk.ts` quand le SDK sera disponible
- Le Context permet d'ouvrir la modale depuis n'importe quel composant via `useWrapModal()`
