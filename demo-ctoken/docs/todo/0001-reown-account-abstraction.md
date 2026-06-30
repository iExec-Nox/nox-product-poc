# Étude : Account Abstraction via Reown AppKit

**Date :** 2026-03-10
**Statut :** Recherche (non implémenté)

## Contexte

L'équipe envisage d'ajouter l'Account Abstraction (ERC-4337) au projet. Reown AppKit, déjà utilisé pour la connexion wallet, intègre nativement un stack AA complet via Pimlico. Cette ADR documente les possibilités offertes par Reown et les impacts sur notre codebase.

## Ce que Reown AppKit propose

### Features AA intégrées

| Feature | Description |
|---------|-------------|
| **Smart Accounts** | Créés automatiquement pour les users email/social login, powered by Pimlico |
| **Gas Sponsorship** | Paymaster ERC-7677 configurable via le Reown Dashboard |
| **Batch Transactions** | Plusieurs calls atomiques via EIP-5792 `wallet_sendCalls` |
| **Paiement gas en tokens** | Gas payable en USDC au lieu du token natif |
| **EIP-7702** | Support post-Pectra pour upgrader les EOA existants |

### Limitation clé

**Les Smart Accounts sont exclusivement disponibles pour les users embedded wallet** (email et social login). Les users connectés via MetaMask, Rabby ou WalletConnect restent en EOA classique. Il n'est pas possible de désactiver les smart accounts pour les users embedded wallet tout en gardant le login email.

## Configuration AppKit

### Activation (config minimale)

Ajouter dans `createAppKit` dans `providers.tsx` :

```ts
createAppKit({
  // ... config existante inchangée
  adapters: [wagmiAdapter],
  projectId,
  networks: [arbitrumSepolia],
  defaultNetwork: arbitrumSepolia,

  // AJOUTER :
  defaultAccountTypes: { eip155: "smartAccount" },
  features: {
    email: true,
    socials: ["google", "x", "discord", "apple", "github", "farcaster"],
    connectMethodsOrder: ["wallet", "email", "social"],
    emailShowWallets: true,
  },

  // Coinbase Smart Wallet (optionnel)
  enableCoinbase: true,
  coinbasePreference: "smartWalletOnly", // "smartWalletOnly" | "eoaOnly" | "all"

  metadata: { /* existant */ },
});
```

### Comportement de déploiement

- Le smart account est déployé on-chain avec la **première transaction** (pas avant)
- Avant déploiement, une adresse "contrefactuelle" précalculée est affichée
- Le compte peut signer des messages avant déploiement via ERC-6492
- Un frais d'activation est ajouté à la première transaction pour couvrir le déploiement

## Détection EOA vs Smart Account

```ts
import { useAppKitAccount } from "@reown/appkit/react";

const { embeddedWalletInfo } = useAppKitAccount({ namespace: "eip155" });
const isSmartAccount = embeddedWalletInfo?.accountType === "smartAccount";
const isDeployed = embeddedWalletInfo?.isSmartAccountDeployed;
```

`embeddedWalletInfo` n'est défini que pour les users email/social login. Pour les wallets externes (MetaMask, etc.), il est `undefined`.

## Transactions sponsorisées (gasless)

### Setup côté Reown Dashboard

1. Aller sur **dashboard.reown.com**
2. Naviguer vers la section Paymaster
3. Configurer une **policy** (contrats cibles, méthodes, limites de gas, restrictions par chain)
4. Optionnel : cocher "Sponsor Smart Account Deployment"
5. Récupérer l'URL paymaster : `https://paymaster-api.reown.com/{chainId}/rpc?projectId={projectId}`

### Utilisation dans le code

```ts
import { useSendCalls } from "wagmi";
import { encodeFunctionData } from "viem";

const { sendCalls } = useSendCalls({
  mutation: {
    onSuccess: (result) => {
      // NOTE: Pas de txHash ! Utiliser result.id (batchId) pour suivre le statut
      console.log("Batch ID:", result.id);
    },
  },
});

// Envoyer une transaction sponsorisée
sendCalls({
  calls: [
    {
      to: contractAddress,
      data: encodeFunctionData({
        abi: myAbi,
        functionName: "myFunction",
        args: [arg1, arg2],
      }),
    },
  ],
  capabilities: {
    paymasterService: {
      url: `https://paymaster-api.reown.com/421614/rpc?projectId=${projectId}`,
      context: { policyId: "your-policy-id" }, // optionnel
    },
  },
});
```

### Suivi du statut

```ts
import { useCallsStatus } from "wagmi";

const { data: status } = useCallsStatus({ id: batchId });
// status.receipts contient les receipts une fois confirmé
```

## Impact sur notre codebase

### Fichiers à modifier

| Fichier | Changement | Effort |
|---------|------------|--------|
| `components/providers.tsx` | Ajouter `defaultAccountTypes` + `features` dans `createAppKit` | Faible |
| Reown Dashboard | Configurer le paymaster + policies | Faible |
| `hooks/use-wrap.ts` | Dual path : `writeContractAsync` (EOA) vs `useSendCalls` (SA) | Moyen |
| `hooks/use-unwrap.ts` | Idem | Moyen |
| `hooks/use-confidential-transfer.ts` | Idem | Moyen |
| `hooks/use-add-viewer.ts` | Idem | Moyen |
| Progress trackers (modales) | `txHash` (EOA) vs `batchId` + `useCallsStatus` (SA) | Moyen |

### Dual path EOA / Smart Account

Tous les hooks de transaction doivent supporter les deux chemins :

```ts
import { useAppKitAccount } from "@reown/appkit/react";
import { useWriteContract } from "wagmi";
import { useSendCalls } from "wagmi";

function useSmartTransfer() {
  const { embeddedWalletInfo } = useAppKitAccount({ namespace: "eip155" });
  const isSmartAccount = embeddedWalletInfo?.accountType === "smartAccount";

  const { writeContractAsync } = useWriteContract();
  const { sendCalls } = useSendCalls();

  async function transfer(to: Address, amount: bigint) {
    if (isSmartAccount) {
      // Smart account : useSendCalls + encodeFunctionData
      sendCalls({
        calls: [{ to: tokenAddress, data: encodeFunctionData({ abi, functionName: "transfer", args: [to, amount] }) }],
        capabilities: {
          paymasterService: { url: paymasterUrl },
        },
      });
    } else {
      // EOA : writeContractAsync classique
      await writeContractAsync({
        address: tokenAddress,
        abi,
        functionName: "transfer",
        args: [to, amount],
      });
    }
  }
}
```

### Différences clés EOA vs Smart Account

| Aspect | EOA (actuel) | Smart Account (AA) |
|--------|-------------|-------------------|
| Hook de tx | `useWriteContract` / `writeContractAsync` | `useSendCalls` |
| Retour | `txHash` directement | `batchId` (pas de txHash) |
| Suivi | `waitForTransactionReceipt({ hash })` | `useCallsStatus({ id: batchId })` |
| Encodage ABI | Fait par wagmi | Pré-encoder avec `encodeFunctionData` |
| Appels multiples | 1 tx par appel | Batch atomique possible |
| Gas | Payé par l'user | Sponsorisé via paymaster |

### Packages nécessaires

**Aucun nouveau package requis :**
- `useSendCalls` et `useCallsStatus` viennent de `wagmi`
- `useAppKitAccount` vient de `@reown/appkit/react` (déjà installé)
- `encodeFunctionData` vient de `viem` (déjà installé)

## Hooks et composants Reown pour l'AA

| Hook / Composant | Source | Usage |
|-------------------|--------|-------|
| `useAppKitAccount()` | `@reown/appkit/react` | `embeddedWalletInfo.accountType` + `isSmartAccountDeployed` |
| `useSendCalls()` | `wagmi` | Transactions batch + sponsorisées (EIP-5792) |
| `useCallsStatus()` | `wagmi` | Suivi statut des `sendCalls` par `batchId` |
| `useCapabilities()` | `wagmi` (experimental) | Vérifier les capabilities EIP-5792 du wallet |
| `<appkit-button>` | `@reown/appkit/react` | Modal avec email/social login intégré |

## Login social / email

- **Email** : l'user entre son email, reçoit un OTP, vérifie → crée un embedded wallet non-custodial
- **Social** : flux OAuth (Google, X, Discord, etc.) → crée un embedded wallet non-custodial
- Les deux créent un **smart account par défaut**
- **EVM uniquement** (pas de support Solana/Bitcoin)
- **Limitation Safari** : les policies cookies peuvent empêcher la persistance de session

## Décision

Documenter les possibilités pour référence future. **Pas d'implémentation immédiate.** L'intégration sera planifiée quand l'équipe décidera d'ajouter le login social ou les transactions gasless.

## Conséquences

- L'équipe dispose d'une référence complète pour l'intégration AA via Reown
- Aucun changement de code pour l'instant
- Quand l'implémentation sera lancée, les 4 hooks de transaction devront être adaptés avec un dual path EOA/SA
