use alloy::sol;

sol! {
    /// Nox encrypted `uint256` handle. Encoded as `bytes32` on the wire —
    /// we carry it opaquely and never decrypt.
    type euint256 is bytes32;

    /// Emitted by the factory when a new confidential ERC-7540 vault is deployed.
    event ConfidentialERC7540Created(
        address indexed vault,
        address indexed asset,
        address indexed initialOwner,
        string          name,
        string          symbol
    );

    /// ERC-7540 — emitted when a deposit request is submitted.
    /// controller, owner, requestId are indexed; sender and assets are in data.
    event DepositRequest(
        address  indexed controller,
        address  indexed owner,
        uint256  indexed requestId,
        address          sender,
        euint256         assets
    );

    /// ERC-7540 — emitted when a redeem request is submitted.
    /// Same layout as `DepositRequest`, but `shares` instead of `assets`.
    event RedeemRequest(
        address  indexed controller,
        address  indexed owner,
        uint256  indexed requestId,
        address          sender,
        euint256         shares
    );

    /// Emitted by the vault when the settler approves a deposit.
    event DepositApproved(address indexed owner, euint256 assets);

    /// Emitted by the vault when the settler approves a redeem.
    event RedeemApproved(address indexed owner, euint256 shares);

    /// Emitted by the vault when the user claims an approved deposit.
    event DepositClaimed(
        address  indexed controller,
        address  indexed receiver,
        euint256         shares
    );

    /// Emitted by the vault when the user claims an approved redeem.
    event RedeemClaimed(
        address  indexed controller,
        address  indexed receiver,
        euint256         assets
    );

    #[sol(rpc)]
    interface IVault {
        function approveDeposit(euint256 assets, address owner) external;
        function approveRedeem(euint256 shares, address owner) external;

        function confidentialTotalAssets() external view returns (euint256);
        function confidentialTotalSupply() external view returns (euint256);
    }
}
