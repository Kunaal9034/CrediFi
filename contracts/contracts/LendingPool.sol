// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LendingPool
 * @notice Secure token movement layer for CrediFi (Hack in Hills '26).
 * @dev Handles custody and transfer of MockUSDC between lenders and borrowers.
 *      Does NOT decide loan lifecycle states; all actions are triggered by LoanManager.
 */
contract LendingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public loanManager;

    event LoanManagerUpdated(address indexed previousManager, address indexed newManager);
    event FundsDisbursed(address indexed lender, address indexed borrower, uint256 amount);
    event RepaymentTransferred(address indexed borrower, address indexed lender, uint256 totalDue);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "LendingPool: Caller is not authorized LoanManager");
        _;
    }

    constructor(address _token, address initialOwner) Ownable(initialOwner) {
        require(_token != address(0), "LendingPool: Invalid token address");
        token = IERC20(_token);
    }

    /**
     * @notice Set or update the authorized LoanManager contract
     * @param _loanManager Address of the deployed LoanManager contract
     */
    function setLoanManager(address _loanManager) external onlyOwner {
        require(_loanManager != address(0), "LendingPool: Invalid LoanManager address");
        address prev = loanManager;
        loanManager = _loanManager;
        emit LoanManagerUpdated(prev, _loanManager);
    }

    /**
     * @notice Disburses loan funds from Lender to Borrower upon loan funding
     * @dev Called only by LoanManager when state transitions from REQUESTED -> ACTIVE
     * @param lender The lender providing liquidity
     * @param borrower The borrower receiving the principal
     * @param amount The principal amount to disburse
     */
    function transferFunds(
        address lender,
        address borrower,
        uint256 amount
    ) external onlyLoanManager nonReentrant {
        require(lender != address(0), "LendingPool: Invalid lender");
        require(borrower != address(0), "LendingPool: Invalid borrower");
        require(amount > 0, "LendingPool: Amount must be greater than zero");

        // Transfer MockUSDC: Lender -> LendingPool -> Borrower
        token.safeTransferFrom(lender, address(this), amount);
        token.safeTransfer(borrower, amount);

        emit FundsDisbursed(lender, borrower, amount);
    }

    /**
     * @notice Executes repayment transfer from Borrower to Lender
     * @dev Called only by LoanManager when state transitions from ACTIVE -> REPAID
     * @param borrower The borrower making the repayment
     * @param lender The lender receiving the principal + interest
     * @param totalDue The total debt obligation
     */
    function executeRepayment(
        address borrower,
        address lender,
        uint256 totalDue
    ) external onlyLoanManager nonReentrant {
        require(borrower != address(0), "LendingPool: Invalid borrower");
        require(lender != address(0), "LendingPool: Invalid lender");
        require(totalDue > 0, "LendingPool: Repayment must be greater than zero");

        // Transfer MockUSDC: Borrower -> LendingPool -> Lender
        token.safeTransferFrom(borrower, address(this), totalDue);
        token.safeTransfer(lender, totalDue);

        emit RepaymentTransferred(borrower, lender, totalDue);
    }
}
