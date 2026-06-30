# ADR-0002 : Header Portfolio Overview pour le Dashboard

**Date :** 2026-02-27
**Statut :** Accepté

## Contexte

La page dashboard (`/dashboard`) contient uniquement un placeholder. Le design Figma définit un header avec le titre "Portfolio Overview", une icône info, et une card glassmorphism affichant la valeur totale du portefeuille.

## Décision

Créer un composant `PortfolioHeader` dans `components/portfolio-header.tsx` :
- Titre "Portfolio Overview" en Mulish Bold 30px
- Icône Material Icons `info` en slate-500
- Card glass à droite avec "Total Value" et montant dynamique
- Prop `totalValue` pour la valeur affichée (défaut "$0.00")

Intégrer dans `app/dashboard/page.tsx` en remplaçant le placeholder actuel.

## Conséquences

- Le dashboard commence à prendre forme avec un vrai composant Figma-faithful
- Le composant est prêt à recevoir une vraie valeur calculée depuis les balances on-chain
