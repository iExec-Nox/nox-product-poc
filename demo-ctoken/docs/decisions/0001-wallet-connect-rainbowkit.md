# ADR-0001 : Connexion wallet via Reown AppKit avec modale custom

**Date :** 2026-02-26
**Statut :** Accepté (modifié — migration RainbowKit → Reown)

## Contexte

La page d'accueil possède un bouton "Connect Wallet" statique sans fonctionnalité. Il faut implémenter la connexion wallet pour permettre aux utilisateurs d'accéder au dashboard et aux fonctionnalités du protocole Nox. Le design Figma impose une modale custom "Sign in" avec email, passkey, login sociaux et options wallet.

Initialement implémenté avec RainbowKit, la décision a été prise en réunion de migrer vers Reown (ex-WalletConnect AppKit) pour un meilleur alignement avec l'écosystème WalletConnect.

## Décision

- Installer @reown/appkit, @reown/appkit-adapter-wagmi, wagmi v2, viem et @tanstack/react-query
- Configurer WagmiAdapter de Reown avec deux chains : Arbitrum et Arbitrum Sepolia, cookie storage pour SSR
- Créer un composant `Providers` ("use client") wrappant WagmiProvider + QueryClientProvider + createAppKit
- Construire une modale custom `ConnectWalletModal` fidèle au design Figma (icone Nox, titre "Sign in", input email, bouton Continue, options passkey/social/WalletConnect/More Wallets, stepper)
- Les options "Wallet connect" et "More Wallets" ouvrent la modale native Reown AppKit
- Appliquer un blur backdrop (backdrop-filter: blur) derrière la modale
- Modifier le Header pour ouvrir la modale au clic et afficher l'adresse tronquée une fois connecté
- Rediriger vers `/dashboard` après connexion réussie via useEffect sur isConnected
- Créer une page `/dashboard` vide comme placeholder
- Configurer webpack externals (pino-pretty, lokijs, encoding) pour la compatibilité SSR

## Alternatives envisagées

- RainbowKit : implémenté initialement puis abandonné au profit de Reown pour un meilleur alignement avec l'écosystème WalletConnect et les features natives (email, social login, passkey à venir).
- Utiliser wagmi seul sans SDK de connexion : rejeté car Reown simplifie la gestion des wallets, du chain switching et de la modale native.

## Conséquences

- **Positif :** UX de connexion fidèle au design Figma, support multi-chain (Arbitrum + Sepolia), intégration native WalletConnect, SSR compatible avec cookie storage
- **Négatif / Risques :** Les options email, passkey et social login de la modale custom sont visuelles uniquement dans un premier temps (Reown supporte ces features nativement dans sa modale)
