// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {
    Nox,
    ebool,
    euint256,
    externalEuint256
} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

import {ConfidentialERC4626} from "./ConfidentialERC4626.sol";
import {IConfidentialERC7540} from "../interfaces/IConfidentialERC7540.sol";

/**
 * @dev Confidential adaptation of EIP-7540 (asynchronous tokenized vault).
 *
 * Lifecycle (iso EIP-7540):
 *   1. {requestDeposit}: assets are pulled into the vault, `pendingDepositAssets` grows.
 *   2. {approveDeposit}: moves the approved amount from `pendingDepositAssets` to
 *      `claimableDepositAssets`. No conversion, no mint.
 *   3. `deposit(receiver, controller)` (async claim): converts `claimableDepositAssets` →
 *      shares at the live NAV and mints the shares to `receiver`.
 *
 * Redeem lifecycle is symmetric, tracked in shares instead of assets:
 *   1. {requestRedeem}: shares are escrowed into the vault, `pendingRedeemShares` grows.
 *   2. {approveRedeem}: moves shares from `pendingRedeemShares` to `claimableRedeemShares`.
 *   3. `redeem(receiver, controller)` (async claim): converts `claimableRedeemShares` → assets
 *      at the live NAV, burns the escrowed shares and transfers the assets to `receiver`.
 *
 * NOTE on NAV timing: the conversion rate is the NAV *at claim time*, not at approve time. The
 * owner's approval is a gating permission ("yes, you may claim"), not a price-lock. A production
 * vault that wants strict fair-pricing should snapshot the NAV at approval and store it
 * per-request.
 *
 * The vault owner is the only account that can observe aggregated pending / claimable amounts
 * (because encrypted handle ACL is granted to the vault itself and to `owner()`). Individual
 * users cannot observe each other.
 *
 * TODO(prod):
 *  - Multi-request support. Currently each controller has a single "bucket" per flow; submitting
 *    a second request before approval simply accumulates in the same bucket. EIP-7540 allows
 *    multiple concurrent requests via `requestId`.
 *  - Partial claim. Users can only claim the full claimable balance; EIP-7540 allows partial.
 *  - Cancel / reject flow (refunds of pending assets/shares if the owner declines the request).
 *  - NAV snapshotting. The NAV used for approval is the live NAV; a production vault would
 *    snapshot it at request time or use a price oracle.
 */
contract ConfidentialERC7540 is ConfidentialERC4626, IConfidentialERC7540, Ownable {
    // ============ Storage ============

    uint256 internal constant REQUEST_ID = 0;

    /**
     * @dev Per EIP-7540, deposit flow is tracked in assets (input unit) and redeem flow in
     * shares. Conversion happens only at claim time, against the live NAV.
     */
    mapping(address controller => euint256) private _pendingDepositAssets;
    mapping(address controller => euint256) private _claimableDepositAssets;
    mapping(address controller => euint256) private _pendingRedeemShares;
    mapping(address controller => euint256) private _claimableRedeemShares;

    /**
     * @dev Running sum of assets sitting in the vault but not yet converted to shares —
     * `pending + claimable` across every controller. Subtracted from `confidentialTotalAssets()`
     * at claim time to recover the productive NAV denominator under concurrent requests.
     *
     * Invariant: `asset.confidentialBalanceOf(vault) - _totalInflightDepositAssets` equals the
     * productive capital (shares have been minted against it).
     */
    euint256 private _totalInflightDepositAssets;

    // ============ Errors ============

    error ConfidentialERC7540ZeroAddress();

    // ============ Constructor ============

    constructor(
        IERC7984 asset_,
        string memory name_,
        string memory symbol_,
        string memory contractURI_,
        address initialOwner_
    ) ConfidentialERC4626(asset_, name_, symbol_, contractURI_) Ownable(initialOwner_) {
        // Seed the inflight counter so the first `requestDeposit` can add to a known handle.
        euint256 zero = Nox.toEuint256(0);
        _totalInflightDepositAssets = zero;
        Nox.allowThis(zero);
        Nox.allow(zero, initialOwner_);
    }

    // ============ Disable sync entry points ============

    /**
     * @dev Per EIP-7540, sync entry points MUST revert on async-only vaults. Users must go
     * through the `request*` / `approve*` / `claim*` flow instead.
     */
    function deposit(
        externalEuint256 /* encryptedAssets */,
        bytes calldata /* inputProof */,
        address /* receiver */
    ) external pure override returns (euint256) {
        revert("ConfidentialERC7540: sync deposit/mint disabled; use requestDeposit + deposit(receiver, controller)");
    }

    function mint(
        externalEuint256 /* encryptedShares */,
        bytes calldata /* inputProof */,
        address /* receiver */
    ) external pure override returns (euint256) {
        revert("ConfidentialERC7540: sync deposit/mint disabled; use requestDeposit + deposit(receiver, controller)");
    }

    function withdraw(
        externalEuint256 /* encryptedAssets */,
        bytes calldata /* inputProof */,
        address /* receiver */,
        address /* owner */
    ) external pure override returns (euint256) {
        revert("ConfidentialERC7540: sync withdraw/redeem disabled; use requestRedeem + redeem(receiver, controller)");
    }

    function redeem(
        externalEuint256 /* encryptedShares */,
        bytes calldata /* inputProof */,
        address /* receiver */,
        address /* owner */
    ) external pure override returns (euint256) {
        revert("ConfidentialERC7540: sync withdraw/redeem disabled; use requestRedeem + redeem(receiver, controller)");
    }

    // ============ Request Phase ============

    /// @inheritdoc IConfidentialERC7540
    function requestDeposit(
        externalEuint256 encryptedAssets,
        bytes calldata inputProof,
        address controller,
        address owner_
    ) external override returns (uint256) {
        return _requestDeposit(Nox.fromExternal(encryptedAssets, inputProof), controller, owner_);
    }

    /// @inheritdoc IConfidentialERC7540
    function requestDeposit(
        euint256 assets,
        address controller,
        address owner_
    ) external override returns (uint256) {
        require(
            Nox.isAllowed(assets, msg.sender),
            ERC7984UnauthorizedUseOfEncryptedAmount(assets, msg.sender)
        );
        return _requestDeposit(assets, controller, owner_);
    }

    /// @inheritdoc IConfidentialERC7540
    function requestRedeem(
        externalEuint256 encryptedShares,
        bytes calldata inputProof,
        address controller,
        address owner_
    ) external override returns (uint256) {
        return _requestRedeem(Nox.fromExternal(encryptedShares, inputProof), controller, owner_);
    }

    /// @inheritdoc IConfidentialERC7540
    function requestRedeem(
        euint256 shares,
        address controller,
        address owner_
    ) external override returns (uint256) {
        require(
            Nox.isAllowed(shares, msg.sender),
            ERC7984UnauthorizedUseOfEncryptedAmount(shares, msg.sender)
        );
        return _requestRedeem(shares, controller, owner_);
    }

    function _requestDeposit(
        euint256 assets,
        address controller,
        address owner_
    ) internal returns (uint256) {
        // `controller` is only used as a mapping key + Nox ACL target → check here to avoid
        // locking funds in an unreachable bucket. Zero `owner_` is rejected downstream by
        // {ERC7984Base}'s `confidentialTransferFrom` inside `_transferIn`.
        require(controller != address(0), ConfidentialERC7540ZeroAddress());
        require(isOperator(owner_, msg.sender), ERC7984UnauthorizedSpender(owner_, msg.sender));

        euint256 transferred = _transferIn(owner_, assets);

        euint256 newPending = Nox.add(_pendingDepositAssets[controller], transferred);
        _pendingDepositAssets[controller] = newPending;
        Nox.allowThis(newPending);
        Nox.allow(newPending, owner()); // vault admin can observe
        Nox.allow(newPending, controller); // and the controller

        // Mirror the transfer in the global inflight counter: these assets are in the vault but
        // no shares are minted against them yet, so they must not inflate the productive NAV.
        euint256 newInflight = Nox.add(_totalInflightDepositAssets, transferred);
        _totalInflightDepositAssets = newInflight;
        Nox.allowThis(newInflight);
        Nox.allow(newInflight, owner());

        emit DepositRequest(controller, owner_, REQUEST_ID, msg.sender, transferred);
        return REQUEST_ID;
    }

    function _requestRedeem(
        euint256 shares,
        address controller,
        address owner_
    ) internal returns (uint256) {
        // Same reasoning as {_requestDeposit}: keep the `controller` check, rely on ERC7984 for
        // `owner_`.
        require(controller != address(0), ConfidentialERC7540ZeroAddress());
        require(isOperator(owner_, msg.sender), ERC7984UnauthorizedSpender(owner_, msg.sender));

        // Escrow the shares: move them from owner_ to this vault.
        Nox.allowThis(shares);
        euint256 transferred = _transfer(owner_, address(this), shares);
        Nox.allowThis(transferred);

        euint256 newPending = Nox.add(_pendingRedeemShares[controller], transferred);
        _pendingRedeemShares[controller] = newPending;
        Nox.allowThis(newPending);
        Nox.allow(newPending, owner());
        Nox.allow(newPending, controller);

        emit RedeemRequest(controller, owner_, REQUEST_ID, msg.sender, transferred);
        return REQUEST_ID;
    }

    // ============ Approve Phase (onlyOwner) ============

    /**
     * @dev Moves `assets` from `owner_`'s pending deposit bucket to their claimable deposit
     * bucket. No conversion, no mint — shares are only created at claim time (async `deposit`).
     *
     * Uses {Nox.safeSub} so that an approval larger than the current pending bucket is a no-op
     * (pending stays unchanged, 0 is credited to claimable) instead of underflowing the bucket.
     * {Nox.select} threads the success flag through the state updates. The vault always has ACL
     * on `_pendingDepositAssets[owner_]` via `Nox.allowThis` done in `_requestDeposit`; the
     * admin is trusted (via `onlyOwner`) to pass a legitimate handle, typically read fresh from
     * `pendingDepositRequest(owner_)`.
     */
    /// @inheritdoc IConfidentialERC7540
    function approveDeposit(euint256 assets, address owner_) external override onlyOwner {
        require(owner_ != address(0), ConfidentialERC7540ZeroAddress());
        Nox.allowThis(assets);

        (ebool success, euint256 newPending) = Nox.safeSub(
            _pendingDepositAssets[owner_],
            assets
        );
        newPending = Nox.select(success, newPending, _pendingDepositAssets[owner_]);
        _pendingDepositAssets[owner_] = newPending;
        Nox.allowThis(newPending);
        Nox.allow(newPending, owner());
        Nox.allow(newPending, owner_);

        // Only credit the claimable bucket with what actually came out of pending.
        euint256 approved = Nox.select(success, assets, Nox.toEuint256(0));
        euint256 newClaimable = Nox.add(_claimableDepositAssets[owner_], approved);
        _claimableDepositAssets[owner_] = newClaimable;
        Nox.allowThis(newClaimable);
        Nox.allow(newClaimable, owner());
        Nox.allow(newClaimable, owner_);

        emit DepositApproved(owner_, approved);
    }

    /**
     * @dev Moves `shares` from `owner_`'s pending redeem bucket to their claimable redeem
     * bucket. Shares stay escrowed in the vault (from the earlier {requestRedeem}); they are
     * burned at claim time (async `redeem`). Same {Nox.safeSub} + {Nox.select} pattern as
     * {approveDeposit}.
     */
    /// @inheritdoc IConfidentialERC7540
    function approveRedeem(euint256 shares, address owner_) external override onlyOwner {
        require(owner_ != address(0), ConfidentialERC7540ZeroAddress());
        Nox.allowThis(shares);

        (ebool success, euint256 newPending) = Nox.safeSub(
            _pendingRedeemShares[owner_],
            shares
        );
        newPending = Nox.select(success, newPending, _pendingRedeemShares[owner_]);
        _pendingRedeemShares[owner_] = newPending;
        Nox.allowThis(newPending);
        Nox.allow(newPending, owner());
        Nox.allow(newPending, owner_);

        euint256 approved = Nox.select(success, shares, Nox.toEuint256(0));
        euint256 newClaimable = Nox.add(_claimableRedeemShares[owner_], approved);
        _claimableRedeemShares[owner_] = newClaimable;
        Nox.allowThis(newClaimable);
        Nox.allow(newClaimable, owner());
        Nox.allow(newClaimable, owner_);

        emit RedeemApproved(owner_, approved);
    }

    // ============ Claim Phase ============

    /**
     * @inheritdoc IConfidentialERC7540
     * @dev Converts the full `claimableDepositAssets[controller]` bucket to shares at the live
     * NAV and mints them to `receiver`. Resets the claimable bucket and the global inflight
     * counter so future claimants see the correct productive NAV.
     *
     * Productive NAV = `confidentialTotalAssets() - _totalInflightDepositAssets`. At this point
     * the global inflight still includes THIS controller's claimable, so the subtraction
     * correctly excludes every user's pending/claimable bucket — including the caller's. The
     * counter is decremented only after `_mint`, to keep the invariant true throughout.
     */
    function deposit(
        address receiver,
        address controller
    ) external override returns (euint256 shares) {
        require(controller != address(0), ConfidentialERC7540ZeroAddress());
        require(
            isOperator(controller, msg.sender),
            ERC7984UnauthorizedSpender(controller, msg.sender)
        );

        euint256 assets = _claimableDepositAssets[controller];
        euint256 zero = Nox.toEuint256(0);
        _claimableDepositAssets[controller] = zero;
        Nox.allowThis(zero);

        (euint256 assetsBefore, euint256 supplyBefore) = _snapshot();
        euint256 productiveAssets = Nox.sub(assetsBefore, _totalInflightDepositAssets);
        Nox.allowThis(productiveAssets);
        shares = _convertToShares(assets, productiveAssets, supplyBefore);

        _mint(receiver, shares);

        // These assets are productive now; remove them from the global inflight pool.
        euint256 newInflight = Nox.sub(_totalInflightDepositAssets, assets);
        _totalInflightDepositAssets = newInflight;
        Nox.allowThis(newInflight);
        Nox.allow(newInflight, owner());

        emit DepositClaimed(controller, receiver, shares);
    }

    /**
     * @inheritdoc IConfidentialERC7540
     * @dev Converts the full `claimableRedeemShares[controller]` bucket to assets at the live
     * NAV, burns the escrowed shares held by the vault, and transfers the assets to `receiver`.
     */
    function redeem(
        address receiver,
        address controller
    ) external override returns (euint256 assets) {
        require(controller != address(0), ConfidentialERC7540ZeroAddress());
        require(
            isOperator(controller, msg.sender),
            ERC7984UnauthorizedSpender(controller, msg.sender)
        );

        euint256 shares = _claimableRedeemShares[controller];
        euint256 zero = Nox.toEuint256(0);
        _claimableRedeemShares[controller] = zero;
        Nox.allowThis(zero);

        (euint256 assetsBefore, euint256 supplyBefore) = _snapshot();
        assets = _convertToAssets(shares, assetsBefore, supplyBefore);

        // Burn the escrowed shares held by the vault (moved there at `requestRedeem`).
        _burn(address(this), shares);

        euint256 sent = _transferOut(receiver, assets);
        emit RedeemClaimed(controller, receiver, sent);
    }

    // ============ Views ============

    /// @inheritdoc IConfidentialERC7540
    function pendingDepositRequest(address controller) external view override returns (euint256) {
        return _pendingDepositAssets[controller];
    }

    /// @inheritdoc IConfidentialERC7540
    function claimableDepositRequest(address controller) external view override returns (euint256) {
        return _claimableDepositAssets[controller];
    }

    /// @inheritdoc IConfidentialERC7540
    function pendingRedeemRequest(address controller) external view override returns (euint256) {
        return _pendingRedeemShares[controller];
    }

    /// @inheritdoc IConfidentialERC7540
    function claimableRedeemRequest(address controller) external view override returns (euint256) {
        return _claimableRedeemShares[controller];
    }

    /**
     * @dev Encrypted running sum of deposit assets that have been pulled into the vault but
     * not yet converted to shares (pending + claimable across all controllers).
     *
     * ACL: only the vault itself and the admin (`owner()`) can decrypt this handle. Individual
     * controllers never get a grant — their own pending/claimable buckets are exposed via
     * {pendingDepositRequest} / {claimableDepositRequest} instead.
     */
    function totalPendingDepositAssets() external view returns (euint256) {
        return _totalInflightDepositAssets;
    }

    // ============ Admin viewership (totalSupply / totalAssets) ============
    // Every op that mutates the vault's encrypted totals produces a new handle that only the
    // vault itself is allowed on by default. These overrides re-grant persistent Nox ACL to the
    // Ownable `owner()` after each mutation, so the admin can decrypt `totalSupply` / `totalAssets`
    // off-chain. Users keep seeing only their own handles.

    /// @dev Re-grants the admin (Ownable `owner()`) persistent Nox ACL on the new
    ///      `_totalSupply` handle after every mint/burn/transfer.
    function _update(address from, address to, euint256 amount)
        internal
        virtual
        override
        returns (euint256 transferred)
    {
        transferred = super._update(from, to, amount);
        Nox.allow(confidentialTotalSupply(), owner());
    }

    /// @dev Re-grants the admin persistent Nox ACL on the updated `totalAssets` handle
    ///      (i.e. the vault's cUSDC balance) after each inbound asset transfer.
    function _transferIn(address from, euint256 amount)
        internal
        virtual
        override
        returns (euint256 transferred)
    {
        transferred = super._transferIn(from, amount);
        Nox.allow(confidentialTotalAssets(), owner());
    }

    /// @dev Re-grants the admin persistent Nox ACL on the updated `totalAssets` handle after
    ///      each outbound asset transfer.
    function _transferOut(address to, euint256 amount)
        internal
        virtual
        override
        returns (euint256 sent)
    {
        sent = super._transferOut(to, amount);
        Nox.allow(confidentialTotalAssets(), owner());
    }
}
