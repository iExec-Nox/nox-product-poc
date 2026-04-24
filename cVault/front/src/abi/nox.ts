// NoxCompute ACL — only `allow(bytes32,address)` is used by the flows.
export const noxComputeAbi = [
  {
    type: "function",
    name: "allow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "handle", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
] as const;
