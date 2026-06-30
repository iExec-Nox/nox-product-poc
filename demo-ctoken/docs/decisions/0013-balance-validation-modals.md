# ADR-0013 : Validation de balance dans les modales Unwrap et Transfer

**Date :** 2026-03-10
**Statut :** Accepté

## Contexte

Un développeur a signalé qu'il était possible de lancer un unwrap ou un transfer confidentiel même sans balance suffisante. L'analyse a révélé que la validation côté UI dépend de `decryptedAmounts[symbol]` — si l'utilisateur n'a pas décrypté sa balance confidentielle (clic sur l'icône "œil"), la vérification `isOverBalance` est court-circuitée et le bouton reste actif.

**Wrap (public → cToken)** : non affecté — la balance publique est toujours disponible.

## Décision

1. **Désactiver le bouton** Unwrap/Transfer tant que la balance confidentielle n'est pas décryptée ET qu'un montant est saisi
2. **Afficher un message indicatif** ("Decrypt your balance first") quand l'utilisateur a saisi un montant mais n'a pas encore décrypté — explique pourquoi le bouton est grisé
3. Ne pas modifier les hooks de transaction (la validation UI est le bon endroit, le contrat rejette de toute façon les montants invalides)

## Conséquences

- L'utilisateur ne peut plus soumettre une opération sans connaître sa balance réelle
- UX claire : message contextuel uniquement quand pertinent (montant saisi + balance non décryptée)
- 2 fichiers modifiés : `wrap-modal.tsx`, `transfer-modal.tsx`
