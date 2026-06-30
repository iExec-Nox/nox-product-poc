# ADR-0008 : Reduire la largeur du dropdown WalletButton

**Date :** 2026-03-05
**Statut :** Accepte

## Contexte

Le dropdown du composant `WalletButton` (menu avec Copy Address, Account details, Logout) avait une largeur fixe de `200px` (`w-[200px]`), legerement plus large que le bouton trigger. Cela creait un decalage visuel entre le bouton et son menu deroulant.

## Decision

Reduire la largeur fixe du `DropdownMenuContent` de `w-[200px]` a `w-[150px]` pour un meilleur alignement visuel avec le bouton trigger, tout en conservant suffisamment d'espace pour le contenu des items.

**Fichier modifie :** `components/wallet-button.tsx`

## Alternatives envisagees

- **`min-w-[var(--radix-dropdown-menu-trigger-width)]`** : variable CSS Radix pour matcher dynamiquement la largeur du trigger. Testee mais rendait le dropdown trop etroit, coupant "Account details" sur deux lignes.
- **`w-[170px]` / `w-[185px]`** : valeurs intermediaires testees, le rendu a 150px etait le plus equilibre.

## Consequences

- **Positif :** Le dropdown s'aligne mieux visuellement avec le bouton trigger.
- **Negatif / Risques :** Aucun identifie.
