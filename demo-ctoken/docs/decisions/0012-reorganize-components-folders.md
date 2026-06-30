# ADR-0012 : Réorganisation des composants par dossiers thématiques

**Date :** 2026-03-08
**Statut :** Accepté

## Contexte

Le dossier `components/` contenait 44 fichiers à plat (hors `ui/`). Avec l'ajout progressif des modales, du dashboard, de l'explorer et des composants partagés, la navigation et la lisibilité du projet devenaient difficiles. Une réorganisation par thème/feature s'imposait.

## Décision

Regrouper les composants en 6 sous-dossiers thématiques :

- **`layout/`** (6 fichiers) — Headers, footer, topbar, mobile-menu, theme-provider
- **`landing/`** (3 fichiers) — hero-section, features-section, feature-card
- **`dashboard/`** (9 fichiers) — dashboard-content, portfolio, assets, action-center, etc.
- **`explorer/`** (2 fichiers) — explorer-content, activity-table
- **`modals/`** (9 fichiers) — Les 4 systèmes provider+modal (faucet, wrap, transfer, selective-disclosure)
- **`shared/`** (11 fichiers) — Composants réutilisés par 2+ features (logo, arbiscan-link, step-indicator, etc.)

Les fichiers `providers.tsx` et `CLAUDE.md` restent à la racine de `components/`. Le dossier `ui/` (shadcn) est inchangé.

Tous les imports dans `app/`, `components/` et `hooks/` sont mis à jour. Aucun changement fonctionnel.

## Alternatives envisagées

- **Sous-dossiers par modale** (ex: `modals/faucet-modal/`) — rejeté car trop granulaire pour le nombre de fichiers actuel (2-3 fichiers par modale).
- **Garder la structure à plat** — rejeté car la navigation dans 44 fichiers devenait pénible.

## Conséquences

- **Positif :** Meilleure lisibilité, navigation plus rapide, regroupement logique par feature, facilite l'onboarding de nouveaux contributeurs.
- **Négatif / Risques :** Tous les imports existants doivent être mis à jour (risque de casse temporaire). La convention "flat structure" dans CLAUDE.md doit être mise à jour.
