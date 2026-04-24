import type { Hex } from "viem";
import { ZERO_HANDLE } from "@/config/contracts";

export function truncateAddr(addr: string | undefined | null, left = 6, right = 4) {
  if (!addr) return "";
  if (addr.length <= left + right + 2) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

export function truncateHandle(handle: Hex | string | undefined | null) {
  if (!handle) return "—";
  if (handle === ZERO_HANDLE) return "none";
  const s = String(handle);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function isZeroHandle(handle: Hex | string | undefined | null): boolean {
  if (!handle) return true;
  return handle === ZERO_HANDLE;
}

export function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  // crypto.getRandomValues is available in browsers and in modern Node.
  (typeof window !== "undefined" ? window.crypto : crypto).getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as Hex;
}
