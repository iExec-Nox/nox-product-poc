import { CONTRACTS } from "./contracts";

/**
 * ABI fragments for the NoxCompute contract (proxy at NOX_COMPUTE_ADDRESS).
 * Selectors confirmed on-chain against the implementation bytecode.
 *
 * - `addViewer(bytes32, address)` — selector 0x10ff39ca
 * - `isViewer(bytes32, address)` — selector 0x02d0e66e
 */

export const NOX_COMPUTE_ADDRESS = CONTRACTS.NOX_COMPUTE;

export const noxComputeAbi = [
  {
    inputs: [
      { name: "handle", type: "bytes32" },
      { name: "viewer", type: "address" },
    ],
    name: "addViewer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "handle", type: "bytes32" },
      { name: "viewer", type: "address" },
    ],
    name: "isViewer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "viewer", type: "address", indexed: true },
      { name: "handle", type: "bytes32", indexed: true },
    ],
    name: "ViewerAdded",
    type: "event",
  },
] as const;
