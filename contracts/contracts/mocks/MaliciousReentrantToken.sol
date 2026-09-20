// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../LoanManager.sol";
import "../LendingPool.sol";

/**
 * @title MaliciousReentrantToken
 * @notice Test mock token that attempts to reenter LoanManager or LendingPool during transferFrom
 * @dev Used strictly in Hardhat integration & security test suite to verify ReentrancyGuard enforcement
 */
contract MaliciousReentrantToken is ERC20 {
    LoanManager public loanManager;
    LendingPool public lendingPool;
    bool public attackLoanManager;
    bool public attackLendingPool;
    uint256 public targetLoanId;
    address public victimLender;
    address public victimBorrower;

    constructor() ERC20("Malicious Token", "mBAD") {
        _mint(msg.sender, 10_000_000 * 10**6);
    }

    function configureAttack(
        address _loanManager,
        address _lendingPool,
        uint256 _targetLoanId,
        address _lender,
        address _borrower,
        bool _attackLoanManager,
        bool _attackLendingPool
    ) external {
        loanManager = LoanManager(_loanManager);
        lendingPool = LendingPool(_lendingPool);
        targetLoanId = _targetLoanId;
        victimLender = _lender;
        victimBorrower = _borrower;
        attackLoanManager = _attackLoanManager;
        attackLendingPool = _attackLendingPool;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (attackLoanManager) {
            attackLoanManager = false; // Prevent infinite loop
            loanManager.fundLoan(targetLoanId);
        }
        if (attackLendingPool) {
            attackLendingPool = false; // Prevent infinite loop
            lendingPool.transferFunds(victimLender, victimBorrower, amount);
        }
        return super.transferFrom(from, to, amount);
    }
}
