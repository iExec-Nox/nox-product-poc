// Explicit ABI fragments for overloaded ConfidentialERC7540 functions.
// The vault exposes several 3-arg/4-arg `requestDeposit` / `requestRedeem` and
// `deposit` / `redeem` variants; we pass the precise fragment to viem so it
// never has to disambiguate by selector itself.

export const requestDepositHandleAbi = [
  {
    type: "function",
    name: "requestDeposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "bytes32" },
      { name: "controller", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const requestRedeemHandleAbi = [
  {
    type: "function",
    name: "requestRedeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "bytes32" },
      { name: "controller", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// 4-arg external overload — takes a user-encrypted amount (externalEuint256 + inputProof) so
// the user can request a *partial* deposit instead of using their full encrypted cUSDC balance.
export const requestDepositExternalAbi = [
  {
    type: "function",
    name: "requestDeposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAssets", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "controller", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// 4-arg external overload for redeem — user-encrypted share amount.
export const requestRedeemExternalAbi = [
  {
    type: "function",
    name: "requestRedeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedShares", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "controller", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// 2-arg async-claim deposit overload (vs the 3-arg sync variant that reverts).
export const depositClaimAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "controller", type: "address" },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const;

// 2-arg async-claim redeem overload (vs the 4-arg sync variant that reverts).
export const redeemClaimAbi = [
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "controller", type: "address" },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const;
