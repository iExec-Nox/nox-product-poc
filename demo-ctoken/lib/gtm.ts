declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type GtmEvent =
  | "cdefi_wrap"
  | "cdefi_unwrap"
  | "cdefi_transfer"
  | "cdefi_selectiveDisclosure";

export function pushGtmEvent(event: GtmEvent) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event });
}
