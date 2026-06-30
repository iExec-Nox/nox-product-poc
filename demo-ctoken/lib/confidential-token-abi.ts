/**
 * ABI for ERC-7984 Confidential Token contracts (cRLC).
 * Extracted from on-chain ERC-7984 selectors (cRLC on Ethereum Sepolia: 0xf961385B39EB765872CF9939dd39702527C8d768).
 *
 * - `wrap` takes a cleartext amount (not a handle) — no encryptInput needed.
 * - `unwrap` + `finalizeUnwrap` is a 2-step process.
 * - `confidentialTransfer` requires a handle + proof from encryptInput().
 * - `confidentialBalanceOf` returns a handle (bytes32), not a value.
 */
export const confidentialTokenAbi = [
  // Metadata
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "underlying",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "pure",
    type: "function",
  },

  // Balance & Supply (return handles, not values)
  {
    inputs: [{ name: "account", type: "address" }],
    name: "confidentialBalanceOf",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "confidentialTotalSupply",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },

  // Wrap: lock ERC-20 + mint cToken (cleartext amount)
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "wrap",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Unwrap step 1: initiate — returns a NEW handle (different from input)
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "unwrap",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Unwrap step 2: finalize (handle must be the one from UnwrapRequested event)
  // Contract computes cleartextAmount internally via Nox.publicDecrypt(unwrapAmount, decryptionProof)
  {
    inputs: [
      { name: "unwrapAmount", type: "bytes32" },
      { name: "decryptionProof", type: "bytes" },
    ],
    name: "finalizeUnwrap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Events: confidential transfer (amount is always an encrypted handle)
  {
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "bytes32", indexed: true },
    ],
    name: "ConfidentialTransfer",
    type: "event",
  },

  // Events: unwrap lifecycle
  {
    inputs: [
      { name: "receiver", type: "address", indexed: true },
      { name: "amount", type: "bytes32", indexed: false },
    ],
    name: "UnwrapRequested",
    type: "event",
  },
  {
    inputs: [
      { name: "receiver", type: "address", indexed: true },
      { name: "encryptedAmount", type: "bytes32", indexed: false },
      { name: "cleartextAmount", type: "uint256", indexed: false },
    ],
    name: "UnwrapFinalized",
    type: "event",
  },

  // Confidential transfer (always with proof)
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "confidentialTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Utility
  {
    inputs: [{ name: "handle", type: "bytes32" }],
    name: "unwrapRequester",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
