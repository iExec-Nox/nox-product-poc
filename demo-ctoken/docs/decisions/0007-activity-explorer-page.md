# ADR-0007 : Page Activity Explorer

**Date :** 2026-03-01
**Statut :** Accepté

## Contexte

Le dashboard manque d'un historique des transactions. Les utilisateurs ont besoin de visualiser leurs opérations confidentielles (wrap, unwrap, transfer, delegation) avec liens Arbiscan.

## Décision

Créer une page `/explorer` sous le route group `(app)` avec :

- **Header** : titre "Activity" + filtre dropdown par type d'action
- **Table glass** : colonnes Action (icône + label), Asset, Amount, Time, Details (lien Arbiscan)
- **Pagination** : compteur + navigation prev/next
- **Données mock** : 4 entrées représentatives en attendant l'intégration SDK

### Architecture

| Fichier | Rôle |
|---------|------|
| `lib/activity.ts` | Types (`ActivityEntry`, `ActivityType`), config des types (icône, couleur), données mock |
| `components/activity-table.tsx` | Table avec sous-composant `ActivityTableRow` |
| `components/explorer-content.tsx` | Client component principal : header + filtre + table + pagination |
| `app/(app)/explorer/page.tsx` | Page wrapper (même pattern que dashboard) |
| `app/(app)/explorer/loading.tsx` | Skeleton loader |

### Choix techniques

- **Pas de provider** : page en lecture seule, pas de state global nécessaire
- **Filtre local** : `useState` pour le filtre par type, reset de la page à 1 au changement
- **Tokens sémantiques** : aucune couleur hardcodée, compatible light/dark mode
- **Nav link existant** : le `DashboardHeader` pointe déjà vers `/explorer`

## Alternatives rejetées

- **Utiliser shadcn Table** : trop rigide pour le styling glass custom du design Figma
- **Page dédiée par type** : over-engineering, un simple filtre dropdown suffit

## Conséquences

- La route `/explorer` est fonctionnelle avec données mock
- Quand le SDK sera disponible, remplacer `MOCK_ACTIVITIES` par les vrais événements on-chain
