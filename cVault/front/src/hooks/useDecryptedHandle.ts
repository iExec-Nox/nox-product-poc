"use client";

import { useCallback, useState } from "react";
import { ZERO_HANDLE } from "@/config/contracts";
import { useHandleClient } from "./useHandleClient";

export type DecryptState =
  | { status: "empty" }
  | { status: "hidden" }
  | { status: "loading" }
  | { status: "ok"; value: bigint }
  | { status: "error"; message: string };

/**
 * Shared plaintext cache: once a handle is revealed anywhere, all other components showing the
 * same handle render the value directly without another click. Module-scope so it survives
 * component unmounts (cleared on page reload).
 */
const valueCache = new Map<string, bigint>();

function initialState(handle: `0x${string}` | undefined): DecryptState {
  // No handle (loading from chain or account slot uninitialized) → nothing to decrypt: show 0.
  if (!handle || handle === ZERO_HANDLE) return { status: "empty" };
  const cached = valueCache.get(handle);
  if (cached !== undefined) return { status: "ok", value: cached };
  return { status: "hidden" };
}

/**
 * Click-to-reveal decryption for an `euint256` handle (bytes32). Returns the current state
 * plus a `reveal()` function that triggers the actual SDK `decrypt()` call. Matches the
 * demo-ctoken UX pattern: nothing is decrypted until the user explicitly asks, avoiding races
 * and unwanted signature prompts on page load.
 */
export function useDecryptedHandle(handle: `0x${string}` | undefined) {
  const { handleClient } = useHandleClient();
  const [state, setState] = useState<DecryptState>(() => initialState(handle));
  // Track previous handle in state — the react-hooks/refs lint rule forbids `useRef` access in
  // render, and react-hooks/set-state-in-effect forbids the effect pattern. Comparing a
  // stored-state value with the incoming prop during render and calling `setState` only on
  // mismatch is React's official "derived state from props" pattern.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevHandle, setPrevHandle] = useState(handle);
  let currentState = state;
  if (prevHandle !== handle) {
    setPrevHandle(handle);
    currentState = initialState(handle);
    setState(currentState);
  }

  const reveal = useCallback(async () => {
    if (!handle || handle === ZERO_HANDLE) return;
    if (!handleClient) {
      setState({
        status: "error",
        message: "Wallet not ready — reconnect and try again.",
      });
      return;
    }
    // Skip if already cached or in-flight.
    if (valueCache.has(handle)) {
      setState({ status: "ok", value: valueCache.get(handle)! });
      return;
    }
    if (state.status === "loading" || state.status === "ok") return;

    setState({ status: "loading" });
    try {
      const result = await handleClient.decrypt(handle);
      const raw = (result as { value?: unknown })?.value ?? result;
      const bigValue = typeof raw === "bigint" ? raw : BigInt(String(raw));
      valueCache.set(handle, bigValue);
      setState({ status: "ok", value: bigValue });
    } catch (err) {
      console.error("[decrypt] failed", { handle, err });
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [handle, handleClient, state.status]);

  return { state: currentState, reveal };
}
