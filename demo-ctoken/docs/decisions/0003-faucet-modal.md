# ADR-0003 : Modale Faucet avec Context React

**Date :** 2026-02-27
**Statut :** Accepté

## Contexte

L'utilisateur sans tokens voit un `EmptyPortfolio` avec un CTA "Go to Faucets" qui naviguait vers `/faucet` (page inexistante). Il faut une modale Faucet accessible depuis plusieurs points d'entrée : empty portfolio, nav menu, topbar.

## Décision

- Créer une modale Faucet (shadcn Dialog + Radix) fidèle au design Figma
- Gérer l'état open/close via un Context React (`FaucetModalProvider`)
- 3 cartes token (ETH, RLC, USDC) avec boutons "Mint" (noop, prêts pour le SDK)
- Remplacer "Settings" par "Faucet" dans le nav menu du dashboard
- Tous les liens vers `/faucet` déclenchent la modale au lieu de naviguer

## Points d'entrée

| Source | Condition |
|--------|-----------|
| `EmptyPortfolio` CTA | Visible uniquement quand `hasAnyBalance === false` |
| Nav menu "Faucet" | Toujours visible |
| Topbar "Get Test Tokens" | Toujours visible |

## Tokens design ajoutés

- `--modal-bg` : light `#ffffff` / dark `#24242b`
- `--modal-border` : light `rgba(0,0,0,0.1)` / dark `rgba(255,255,255,0.1)`

## Conséquences

- Pas de page `/faucet` séparée — tout passe par la modale
- Les boutons Mint sont noop — à brancher sur le SDK faucet ultérieurement
- Le Context permet d'ouvrir la modale depuis n'importe quel composant via `useFaucetModal()`
