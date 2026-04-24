"use client";

import { formatUnits } from "viem";
import { useDecryptedHandle } from "@/hooks/useDecryptedHandle";
import { MI } from "./ui";

type Props = {
  /** Encrypted `euint256` handle (bytes32). */
  handle: `0x${string}` | undefined;
  /** Decimals of the underlying token — used to format the plaintext value. */
  decimals?: number;
  /** Optional suffix (e.g. "cUSDC", "shares"). */
  suffix?: string;
};

/**
 * Click-to-reveal display for an encrypted handle.
 *
 *   `hidden`  →  ****** + eye button  (user must click to trigger a signing prompt)
 *   `loading` →  spinner
 *   `ok`      →  formatted plaintext
 *   `empty`   →  `0` (no handle / `bytes32(0)` = uninitialized mapping slot → nothing to decrypt)
 *   `error`   →  hint text on hover
 *
 * Reveals are cached globally (same handle across pages displays directly after the first
 * reveal). One SDK session signature is reused for every subsequent decrypt on the same
 * session.
 */
export function DecryptedAmount({ handle, decimals = 6, suffix }: Props) {
  const { state, reveal } = useDecryptedHandle(handle);

  if (state.status === "empty")
    return <span style={{ opacity: 0.65 }}>0{suffix ? ` ${suffix}` : ""}</span>;

  if (state.status === "loading") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, opacity: 0.75 }}>
        <MI name="sync" size={14} color="var(--ct-fg-3)" style={{ animation: "ct-spin 1s linear infinite" }} />
        <span>decrypting…</span>
      </span>
    );
  }

  if (state.status === "ok") {
    return (
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatUnits(state.value, decimals)}
        {suffix ? ` ${suffix}` : ""}
      </span>
    );
  }

  if (state.status === "error") {
    return (
      <span
        style={{
          opacity: 0.6,
          color: "var(--ct-warn, #e57373)",
          cursor: "help",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
        title={state.message}
      >
        <MI name="error_outline" size={14} color="var(--ct-warn, #e57373)" />
        decrypt failed
      </span>
    );
  }

  // hidden (default) → show eye button
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        reveal();
      }}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        color: "inherit",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        font: "inherit",
      }}
      aria-label="Reveal amount"
    >
      <span style={{ letterSpacing: 1.5 }}>
        ******{suffix ? ` ${suffix}` : ""}
      </span>
      <MI name="visibility" size={14} color="var(--ct-brand)" />
    </button>
  );
}
