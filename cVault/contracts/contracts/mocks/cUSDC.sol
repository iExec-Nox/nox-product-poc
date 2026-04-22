// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";
import {Nox, euint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/**
 * @dev Confidential USDC stand-in used only in tests. Concrete {ERC7984} with a permission-less
 * `mintPublic(address, uint256)` that wraps the plaintext amount as a public handle via
 * `Nox.toEuint256` and mints it to `to`.
 *
 * Do NOT deploy in production — a public mint breaks the confidentiality of early depositors.
 */
contract cUSDC is ERC7984 {
    constructor() ERC7984("Confidential USDC", "cUSDC", "") {}

    function mintPublic(address to, uint256 amount) external returns (euint256) {
        return _mint(to, Nox.toEuint256(amount));
    }
}
