// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";

import {ConfidentialERC7540} from "../vault/ConfidentialERC7540.sol";

/**
 * @dev Deploys {ConfidentialERC7540} vaults with CREATE2. The resulting address is a function of
 * `(factory, salt, keccak256(creationCode))` where `creationCode` already embeds the constructor
 * args (`asset`, `name`, `symbol`, `contractURI`, `initialOwner`) — any of those changing yields
 * a different address.
 *
 * Off-chain indexers can enumerate vaults by filtering the {ConfidentialERC7540Created} event;
 * no on-chain array is kept.
 *
 * TODO(prod):
 *  - Consider ERC-1167 minimal-proxy clones when the vault bytecode stabilises (cheaper deploys,
 *    shared implementation).
 *  - Add role-based access control on `createVault` (who can deploy? who can set the initial
 *    owner?).
 */
contract ConfidentialERC7540Factory {
    event ConfidentialERC7540Created(
        address indexed vault,
        address indexed asset,
        address indexed initialOwner,
        string name,
        string symbol
    );

    /**
     * @dev Deploys a new {ConfidentialERC7540} with the given params using CREATE2.
     * `initialOwner` receives the `Ownable` admin role on the vault (required to call
     * `approveDeposit` / `approveRedeem`). `salt` is combined with the caller-provided params
     * to give a deterministic address; pass `bytes32(0)` for a default.
     */
    function createVault(
        IERC7984 asset,
        string calldata name,
        string calldata symbol,
        string calldata contractURI,
        address initialOwner,
        bytes32 salt
    ) external returns (address vault) {
        vault = address(
            new ConfidentialERC7540{salt: salt}(asset, name, symbol, contractURI, initialOwner)
        );
        emit ConfidentialERC7540Created(vault, address(asset), initialOwner, name, symbol);
    }

    /**
     * @dev Computes the CREATE2 address a vault would be deployed to for a given set of params.
     * Useful for off-chain tooling to pre-compute the vault address before deployment.
     */
    function predictVaultAddress(
        IERC7984 asset,
        string calldata name,
        string calldata symbol,
        string calldata contractURI,
        address initialOwner,
        bytes32 salt
    ) external view returns (address) {
        bytes memory creationCode = abi.encodePacked(
            type(ConfidentialERC7540).creationCode,
            abi.encode(asset, name, symbol, contractURI, initialOwner)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creationCode))
        );
        return address(uint160(uint256(hash)));
    }
}
