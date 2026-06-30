import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTransactionError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Transaction failed";

  const isUserRejection =
    message.includes("User rejected") ||
    message.includes("user rejected") ||
    message.includes("denied");

  return isUserRejection
    ? "Transaction rejected by user"
    : message.length > 200
      ? message.slice(0, 200) + "..."
      : message;
}
