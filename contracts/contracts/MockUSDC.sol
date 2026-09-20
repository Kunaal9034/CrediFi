// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Test ERC20 stablecoin representing USDC for CrediFi (Hack in Hills '26).
 * @dev Implements standard ERC20 behavior with 6 decimals and a capped public faucet
 *      for hackathon testing and demo wallets. Pure ERC20 token with zero protocol-specific logic.
 */
contract MockUSDC is ERC20 {
    /// @notice Number of token decimals matching the real USDC standard
    uint8 private constant DECIMALS = 6;

    /// @notice Maximum allowed token mint per faucet invocation (10,000 mUSDC in base units)
    uint256 public constant MAX_FAUCET_AMOUNT = 10_000 * 10 ** DECIMALS; // 10_000_000_000 units

    /**
     * @notice Emitted whenever tokens are minted via the public faucet
     * @param to The recipient wallet address
     * @param amount The number of token base units minted
     */
    event FaucetMinted(address indexed to, uint256 amount);

    /**
     * @notice Initializes the Mock USD Coin ERC20 token with zero initial supply
     */
    constructor() ERC20("Mock USD Coin", "mUSDC") {}

    /**
     * @notice Returns the token decimal precision
     * @return uint8 Number of decimals (6)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Public faucet allowing demo testers and hackathon judges to claim test tokens
     * @dev Enforces non-zero address, non-zero amount, and a 10,000 mUSDC maximum per call
     * @param to The recipient address receiving the minted tokens
     * @param amount The requested amount in base units (max 10,000_000_000 units)
     */
    function faucet(address to, uint256 amount) external {
        require(to != address(0), "MockUSDC: Zero address");
        require(amount > 0, "MockUSDC: Zero amount");
        require(amount <= MAX_FAUCET_AMOUNT, "MockUSDC: Amount exceeds faucet limit (10,000 mUSDC)");

        _mint(to, amount);
        emit FaucetMinted(to, amount);
    }
}
