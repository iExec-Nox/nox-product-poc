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
 * Follows OZ's ERC-7540 draft reference design: the NAV conversion happens at fulfillment
 * (`approveDeposit` / `approveRedeem`), not at claim. This makes the share count deterministic
 * from the admin's perspective as soon as the request is approved, and turns the user-side
 * claim into a pure transfer (no FHE convert/mint at claim time).
 *
 * Deposit lifecycle:
 *   1. {requestDeposit}: assets pulled into vault; `_pendingDepositAssets[c]` += amount;
 *      `_totalPendingDepositAssets` += amount.
 *   2. {approveDeposit}: admin settles an amount of the controller's pending. Shares are
 *      computed at the current productive NAV, minted to the vault (escrow), and the
 *      `(assets, shares)` pair is stored on the controller's claimable bucket. Pending counter
 *      is decremented.
 *   3. `deposit(receiver, controller)`: simple transfer of the escrowed shares from vault to
 *      receiver. Resets the claimable bucket.
 *
 * Redeem lifecycle (symmetric):
 *   1. {requestRedeem}: shares escrowed into vault (transfer owner_ → address(this));
 *      `_pendingRedeemShares[c]` += amount.
 *   2. {approveRedeem}: admin settles an amount of the controller's pending. Assets are
 *      computed at the current productive NAV, the escrowed shares are burned, and the
 *      `(shares, assets)` pair is stored on the controller's claimable bucket.
 *   3. `redeem(receiver, controller)`: simple `_transferOut` of the reserved assets to
 *      receiver. Resets the claimable bucket.
 *
 * Productive NAV = `confidentialTotalAssets() - _totalPendingDepositAssets`. Excluding the
 * pending pool ensures concurrent deposit requests don't dilute one another and saves the
 * first-deposit edge case from the `assets / (assets + 1) = 0` degeneracy.
 *
 * The vault owner is the only account that can observe aggregated totals (encrypted handle ACL
 * is granted to the vault and `owner()`). Individual users see only their own buckets.
 *
 * TODO(prod):
 *  - Multi-request support. Currently each controller has a single "bucket" per flow; submitting
 *    a second request before approval simply accumulates in the same bucket. EIP-7540 allows
 *    multiple concurrent requests via `requestId`.
 *  - Partial claim. Users can only claim the full claimable balance; EIP-7540 allows partial
 *    via floor/ceil-rounded mulDiv on the stored `(assets, shares)` pair.
 *  - Cancel / reject flow (refunds of pending assets/shares if the owner declines the request).
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
    /// @dev Shares pre-minted to the vault at `approveDeposit` time, paired with the matching
    ///      `_claimableDepositAssets[controller]` so the claim is a deterministic transfer.
    mapping(address controller => euint256) private _claimableDepositShares;

    mapping(address controller => euint256) private _pendingRedeemShares;
    mapping(address controller => euint256) private _claimableRedeemShares;
    /// @dev Assets reserved for the controller at `approveRedeem` time, paired with the matching
    ///      `_claimableRedeemShares[controller]`. The assets stay in the vault balance until
    ///      claimed via `redeem(receiver, controller)`.
    mapping(address controller => euint256) private _claimableRedeemAssets;

    /**
     * @dev Running sum of deposit assets in Pending state across every controller. Once an
     * admin `approveDeposit`s an amount, the share side is minted against it and the counter
     * is decremented — the corresponding assets become productive from that point.
     *
     * Invariant: `asset.confidentialBalanceOf(vault) - _totalPendingDepositAssets` equals the
     * productive capital (i.e. assets with shares minted against them).
     */
    euint256 private _totalPendingDepositAssets;

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
        _totalPendingDepositAssets = zero;
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
        euint256 newInflight = Nox.add(_totalPendingDepositAssets, transferred);
        _totalPendingDepositAssets = newInflight;
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
     * @dev Settles `assets` of `owner_`'s pending deposit bucket. OZ's `_fulfillDeposit`
     * pattern: convert the approved amount to shares at the current productive NAV, mint those
     * shares to the vault itself (escrow), and store the `(assets, shares)` pair on the
     * claimable bucket.
     *
     * Uses {Nox.safeSub} so an approval bigger than the current pending is a no-op (pending
     * untouched, 0 credited). {Nox.select} threads the success flag through every state
     * update. The productive NAV is evaluated BEFORE the pending counter decrement, so for
     * the first deposit (or any scenario where the controller's pending dominates) the
     * productive totalAssets is zero and shares are minted at the seed ratio.
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
        euint256 approved = Nox.select(success, assets, Nox.toEuint256(0));

        // Snapshot productive NAV BEFORE decrementing _totalPendingDepositAssets. At this
        // moment `_totalPendingDepositAssets` still contains the full pending of this
        // controller — correct, we must exclude it from the productive denominator.
        (euint256 assetsBefore, euint256 supplyBefore) = _snapshot();
        euint256 productiveAssets = Nox.sub(assetsBefore, _totalPendingDepositAssets);
        Nox.allowThis(productiveAssets);
        euint256 shares = _convertToShares(approved, productiveAssets, supplyBefore);

        // Mint the escrow shares to the vault. These shares increase totalSupply and sit on
        // `address(this)`'s balance until the controller claims via `deposit(receiver, c)`.
        _mint(address(this), shares);

        // Persist the updated pending bucket + global counter.
        _pendingDepositAssets[owner_] = newPending;
        Nox.allowThis(newPending);
        Nox.allow(newPending, owner());
        Nox.allow(newPending, owner_);

        euint256 newTotalPending = Nox.sub(_totalPendingDepositAssets, approved);
        _totalPendingDepositAssets = newTotalPending;
        Nox.allowThis(newTotalPending);
        Nox.allow(newTotalPending, owner());

        // Credit the claimable (assets, shares) pair.
        euint256 newClaimableAssets = Nox.add(_claimableDepositAssets[owner_], approved);
        _claimableDepositAssets[owner_] = newClaimableAssets;
        Nox.allowThis(newClaimableAssets);
        Nox.allow(newClaimableAssets, owner());
        Nox.allow(newClaimableAssets, owner_);

        euint256 newClaimableShares = Nox.add(_claimableDepositShares[owner_], shares);
        _claimableDepositShares[owner_] = newClaimableShares;
        Nox.allowThis(newClaimableShares);
        Nox.allow(newClaimableShares, owner());
        Nox.allow(newClaimableShares, owner_);

        emit DepositApproved(owner_, approved);
    }

    /**
     * @dev Settles `shares` of `owner_`'s pending redeem bucket. OZ's `_fulfillRedeem` pattern:
     * convert the approved amount to assets at the current productive NAV, burn the escrowed
     * shares, and store the `(shares, assets)` pair on the claimable bucket. The reserved
     * assets stay in the vault's balance until claimed via `redeem(receiver, controller)`.
     *
     * Burning at fulfill (not claim) keeps `totalSupply` in sync with on-chain reality from the
     * admin's settlement point onward — same as OZ.
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
        euint256 approved = Nox.select(success, shares, Nox.toEuint256(0));

        // Snapshot productive NAV (excluding pending deposits — see `approveDeposit` for the
        // rationale; redeem-side has no pending-assets bucket of its own).
        (euint256 assetsBefore, euint256 supplyBefore) = _snapshot();
        euint256 productiveAssets = Nox.sub(assetsBefore, _totalPendingDepositAssets);
        Nox.allowThis(productiveAssets);
        euint256 assetsOut = _convertToAssets(approved, productiveAssets, supplyBefore);
        Nox.allowThis(assetsOut);

        // Burn the escrowed shares now (iso OZ `_fulfillRedeem`).
        _burn(address(this), approved);

        // Persist pending bucket.
        _pendingRedeemShares[owner_] = newPending;
        Nox.allowThis(newPending);
        Nox.allow(newPending, owner());
        Nox.allow(newPending, owner_);

        // Credit the claimable (shares, assets) pair.
        euint256 newClaimableShares = Nox.add(_claimableRedeemShares[owner_], approved);
        _claimableRedeemShares[owner_] = newClaimableShares;
        Nox.allowThis(newClaimableShares);
        Nox.allow(newClaimableShares, owner());
        Nox.allow(newClaimableShares, owner_);

        euint256 newClaimableAssets = Nox.add(_claimableRedeemAssets[owner_], assetsOut);
        _claimableRedeemAssets[owner_] = newClaimableAssets;
        Nox.allowThis(newClaimableAssets);
        Nox.allow(newClaimableAssets, owner());
        Nox.allow(newClaimableAssets, owner_);

        emit RedeemApproved(owner_, approved);
    }

    // ============ Claim Phase ============

    /**
     * @inheritdoc IConfidentialERC7540
     * @dev Claims the escrowed shares from the vault to `receiver`. Shares were minted to the
     * vault at `approveDeposit` time; this call is a pure confidential transfer with no NAV
     * calculation. Resets both sides of the claimable bucket.
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

        shares = _claimableDepositShares[controller];
        euint256 zero = Nox.toEuint256(0);
        _claimableDepositAssets[controller] = zero;
        _claimableDepositShares[controller] = zero;
        Nox.allowThis(zero);

        Nox.allowThis(shares);
        _transfer(address(this), receiver, shares);

        emit DepositClaimed(controller, receiver, shares);
    }

    /**
     * @inheritdoc IConfidentialERC7540
     * @dev Claims the reserved assets from the vault to `receiver`. Assets were earmarked and
     * the escrowed shares were burned at `approveRedeem` time; this call is a pure
     * `_transferOut` with no NAV calculation. Resets both sides of the claimable bucket.
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

        assets = _claimableRedeemAssets[controller];
        euint256 zero = Nox.toEuint256(0);
        _claimableRedeemShares[controller] = zero;
        _claimableRedeemAssets[controller] = zero;
        Nox.allowThis(zero);

        Nox.allowThis(assets);
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
        return _totalPendingDepositAssets;
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

    /// @dev Virtual-share offset for inflation-attack defense in depth. OZ's default is 0
    ///      (already non-profitable per their analysis); we push it to 6 to make the attack
    ///      orders of magnitude more expensive than any realistic gain. Share decimals become
    ///      `assetDecimals + 6`, which the front reads via `vault.decimals()`.
    function _decimalsOffset() internal view virtual override returns (uint8) {
        return 6;
    }
}
