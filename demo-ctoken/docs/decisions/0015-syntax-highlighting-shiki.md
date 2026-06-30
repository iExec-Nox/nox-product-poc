# ADR-0015 : Conserver Shiki pour le syntax highlighting (Dev Mode)

**Date :** 2026-03-15
**Statut :** Accepté

## Contexte

Le composant `<CodeSection>` affiche des snippets Solidity et TypeScript dans les modales (Wrap, Transfer, Selective Disclosure) lorsque le Dev Mode est activé. L'implémentation actuelle utilise **Shiki v4** via `codeToHtml()` avec les thèmes `github-dark` / `github-light`.

La question s'est posée de savoir si **prism-react-renderer** (basé sur PrismJS) serait une meilleure alternative, notamment pour le bundle size et l'intégration React.

## Alternatives évaluées

### Shiki (solution actuelle)

- **Moteur :** TextMate grammars (identiques à VS Code)
- **Bundle :** ~280 kB gzipped (WASM) — réductible à ~50-80 kB avec le JS engine + imports ciblés
- **Perf :** 3.5-5 ms par highlight, asynchrone
- **Solidity :** Support natif, first-class
- **Thèmes :** 40+ thèmes VS Code (github-dark, github-light, etc.)
- **Maintenance :** Très actif (Anthony Fu), écosystème en migration vers Shiki (Astro, Nuxt, VitePress, Docusaurus)
- **React :** Via `dangerouslySetInnerHTML` ou lib community `react-shiki`

### prism-react-renderer

- **Moteur :** PrismJS, tokenizer regex
- **Bundle :** ~12-15 kB gzipped (23x plus léger)
- **Perf :** 0.5-0.7 ms par highlight, synchrone (pas de flash of unstyled code)
- **Solidity :** Non bundlé — nécessite import manuel de `prismjs/components/prism-solidity` + patch global Prism (fragile, mal documenté)
- **Thèmes :** ~12 thèmes custom
- **Maintenance :** PrismJS stagnant depuis 2022, pas de v2 en vue
- **React :** Render props natif (pas de `dangerouslySetInnerHTML`)

## Décision

**Conserver Shiki** pour les raisons suivantes :

1. **Support Solidity natif** — prism-react-renderer ne bundle pas Solidity, nécessitant un workaround fragile. Pour une démo Web3 ciblant des développeurs blockchain, c'est un point bloquant.

2. **Qualité de highlighting** — Shiki produit un rendu identique à VS Code (TextMate grammars). Pour un public développeur (Dev Mode est un différenciateur clé du produit), la précision du highlighting renforce la crédibilité.

3. **Pérennité** — PrismJS est en maintenance mode. L'écosystème frontend (Astro, Nuxt, VitePress, Docusaurus) migre vers Shiki. Investir dans Prism serait aller à contre-courant.

4. **Déjà intégré** — Shiki est fonctionnel dans le projet. Migrer vers prism-react-renderer impliquerait un effort sans gain net, avec une régression sur la qualité Solidity.

## Optimisations à appliquer

Le bundle size actuel (~280 kB) est le principal inconvénient. Deux optimisations réduisent ce coût de ~70% :

### 1. Passer à `shiki/core` + JS engine

Remplacer l'import complet (`import { codeToHtml } from "shiki"`) par un import ciblé :
- `shiki/core` au lieu de `shiki` (pas de WASM Oniguruma)
- JS regex engine (`shiki/engine/javascript`)
- Importer uniquement les grammaires nécessaires (`solidity`, `typescript`)
- Importer uniquement les 2 thèmes utilisés (`github-dark`, `github-light`)

**Résultat :** ~50-80 kB gzipped au lieu de ~280 kB.

### 2. Singleton highlighter

Créer une instance unique de highlighter (via `createHighlighterCore()`) au lieu d'appeler `codeToHtml()` à chaque render, qui recrée une instance à chaque appel.

## Conséquences

- Le composant `<CodeSection>` continue d'utiliser Shiki
- Le bundle highlighting sera réduit de ~70% après application des optimisations
- Pas de régression sur la qualité du highlighting Solidity/TypeScript
- Le flash of unstyled code au premier render (dû à l'async) reste acceptable pour des snippets dans des modales (l'utilisateur ne le perçoit pas car le contenu est court)
