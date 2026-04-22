// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    euint256,
    externalEuint256
} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/**
 * @dev Confidential adaptation of ERC-4626 (tokenized vault). Amounts (assets and shares) are
 * encrypted, while metadata (`asset`, decimals, etc.) is public. Ratios (NAV) can be exposed
 * via an opt-in public decryption flow, but `totalAssets` and `totalSupply` stay private.
 *
 * Inspired by OpenZeppelin's `ERC4626`:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/extensions/ERC4626.sol
 *
 * NOTE on `mint` and `withdraw` in confidential mode: in clear ERC-4626 these entry points
 * guarantee an exact shares/assets amount (they revert otherwise). In the confidential version
 * we cannot revert on encrypted comparisons, so if the `_transferIn` or `_burn` clamps to a
 * smaller amount, the effective minted/burned value will be proportionally smaller. They are
 * kept for API symmetry with OZ; `deposit`/`redeem` remain the recommended entry points.
 */
interface IConfidentialERC4626 {
    // ============ Events ============

    event ConfidentialDeposit(
        address indexed sender,
        address indexed owner,
        euint256 indexed assets,
        euint256 shares
    );

    event ConfidentialRedeem(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        euint256 assets,
        euint256 shares
    );

    // ============ Metadata ============

    /**
     * @dev Address of the underlying confidential token (cERC-7984) used as asset.
     */
    function asset() external view returns (address);

    /**
     * @dev Total amount of the underlying asset held by the vault (encrypted).
     */
    function confidentialTotalAssets() external view returns (euint256);

    // ============ Entry points ============

    /**
     * @dev Deposits `assets` underlying tokens and credits the corresponding vault shares to
     * `receiver`. The returned `shares` is the pre-trade projection (analogue of OZ's
     * `previewDeposit`); under confidential clamp the actually-minted amount (visible in the
     * emitted {ConfidentialDeposit} event and in `confidentialBalanceOf(receiver)`) may be lower.
     *
     * Prerequisites:
     *  - `msg.sender` MUST have set this vault as operator on the underlying asset
     *    (via `asset.setOperator(vault, until)`).
     *
     * MUST emit the {ConfidentialDeposit} event.
     */
    function deposit(
        externalEuint256 encryptedAssets,
        bytes calldata inputProof,
        address receiver
    ) external returns (euint256 shares);

    /**
     * @dev Mints `shares` vault shares to `receiver` in exchange for the required amount of
     * underlying assets. The returned `assets` is the pre-trade projection (analogue of OZ's
     * `previewMint`); under clamp the effective minted shares and pulled assets may be lower.
     *
     * Prerequisites: same as {deposit}.
     *
     * MUST emit the {ConfidentialDeposit} event.
     */
    function mint(
        externalEuint256 encryptedShares,
        bytes calldata inputProof,
        address receiver
    ) external returns (euint256 assets);

    /**
     * @dev Burns shares from `owner` to send the requested amount of underlying `assets` to
     * `receiver`. The returned `shares` is the pre-trade projection (analogue of OZ's
     * `previewWithdraw`); under clamp the effective burned shares may be lower.
     *
     * Prerequisites:
     *  - If `owner != msg.sender`, `msg.sender` MUST be an operator of `owner` on this vault.
     *
     * MUST emit the {ConfidentialRedeem} event.
     */
    function withdraw(
        externalEuint256 encryptedAssets,
        bytes calldata inputProof,
        address receiver,
        address owner
    ) external returns (euint256 shares);

    /**
     * @dev Burns `shares` from `owner` and sends the proportional amount of `assets` to
     * `receiver`. The returned `assets` is the pre-trade projection (analogue of OZ's
     * `previewRedeem`); under clamp the effective sent amount may be lower.
     *
     * Prerequisites:
     *  - If `owner != msg.sender`, `msg.sender` MUST be an operator of `owner` on this vault.
     *
     * MUST emit the {ConfidentialRedeem} event.
     */
    function redeem(
        externalEuint256 encryptedShares,
        bytes calldata inputProof,
        address receiver,
        address owner
    ) external returns (euint256 assets);
}
