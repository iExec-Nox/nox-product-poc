# Audit Clean & Accessibilité — 15 mars 2026

**Date :** 2026-03-15
**Statut :** À traiter

## Contexte

Audit complet du codebase réalisé le 15 mars 2026 via le skill `/clean` + `/a11y`. Build et lint passent sans erreur. L'audit couvre : Next.js best practices, React/hooks, code quality, dead code, performance, Web3, design system et accessibilité WCAG 2.1 AA.

## Résumé

- **Build** : ✅ — **Lint** : ✅ — **TypeScript `any`** : ✅ aucun — **`console.log`** : ✅ aucun
- **44 findings** : 5 critiques, 14 majeurs, 9 accessibilité, 16 mineurs

---

## Findings Critiques

### C1. `useUnwrap` ne fait pas `waitForTransactionReceipt` après `finalizeUnwrap`

**Fichier :** `hooks/use-unwrap.ts:76-87`

La UI affiche "confirmed" immédiatement après soumission de la tx, avant qu'elle soit minée. Les balances sont invalidées trop tôt. Comparer avec `useWrap` et `useConfidentialTransfer` qui attendent correctement le receipt.

**Fix :** Ajouter `await publicClient.waitForTransactionReceipt({ hash: finalizeTx })` avant `setStep("confirmed")`.

### C2. `useUnwrap.reset()` ne call pas `resetWriteContract()`

**Fichier :** `hooks/use-unwrap.ts:55-62`

Après une erreur, wagmi reste en état d'erreur stale, potentiellement bloquant le prochain `writeContractAsync`. Les 3 autres hooks transactionnels appellent correctement `resetWriteContract()` dans leur reset.

**Fix :** Ajouter `resetWriteContract()` dans la fonction `reset`.

### C3. `useDecryptBalance.decrypt` avale toutes les erreurs

**Fichier :** `hooks/use-decrypt-balance.ts:28-29`

Le catch est vide, pas d'état `error` exposé. L'utilisateur n'a aucun feedback si le décryptage échoue.

**Fix :** Ajouter un état `error` au hook et l'exposer dans le retour.

### C4. `fromBlock: 0n` scanne toute la chaîne

**Fichier :** `hooks/use-activity-history.ts:94,101,108,115`

Les 4 queries `getContractEvents` utilisent `fromBlock: 0n`, scannant l'intégralité de l'historique Arbitrum Sepolia à chaque chargement + toutes les 30s. Extrêmement lent et rate-limited.

**Fix :** Calculer un `fromBlock` raisonnable (ex : bloc courant - 100 000, soit ~3 jours sur Arbitrum).

### C5. Tri des activités par `localeCompare` sur format `DD/MM/YYYY`

**Fichier :** `hooks/use-activity-history.ts:182-184`

Le tri compare des strings formatées `DD/MM/YYYY, HH:MM` en lexicographique. `31/01/2024` trie après `01/12/2025`. L'ordre chronologique est cassé.

**Fix :** Trier sur le timestamp numérique brut (block timestamp), pas sur la string formatée.

---

## Findings Majeurs

### M1. `publicClient!` non-null assertion

**Fichiers :** `hooks/use-wrap.ts:84,103` / `hooks/use-confidential-transfer.ts:110`

Crash runtime si wallet déconnecté pendant une tx. `useUnwrap` et `useAddViewer` font correctement un guard `if (!publicClient)`.

**Fix :** Ajouter un guard `if (!publicClient) throw` avant utilisation.

### M2. `useCopyToClipboard` : erreur silencieuse + timeout leak

**Fichier :** `hooks/use-copy-to-clipboard.ts:11-13`

`.catch(() => {})` avale les erreurs clipboard. Le `setTimeout` n'est jamais nettoyé au unmount.

**Fix :** Exposer un état erreur. Stocker le timeout dans un ref et le clear au unmount.

### M3. `useTokenPrices` retourne `{}` silencieusement en cas d'erreur

**Fichier :** `hooks/use-token-prices.ts:21-28`

L'UI affiche "$0" pour tous les tokens sans indication d'erreur.

**Fix :** Ajouter un état `error` et l'exposer.

### M4. `estimateGasOverrides` retourne `{}` quand publicClient undefined

**Fichier :** `lib/gas.ts:8`

Masque le problème — la tx part sans gas overrides sur Arbitrum, risque de sous-estimation.

**Fix :** Throw ou guard côté appelant.

### M5. `decryptingSymbol` dans deps de `useCallback`

**Fichier :** `hooks/use-decrypt-balance.ts:34`

Référence instable causant des re-renders en cascade.

**Fix :** Utiliser un `useRef` pour le guard au lieu de mettre `decryptingSymbol` dans les deps.

### M6. Variables CSS font `--font-geist-sans` / `--font-geist-mono` jamais définies

**Fichier :** `app/globals.css:347-348`

`font-sans` et `font-mono` resolvent en fallback browser. Les fonts Geist ne sont pas importées.

**Fix :** Remplacer par `var(--font-mulish)` et une stack monospace explicite, ou importer Geist.

### M7. Shiki importé en bundle complet côté client

**Fichier :** `components/shared/code-section.tsx:5`

~3.8 MB de grammaires chargées côté client alors que seul Solidity/TypeScript est utilisé.

**Fix :** Utiliser `shiki/core` + JS engine + imports ciblés (voir ADR-0015).

### M8. Conflit SEO `robots.ts` vs `layout.tsx`

**Fichier :** `app/robots.ts:8`

`robots.ts` dit `disallow: "/"` mais `layout.tsx` dit `index: true` et un sitemap existe.

**Fix :** Aligner — soit bloquer le crawling partout, soit autoriser.

### M9. Couleurs hardcodées dans `ErrorMessage`

**Fichier :** `components/shared/error-message.tsx:9,11,14,21`

`bg-[#BF3131]/40` et `text-white` au lieu de tokens sémantiques.

**Fix :** Utiliser `bg-decrypt-warning/40` et `text-primary-foreground` ou créer des tokens error dédiés.

### M10. Couleurs hardcodées dans explorer error state

**Fichier :** `components/explorer/explorer-content.tsx:61-65`

`red-500`, `red-400` au lieu de tokens sémantiques.

**Fix :** Utiliser les tokens `tx-error-*`.

### M11. `href="#"` placeholder sur "Contact us"

**Fichiers :** `components/layout/dashboard-header.tsx:68` / `mobile-menu.tsx:103`

Lien non fonctionnel en prod.

**Fix :** Remplacer par le vrai lien ou utiliser `<button>`.

### M12. Metadata title double-suffixe "| Nox | Nox"

**Fichiers :** `app/(app)/dashboard/page.tsx:5` / `app/(app)/activity/page.tsx:5`

Le template `layout.tsx` ajoute déjà `" | Nox"`.

**Fix :** Changer en `title: "Dashboard"` et `title: "Activity"`.

### M13. `DashboardSkeleton` pas responsive

**Fichier :** `components/dashboard/dashboard-skeleton.tsx:8`

Layout horizontal seulement, overflow sur mobile.

**Fix :** Ajouter `flex-col md:flex-row` et padding mobile.

### M14. Tableau `ACTIONS` recréé à chaque render

**Fichier :** `components/dashboard/action-center.tsx:18-43`

Tableau d'objets recréé dans le body du composant, causant des re-renders enfants.

**Fix :** Extraire hors du composant ou mémoiser.

---

## Findings Accessibilité

### A1. `ErrorMessage` sans `role="alert"`

**Fichier :** `components/shared/error-message.tsx:8`

Erreurs dynamiques non annoncées aux screen readers.

**Fix :** Ajouter `role="alert"` au container `<div>`.

### A2. `aria-disabled` au lieu de `disabled` natif

**Fichier :** `components/modals/selective-disclosure-modal.tsx:463,484`

Boutons toujours activables au clavier avec `aria-disabled`.

**Fix :** Utiliser l'attribut `disabled` natif.

### A3. `role="listbox"` avec enfants `<button>` au lieu de `role="option"`

**Fichiers :** `components/modals/wrap-modal.tsx:277` / `transfer-modal.tsx:198`

Sémantique ARIA incorrecte.

**Fix :** Ajouter `role="option"` sur les items ou migrer vers shadcn Select.

### A4. Pas de navigation clavier (Arrow keys) dans les dropdowns

**Fichiers :** `components/modals/wrap-modal.tsx:274-325` / `transfer-modal.tsx:195-237`

Les token selectors n'ont pas de `onKeyDown` pour les flèches.

**Fix :** Implémenter Arrow Up/Down ou migrer vers shadcn Select.

### A5. Inputs sans `<label htmlFor>`

**Fichiers :** `components/modals/wrap-modal.tsx:335` / `transfer-modal.tsx:247,295`

Seulement `aria-label`, pas de `<label>` HTML native.

**Fix :** Ajouter des labels `sr-only`.

### A6. Input viewer address sans `focus-visible` ring

**Fichier :** `components/modals/selective-disclosure-modal.tsx:253`

`outline-none` sans `focus-visible:ring-*`.

**Fix :** Ajouter `focus-visible:ring-2 focus-visible:ring-primary/50`.

### A7. Radio/checkbox custom sans `focus-visible` ring

**Fichier :** `components/modals/selective-disclosure-modal.tsx:284-345,358-399`

Pas de ring de focus visible sur les boutons custom.

**Fix :** Ajouter `focus-visible:ring-2 focus-visible:ring-primary/50`.

### A8. Icône `open_in_new` sans `aria-hidden`

**Fichier :** `components/shared/arbiscan-link.tsx:22`

Screen readers lisent le texte "open_in_new".

**Fix :** Ajouter `aria-hidden="true"`.

### A9. Erreurs inline dans modales sans `role="alert"`

**Fichiers :** `wrap-modal.tsx:344` / `transfer-modal.tsx:268` / `selective-disclosure-modal.tsx:432`

Messages d'erreur dynamiques (ex: "Insufficient balance") non annoncés.

**Fix :** Ajouter `role="alert"` sur les conteneurs d'erreur.

---

## Findings Mineurs

### m1. TODO comment — mock proof à remplacer
**Fichier :** `hooks/use-unwrap.ts:80`

### m2. TODO comment — collision d'adresses
**Fichier :** `lib/contracts.ts:9`

### m3. Timestamp fetching sans batching (N appels RPC parallèles)
**Fichier :** `hooks/use-activity-history.ts:46`

### m4. `NAV_LINKS` dupliqué
**Fichiers :** `dashboard-header.tsx:14` / `mobile-menu.tsx:18`

### m5. Tailles de titre modales inconsistantes (34px vs 36px)
**Fichiers :** `wrap-modal.tsx` / `transfer-modal.tsx` / `selective-disclosure-modal.tsx`

### m6. Border-radius modales inconsistant (32px vs 40px)
**Fichiers :** `wrap-modal.tsx:166` / `transfer-modal.tsx:119`

### m7. Fonts inconsistantes sur éléments similaires (`font-inter` vs `font-mulish`)
**Fichiers :** `transfer-modal.tsx:148` vs `wrap-modal.tsx:219`

### m8. Icône RLC faucet utilise `/faucet-usdc.svg`
**Fichier :** `components/modals/faucet-modal.tsx:27`

### m9. Mock viewers hardcodés affichés en prod
**Fichier :** `selective-disclosure-modal.tsx:50-87`

### m10. `global-error.tsx` manque les font variables et CSS
**Fichier :** `app/global-error.tsx:11`

### m11. Loading components dupliqués en 3 fichiers
**Fichiers :** `app/loading.tsx` / `dashboard/loading.tsx` / `activity/loading.tsx`

### m12. Commentaire stale "file excluded from git"
**Fichier :** `lib/contracts.ts:12`

### m13. `formatBalance` doc dit "4 decimals" mais code fait 6
**Fichier :** `lib/format.ts:13`

### m14. `walletButton.handleCopyAddress` n'utilise pas `useCopyToClipboard`
**Fichier :** `components/shared/wallet-button.tsx:22`

### m15. Footer hardcode l'année 2026
**Fichier :** `components/layout/footer.tsx:33`

### m16. Modales trop longues (WrapModal 474L, SelectiveDisclosure 518L, Transfer 396L)
**Fichiers :** Modales

---

## Ordre de traitement recommandé

| Priorité | Finding | Effort |
|----------|---------|--------|
| 1 | C1 — Missing `waitForTransactionReceipt` unwrap | Faible |
| 2 | C2 — Missing `resetWriteContract` unwrap | Faible |
| 3 | C5 — Tri chronologique cassé | Faible |
| 4 | C4 — `fromBlock: 0n` | Moyen |
| 5 | C3 — Decrypt error silencieux | Faible |
| 6 | M1 — `publicClient!` non-null assertion | Faible |
| 7 | M2 — Clipboard error + timeout leak | Faible |
| 8 | M9/M10 — Couleurs hardcodées | Faible |
| 9 | M12 — Metadata double-suffixe | Faible |
| 10 | M11 — `href="#"` placeholder | Faible |
| 11 | A1/A9 — `role="alert"` erreurs | Faible |
| 12 | A2 — `aria-disabled` → `disabled` | Faible |
| 13 | A8 — `aria-hidden` icône | Faible |
| 14 | A6/A7 — `focus-visible` rings | Faible |
| 15 | M7 — Shiki bundle optimization | Moyen |
| 16 | M6 — Font CSS variables | Faible |
| 17 | A3/A4 — Dropdown a11y (listbox + clavier) | Élevé |
| 18 | M3-M5 — Error states et React deps | Moyen |
| 19 | M8 — Conflit SEO robots/sitemap | Faible |
| 20 | M13/M14 — Skeleton responsive + ACTIONS array | Moyen |
| 21 | m1-m16 — Mineurs | Faible-Moyen |
