// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";
import {ERC7984Base} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984Base.sol";
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

import {IConfidentialERC4626} from "../interfaces/IConfidentialERC4626.sol";

/**
 * @dev Confidential ERC-4626 vault. Shares are minted as an {ERC7984} token; the
 * underlying asset is also an {ERC7984} (e.g. a confidential USDC).
 *
 * Why no `previewDeposit` / `previewRedeem`:
 * OZ's clear ERC-4626 returns `assets * totalSupply / totalAssets`. In a confidential vault, an
 * attacker who calls `preview(x1)`, deposits `y`, then calls `preview(x2)` gets two equations in
 * two unknowns (`totalSupply`, `totalAssets`) and solves them trivially. Once those leak, their
 * per-block deltas expose each LP's individual flows.
 *
 * Note on NAV publication: publishing only the *ratio* (NAV) does not enable the same attack.
 * The ratio is a single value per snapshot, and between two snapshots many concurrent deposits
 * / redeems / yield injections perturb both numerator and denominator simultaneously, so the
 * system is under-determined: one equation, many unknowns. That is why `NAV` is safe to disclose
 * publicly while `totalAssets` and `totalSupply` stay confidential.
 *
 * Inflation-attack protection: we port OZ's virtual-shares/virtual-assets trick
 * (`shares = assets * (totalSupply + 10^offset) / (totalAssets + 1)`).
 *
 * Simplifying assumptions for the PoC:
 *  - TODO(prod): slippage protection.
 *  - TODO(prod): NAV disclosure — expose `requestNavDisclosure()`.
 */
contract ConfidentialERC4626 is ERC7984, IConfidentialERC4626 {
    // ============ Storage ============

    IERC7984 private immutable _asset;

    // ============ Errors ============

    error ConfidentialERC4626InvalidAsset(address providedAsset);

    // ============ Constructor ============

    constructor(IERC7984 asset_, string memory name_, string memory symbol_, string memory contractURI_)
        ERC7984(name_, symbol_, contractURI_)
    {
        require(address(asset_) != address(0), ConfidentialERC4626InvalidAsset(address(0)));
        _asset = asset_;
    }

    // ============ External / Public Functions ============

    /// @inheritdoc IConfidentialERC4626
    function deposit(externalEuint256 encryptedAssets, bytes calldata inputProof, address receiver)
        external
        virtual
        override
        returns (euint256 shares)
    {
        // TODO(prod): enforce `maxDeposit(receiver)` cap.
        euint256 assets = Nox.fromExternal(encryptedAssets, inputProof);
        (euint256 assetsBefore, euint256 supplyBefore) = _snapshot();
        shares = _convertToShares(assets, assetsBefore, supplyBefore);
        _deposit(msg.sender, receiver, assets, shares);
    }

    /// @inheritdoc IConfidentialERC4626
    function mint(externalEuint256 encryptedShares, bytes calldata inputProof, address receiver)
        external
        virtual
        override
        returns (euint256 assets)
    {
        // TODO(prod): enforce `maxMint(receiver)` cap.
        euint256 shares = Nox.fromExternal(encryptedShares, inputProof);
        (euint256 assetsBefore, euint256 supplyBefore) = _snapshot();
        assets = _convertToAssets(shares, assetsBefore, supplyBefore);
        _deposit(msg.sender, receiver, assets, shares);
    }

    /// @inheritdoc IConfidentialERC4626
    function withdraw(
        externalEuint256 encryptedAssets,
        bytes calldata inputProof,
        address receiver,
        address owner
    ) external virtual override returns (euint256 shares) {
        // TODO(prod): enforce `maxWithdraw(owner)` cap.
        require(isOperator(owner, msg.sender), ERC7984UnauthorizedSpender(owner, msg.sender));
        euint256 assets = Nox.fromExternal(encryptedAssets, inputProof);
        (euint256 assetsBefore, euint256 supplyBefore) = _snapshot();
        shares = _convertToShares(assets, assetsBefore, supplyBefore);
        _redeem(msg.sender, receiver, owner, assets, shares);
    }

    /// @inheritdoc IConfidentialERC4626
    function redeem(externalEuint256 encryptedShares, bytes calldata inputProof, address receiver, address owner)
        external
        virtual
        override
        returns (euint256 assets)
    {
        // TODO(prod): enforce `maxRedeem(owner)` cap.
        require(isOperator(owner, msg.sender), ERC7984UnauthorizedSpender(owner, msg.sender));
        euint256 shares = Nox.fromExternal(encryptedShares, inputProof);
        (euint256 assetsBefore, euint256 supplyBefore) = _snapshot();
        assets = _convertToAssets(shares, assetsBefore, supplyBefore);
        _redeem(msg.sender, receiver, owner, assets, shares);
    }

    // ============ View Functions ============

    /// @inheritdoc IConfidentialERC4626
    function asset() public view virtual override returns (address) {
        return address(_asset);
    }

    /// @inheritdoc IConfidentialERC4626
    function confidentialTotalAssets() public view virtual override returns (euint256) {
        return _asset.confidentialBalanceOf(address(this));
    }

    /// @inheritdoc ERC7984Base
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IConfidentialERC4626).interfaceId || super.supportsInterface(interfaceId);
    }

    // ============ Internal Functions ============

    /**
     * @dev Deposit/mint common workflow (OZ's `_deposit` analogue). Pulls `assets` via
     * {_transferIn}, mints `shares` to `receiver`, emits.
     *
     * In confidential mode {_transferIn} may clamp, so we scale the pre-computed `shares`
     * proportionally: `actualShares = shares * transferred / assets`. Algebraically equivalent to
     * `_convertToShares(transferred, ...)` but cheaper (one mul + one div instead of a full
     * convert). {Nox.safeDiv} returns 0 if `assets == 0` (a user depositing a zero amount), which
     * prevents a minted-from-nothing path (`div(0,0) = MAX_UINT256` per Nox.div).
     *
     * NOTE: the public entry point returns the pre-clamp values (iso OZ). Under clamp the
     * actual minted shares, emitted in the event and reflected in the receiver's balance, may be
     * lower. Users should verify via {confidentialBalanceOf}.
     */
    function _deposit(address caller, address receiver, euint256 assets, euint256 shares) internal virtual {
        euint256 transferred = _transferIn(caller, assets);
        (, euint256 actualShares) = Nox.safeDiv(Nox.mul(shares, transferred), assets);
        _mint(receiver, actualShares);
        emit ConfidentialDeposit(caller, receiver, transferred, actualShares);
    }

    /**
     * @dev Redeem/withdraw common workflow (OZ's `_withdraw` analogue, renamed for clarity).
     * Burns `shares` from `owner`, sends `assets` to `receiver`, emits.
     *
     * Same proportional-scaling trick as {_deposit}: `actualAssets = assets * burned / shares`.
     * {Nox.safeDiv} guards against `shares == 0`.
     */
    function _redeem(address caller, address receiver, address owner, euint256 assets, euint256 shares)
        internal
        virtual
    {
        euint256 burned = _burn(owner, shares);
        (, euint256 actualAssets) = Nox.safeDiv(Nox.mul(assets, burned), shares);
        euint256 sent = _transferOut(receiver, actualAssets);
        emit ConfidentialRedeem(caller, receiver, owner, sent, burned);
    }

    /**
     * @dev Reads the pre-trade NAV snapshot. Kept as a helper so the four public entry points
     * share a single call site.
     */
    function _snapshot() internal view returns (euint256 assetsBefore, euint256 supplyBefore) {
        assetsBefore = confidentialTotalAssets();
        supplyBefore = confidentialTotalSupply();
    }

    /**
     * @dev Performs a transfer in of underlying assets. Used by {_deposit}.
     *
     * Requires `from` to have (a) called `asset.setOperator(vault, until)` and (b) the handle
     * `amount` to be accessible by this contract (guaranteed right after `Nox.fromExternal`).
     * Returns the encrypted amount actually transferred (may differ from `amount` on confidential
     * clamp).
     */
    function _transferIn(address from, euint256 amount) internal virtual returns (euint256 transferred) {
        // Grant the asset transient ACL access to the handle so its internal Nox ops can use it.
        Nox.allowTransient(amount, address(_asset));
        transferred = _asset.confidentialTransferFrom(from, address(this), amount);
        Nox.allowThis(transferred);
    }

    /**
     * @dev Performs a transfer out of underlying assets. Used by {_redeem}.
     * Returns the encrypted amount actually sent (may differ from `amount` on confidential clamp).
     */
    function _transferOut(address to, euint256 amount) internal virtual returns (euint256 sent) {
        Nox.allowThis(amount);
        Nox.allowTransient(amount, address(_asset));
        sent = _asset.confidentialTransfer(to, amount);
        Nox.allow(sent, to);
    }

    /**
     * @dev Internal conversion function from assets to shares using OZ's virtual-shares/assets
     * formula: `shares = assets * (totalSupply + 10^offset) / (totalAssets + 1)`. Rounding
     * direction is always floor (`Nox.div`); no Ceil variant exists in Nox today, which is fine
     * since confidential mode does not rely on preview-function rounding semantics.
     */
    function _convertToShares(euint256 assets, euint256 totalAssetsBefore, euint256 totalSupplyBefore)
        internal
        virtual
        returns (euint256 shares)
    {
        euint256 numerator = Nox.mul(assets, Nox.add(totalSupplyBefore, Nox.toEuint256(10 ** _decimalsOffset())));
        euint256 denominator = Nox.add(totalAssetsBefore, Nox.toEuint256(1));
        shares = Nox.div(numerator, denominator);
        Nox.allowThis(shares);
    }

    /**
     * @dev Internal conversion function from shares to assets using the symmetric formula:
     * `assets = shares * (totalAssets + 1) / (totalSupply + 10^offset)`. Rounding is floor.
     */
    function _convertToAssets(euint256 shares, euint256 totalAssetsBefore, euint256 totalSupplyBefore)
        internal
        virtual
        returns (euint256 assets)
    {
        euint256 numerator = Nox.mul(shares, Nox.add(totalAssetsBefore, Nox.toEuint256(1)));
        euint256 denominator = Nox.add(totalSupplyBefore, Nox.toEuint256(10 ** _decimalsOffset()));
        assets = Nox.div(numerator, denominator);
        Nox.allowThis(assets);
    }

    /**
     * @dev Virtual-share offset used to thwart the inflation attack (OZ pattern). Override in a
     * child contract to harden protection (e.g. `return 6` for a 6-decimals asset like USDC).
     */
    function _decimalsOffset() internal view virtual returns (uint8) {
        return 0;
    }
}
