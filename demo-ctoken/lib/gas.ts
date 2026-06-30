import {
  createPublicClient,
  http,
  type Abi,
  type EstimateContractGasParameters,
} from "viem";
import { sepolia } from "viem/chains";
import { RPC_URL } from "@/lib/config";

/**
 * Dedicated read client pinned to our configured RPC.
 *
 * The wagmi/Reown public client wraps our RPC in `fallback([ourRPC,
 * rpc.walletconnect.org])`. A gas estimation that fails on our RPC falls
 * through to the WalletConnect RPC, which rejects inflated estimates with
 * "RPC submit: gas limit too high". Estimating on a dedicated single-RPC client
 * avoids that fallback entirely.
 */
const gasClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

/**
 * Per-operation gas ceilings.
 *
 * Confidential ops (unwrap/transfer) schedule a NoxCompute TEE job; viem's
 * `eth_estimateGas` can balloon on that path and the inflated limit gets
 * rejected ("gas limit too high"). We cap the limit so we never submit an
 * absurd value, while staying well above real usage (~300k) and far below the
 * Sepolia block limit (60M). The cap is also the fallback when estimation
 * throws (e.g. the TEE path can't be simulated locally).
 */
export const GAS_LIMITS = {
  approve: 150_000n,
  wrap: 1_000_000n,
  unwrap: 3_000_000n,
  finalizeUnwrap: 3_000_000n,
  transfer: 2_000_000n,
  addViewer: 1_000_000n,
} as const;

export type GasOp = keyof typeof GAS_LIMITS;

interface ContractCall {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  account: `0x${string}`;
  value?: bigint;
}

const GAS_BUFFER_NUM = 130n; // +30%
const FEE_BUFFER_NUM = 120n; // +20%

/**
 * Build gas + EIP-1559 fee overrides for a write call.
 *
 * - Gas limit: `estimate × 1.3`, capped at `GAS_LIMITS[op]`. If estimation
 *   reverts/throws, fall back to the cap so the tx is still submittable with a
 *   sane limit — and so viem skips its own (ballooning) estimate.
 * - Fees: current EIP-1559 fees × 1.2 (the public RPC under-reports on Sepolia).
 *
 * Estimation runs on the dedicated single-RPC client (see `gasClient`).
 */
export async function buildTxOverrides(op: GasOp, call: ContractCall) {
  const cap: bigint = GAS_LIMITS[op];

  let gas: bigint = cap;
  try {
    const estimate = await gasClient.estimateContractGas({
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
      account: call.account,
      ...(call.value !== undefined ? { value: call.value } : {}),
    } as unknown as EstimateContractGasParameters);
    const buffered = (estimate * GAS_BUFFER_NUM) / 100n;
    gas = buffered < cap ? buffered : cap;
    // TODO(debug): remove once gas handling is validated
    console.log(
      `[nox:gas] ${op} estimate=${estimate} buffered=${buffered} cap=${cap} -> gas=${gas}`,
      { address: call.address, fn: call.functionName },
    );
  } catch (e) {
    // Estimation failed (e.g. the TEE-dependent path can't be simulated) —
    // submit with the capped limit rather than letting the wallet/RPC balloon.
    gas = cap;
    // TODO(debug): remove once gas handling is validated
    console.warn(
      `[nox:gas] ${op} estimateContractGas FAILED -> using cap=${cap}`,
      { address: call.address, fn: call.functionName, error: e },
    );
  }

  const fees = await gasClient.estimateFeesPerGas();
  const overrides = {
    gas,
    maxFeePerGas: (fees.maxFeePerGas * FEE_BUFFER_NUM) / 100n,
    maxPriorityFeePerGas: (fees.maxPriorityFeePerGas * FEE_BUFFER_NUM) / 100n,
  };
  // TODO(debug): remove once gas handling is validated
  console.log(`[nox:gas] ${op} overrides`, {
    gas: overrides.gas.toString(),
    maxFeePerGas: overrides.maxFeePerGas.toString(),
    maxPriorityFeePerGas: overrides.maxPriorityFeePerGas.toString(),
  });
  return overrides;
}
