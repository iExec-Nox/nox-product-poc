// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    euint256,
    externalEuint256
} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/**
 * @dev Confidential adaptation of EIP-7540 (asynchronous tokenized vault).
 *
 * Reference: https://eips.ethereum.org/EIPS/eip-7540
 *
 * Flow differences from the plaintext EIP-7540:
 *  - All amounts are encrypted (`euint256`). Only the vault's Ownable `owner()` can observe
 *    per-user pending and claimable amounts (via the Nox ACL). Per-user operators (ERC-7984
 *    delegation) cannot.
 *  - `REQUEST_ID` is a constant (`0`) — EIP-7540's "singleton" mode where each user has at most
 *    one pending request and one claimable request per flow. A second `requestDeposit` before
 *    approval simply accumulates in the same bucket (state stays a `mapping(address controller
 *    => euint256 amount)`, no nested `mapping` on request id).
 *
 * TODO(prod):
 *  - Multi-request mode (unique `requestId` per call), needed if users should be able to cancel
 *    individual requests, if different NAV snapshots must be locked per request, or if per-lot
 *    metadata is required. Storage becomes
 *    `mapping(address => mapping(uint256 => euint256))` and views take the `requestId` back.
 */
interface IConfidentialERC7540 {
    // ============ Events ============

    event DepositRequest(
        address indexed controller,
        address indexed owner,
        uint256 indexed requestId,
        address sender,
        euint256 assets
    );
    event RedeemRequest(
        address indexed controller,
        address indexed owner,
        uint256 indexed requestId,
        address sender,
        euint256 shares
    );

    event DepositApproved(address indexed owner, euint256 assets);
    event RedeemApproved(address indexed owner, euint256 shares);

    event DepositClaimed(
        address indexed controller,
        address indexed receiver,
        euint256 shares
    );
    event RedeemClaimed(
        address indexed controller,
        address indexed receiver,
        euint256 assets
    );

    // ============ Request Phase ============

    /**
     * @dev Transfers `encryptedAssets` from `owner` into the vault and records them as a pending
     * deposit request for `controller`. Returns the request id (always `0` in this PoC).
     */
    function requestDeposit(
        externalEuint256 encryptedAssets,
        bytes calldata inputProof,
        address controller,
        address owner
    ) external returns (uint256 requestId);

    /**
     * @dev Same as the external-input variant of {requestDeposit}, but takes an already-
     * registered `euint256` handle. The caller must already hold ACL access to `assets`. Useful
     * for on-chain composition / scripting against existing handles.
     */
    function requestDeposit(
        euint256 assets,
        address controller,
        address owner
    ) external returns (uint256 requestId);

    /**
     * @dev Transfers `encryptedShares` from `owner` into the vault and records them as a pending
     * redeem request for `controller`. The shares are escrowed by the vault until approval.
     */
    function requestRedeem(
        externalEuint256 encryptedShares,
        bytes calldata inputProof,
        address controller,
        address owner
    ) external returns (uint256 requestId);

    /**
     * @dev Same as the external-input variant of {requestRedeem}, but takes an already-
     * registered `euint256` handle.
     */
    function requestRedeem(
        euint256 shares,
        address controller,
        address owner
    ) external returns (uint256 requestId);

    // ============ Approve Phase (onlyOwner) ============

    /**
     * @dev Moves `assets` from `owner`'s pending deposit into their claimable deposit bucket.
     * Only callable by the vault's Ownable owner. The conversion to shares happens at claim time.
     */
    function approveDeposit(euint256 assets, address owner) external;

    /**
     * @dev Convenience overload: same as {approveDeposit}, but takes an externally-encrypted
     * amount + input proof so the owner does not need a separate transaction to register the
     * handle.
     */
    function approveDeposit(
        externalEuint256 encryptedAssets,
        bytes calldata inputProof,
        address owner
    ) external;

    /**
     * @dev Moves `shares` from `owner`'s pending redeem into their claimable redeem bucket.
     * Only callable by the vault's Ownable owner. The conversion to assets happens at claim time.
     */
    function approveRedeem(euint256 shares, address owner) external;

    /**
     * @dev Convenience overload: same as {approveRedeem}, but takes an externally-encrypted
     * amount + input proof.
     */
    function approveRedeem(
        externalEuint256 encryptedShares,
        bytes calldata inputProof,
        address owner
    ) external;

    // ============ Claim Phase ============

    /**
     * @dev EIP-7540 async claim: converts `claimableDepositRequest(controller)` in full to shares
     * at the live NAV and mints them to `receiver`. Returns the encrypted shares amount.
     *
     * Signature note: EIP-7540 specifies `deposit(assets, receiver, controller)`; in a
     * confidential setting the caller cannot know the exact plaintext `assets` to pass, so this
     * overload drops the parameter and claims the full claimable bucket. A spec-compliant
     * partial-claim flow would require a separate disclosure step (TODO(prod)).
     */
    function deposit(address receiver, address controller) external returns (euint256 shares);

    /**
     * @dev EIP-7540 async claim: burns `claimableRedeemRequest(controller)` in full, converts to
     * assets at the live NAV and transfers them to `receiver`. Returns the encrypted assets
     * amount. Same signature deviation as {deposit}.
     */
    function redeem(address receiver, address controller) external returns (euint256 assets);

    // ============ Views ============

    /**
     * @dev Encrypted amount of underlying `assets` currently pending a deposit approval for
     * `controller`. Iso EIP-7540 (returned unit: assets).
     */
    function pendingDepositRequest(address controller) external view returns (euint256);

    /**
     * @dev Encrypted amount of underlying `assets` currently claimable for `controller`. Iso
     * EIP-7540 (returned unit: assets).
     */
    function claimableDepositRequest(address controller) external view returns (euint256);

    /**
     * @dev Encrypted amount of `shares` currently pending a redeem approval for `controller`.
     * Iso EIP-7540 (returned unit: shares).
     */
    function pendingRedeemRequest(address controller) external view returns (euint256);

    /**
     * @dev Encrypted amount of `shares` currently claimable for `controller`. Iso EIP-7540
     * (returned unit: shares).
     */
    function claimableRedeemRequest(address controller) external view returns (euint256);
}
