/**
 * Root route — always renders the landing page (W1). The CTA inside handles both states:
 *  - disconnected → opens RainbowKit's connect modal
 *  - connected    → link to /portfolio
 */
export { default } from "./landing/page";
