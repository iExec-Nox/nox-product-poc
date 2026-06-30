# ADR-0016 : Bloquer la fermeture des modales pendant une transaction

**Date :** 2026-03-14
**Statut :** Accepté

## Contexte

Lors d'un unwrap, le flow est en 2 étapes on-chain (unwrap → finalizeUnwrap). Si l'utilisateur ferme la modale entre les deux, le cToken est brûlé mais le token cleartext n'est pas crédité. Le `reset()` à la réouverture efface les paramètres de finalize, rendant le retry impossible depuis la UI.

Ce problème s'applique potentiellement à toutes les modales de transaction (wrap, transfer, selective disclosure) même si l'unwrap est le cas le plus critique.

## Décision

Empêcher la fermeture des modales quand une transaction est en cours (`isProcessing = true`).

### Modales concernées

- `wrap-modal.tsx` (Wrap & Unwrap)
- `transfer-modal.tsx` (Confidential Transfer)
- `selective-disclosure-modal.tsx` (Selective Disclosure / ACL)

### Points de fermeture bloqués

| Point de fermeture | Mécanisme |
|---|---|
| `onOpenChange` sur `<Dialog>` | Guard : ignorer `false` si `isProcessing` |
| Bouton close (X) | `disabled` quand `isProcessing` |
| Bouton "Cancel" | `disabled` quand `isProcessing` |
| Escape + clic overlay | `onEscapeKeyDown` + `onInteractOutside` → `e.preventDefault()` |

### Définition de `isProcessing`

Le step n'est ni `idle`, ni `confirmed`, ni `error`. Autrement dit, une opération blockchain est en cours d'exécution.

## Alternatives envisagées

1. **Persister les params dans localStorage** — Plus robuste (couvre le cas navigateur fermé) mais plus complexe. Pourra être ajouté ultérieurement.
2. **Les deux** (bloquer + persister) — Idéal mais over-engineering pour l'instant.

## Conséquences

- L'utilisateur ne peut plus perdre de fonds en fermant accidentellement une modale
- UX légèrement contraignante mais justifiée par la sécurité
- Si le navigateur crash ou est fermé, le problème persiste → à traiter dans une itération future (localStorage)
