# ADR-0006 : Modale Selective Disclosure avec Context React

**Date :** 2026-03-01
**Statut :** Accepté

## Contexte

Le dashboard dispose d'un bouton "Selective Disclosure" dans l'Action Center, mais sans fonctionnalité associée. La selective disclosure (délégation de vue) est un différenciateur majeur du protocole Nox — les concurrents exposent rarement la gestion ACL dans leur UI. Il faut implémenter la modale la plus complexe du projet, permettant de grant/révoquer l'accès à des tiers pour auditer les transactions confidentielles.

## Décision

Implémenter la modale Selective Disclosure en suivant le pattern Provider/Hook établi (WrapModal, TransferModal) :

**Architecture :**
- `selective-disclosure-modal-provider.tsx` — Context React + hook `useSelectiveDisclosureModal()`
- `selective-disclosure-modal.tsx` — Composant principal de la modale

**Structure de la modale :**
1. **Header** : titre "Selective Disclosure" + description
2. **Formulaire "Add a New Viewer"** (glass card) :
   - Input adresse viewer (placeholder `0x...`)
   - Scope radio : "Full Portfolio" (sélectionne tous les tokens) / "Specific Token"
   - Liste de tokens avec checkboxes (depuis `confidentialTokens`)
   - Info box "How it works"
   - Bouton CTA "Grant Access"
3. **Code Viewer** (visible en dev mode) : snippet `walletClient.writeContract(...)` statique
4. **Current Viewers (3)** : cartes mockées avec adresse, badge scope, date
5. **Past Viewers (3)** : cartes mockées
6. **Security Note** : banner d'avertissement en bas

**Comportement du scope :**
- "Full Portfolio" coche automatiquement tous les tokens de la liste
- "Specific Token" permet la sélection individuelle

**Intégration :**
- Provider enregistré dans `providers.tsx`
- Bouton "Selective Disclosure" de `action-center.tsx` connecté via `openSelectiveDisclosure()`

Les sections Current Viewers et Past Viewers sont statiques (mockées) — elles seront rendues interactives ultérieurement.

## Alternatives envisagées

Pas d'alternative discutée. Le pattern Provider/Hook est établi et cohérent avec les modales existantes.

## Conséquences

- **Positif :** Expose la fonctionnalité ACL unique de Nox dans l'UI, complète l'Action Center du dashboard, cohérent avec l'architecture modale existante
- **Négatif / Risques :** Modale la plus complexe du projet avec beaucoup de sections — nécessitera un travail de polish pour le responsive. Les viewers sont mockés en attendant l'intégration SDK.
