"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { ZERO_HANDLE } from "@/config/contracts";
import { useHandleClient } from "./useHandleClient";

export type DecryptState =
  | { status: "empty" }
  | { status: "hidden" }
  | { status: "loading" }
  | { status: "ok"; value: bigint }
  | { status: "error"; message: string };

/**
 * Shared plaintext cache with a pub/sub layer. When any hook instance reveals a handle, every
 * other mounted instance pointing at the same handle gets notified and re-reads the cache —
 * otherwise a `RequestCard` would stay "hidden" forever while its sibling `DecryptedAmount`
 * shows the revealed value (each call to the hook owns its own local state).
 */
const valueCache = new Map<string, bigint>();
const listeners = new Set<() => void>();

function setCached(handle: string, value: bigint) {
  valueCache.set(handle, value);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(handle: `0x${string}` | undefined): bigint | undefined {
  if (!handle) return undefined;
  return valueCache.get(handle);
}

/**
 * Click-to-reveal decryption for an `euint256` handle (bytes32). Returns the current state
 * plus a `reveal()` function that triggers the actual SDK `decrypt()` call. Once any instance
 * decrypts a handle, all other instances pointing at the same handle observe the value.
 */
export function useDecryptedHandle(handle: `0x${string}` | undefined) {
  const { handleClient } = useHandleClient();
  const cached = useSyncExternalStore(
    subscribe,
    () => getSnapshot(handle),
    () => undefined,
  );
  const [localState, setLocalState] = useState<DecryptState>({ status: "hidden" });
  // Reset localState when the handle changes (e.g. after a finalize resets the claimable slot
  // and the contract writes a fresh zero handle). Otherwise the previously-revealed value
  // would leak through to the new handle and show stale plaintext under **** / eye.
  const [prevHandle, setPrevHandle] = useState(handle);
  if (prevHandle !== handle) {
    setPrevHandle(handle);
    setLocalState({ status: "hidden" });
  }

  let state: DecryptState;
  if (!handle || handle === ZERO_HANDLE) {
    state = { status: "empty" };
  } else if (cached !== undefined) {
    state = { status: "ok", value: cached };
  } else if (prevHandle !== handle) {
    // First render after a handle change: the setLocalState above is queued. Render "hidden"
    // synchronously this turn so we don't flash the stale localState for one frame.
    state = { status: "hidden" };
  } else {
    state = localState;
  }

  const reveal = useCallback(async () => {
    if (!handle || handle === ZERO_HANDLE) return;
    if (valueCache.has(handle)) return; // already revealed — store subscription will render it
    if (!handleClient) {
      setLocalState({
        status: "error",
        message: "Wallet not ready — reconnect and try again.",
      });
      return;
    }
    setLocalState({ status: "loading" });
    try {
      const result = await handleClient.decrypt(handle);
      const raw = (result as { value?: unknown })?.value ?? result;
      const bigValue = typeof raw === "bigint" ? raw : BigInt(String(raw));
      setCached(handle, bigValue);
      // Local state update is optional — the cache subscription will drive the render — but we
      // set it so callers that only look at local state also see the resolved value.
      setLocalState({ status: "ok", value: bigValue });
    } catch (err) {
      console.error("[decrypt] failed", { handle, err });
      setLocalState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [handle, handleClient]);

  return { state, reveal };
}
