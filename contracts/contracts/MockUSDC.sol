// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Test ERC20 stablecoin representing USDC for CrediFi (Hack in Hills '26).
 * @dev 6 decimals matching official USDC standard with a controlled demo faucet.
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;
    uint256 public constant FAUCET_LIMIT = 10_000 * 10 ** DECIMALS; // 10,000 USDC max per faucet call

    event FaucetUsed(address indexed recipient, uint256 amount);

    constructor(address initialOwner) ERC20("Mock USD Coin", "mUSDC") Ownable(initialOwner) {
        // Mint initial supply of 1,000,000 mUSDC to deployer for liquidity & seeding
        _mint(initialOwner, 1_000_000 * 10 ** DECIMALS);
    }

    /**
     * @notice Returns 6 decimals matching real USDC
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Public faucet for demo testers and hackathon judges
     * @param to The recipient address
     * @param amount The requested amount (up to FAUCET_LIMIT)
     */
    function faucet(address to, uint256 amount) external {
        require(to != address(0), "MockUSDC: Invalid recipient");
        require(amount > 0, "MockUSDC: Amount must be greater than zero");
        require(amount <= FAUCET_LIMIT, "MockUSDC: Amount exceeds faucet limit (10,000 mUSDC)");

        _mint(to, amount);
        emit FaucetUsed(to, amount);
    }

    /**
     * @notice Owner-only minting for deployment preparation or liquidity seeding
     * @param to The recipient address
     * @param amount The amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "MockUSDC: Invalid recipient");
        _mint(to, amount);
    }
}
