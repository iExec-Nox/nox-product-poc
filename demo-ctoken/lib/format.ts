/**
 * Safe bigint-to-float conversion that avoids Number(bigint) precision loss.
 */
export function toFloat(value: bigint, decimals: number): number {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const remainder = value % divisor;
  // Convert parts separately to stay within safe integer range
  return Number(whole) + Number(remainder) / Number(divisor);
}

/**
 * Format a bigint balance into a human-readable string with up to 4 decimals.
 */
export function formatBalance(value: bigint, decimals: number): string {
  if (value === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const remainder = value % divisor;
  const fractional = remainder.toString().padStart(decimals, "0").slice(0, 6);
  const trimmed = fractional.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

/**
 * Format a number as USD currency string.
 */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
