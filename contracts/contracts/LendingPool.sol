// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LendingPool
 * @notice Protocol Token Movement & Custody Layer for CrediFi (Hack in Hills '26).
 * @dev Handles secure transfers of MockUSDC between lenders and borrowers.
 *      Mutation functions are strictly restricted to the authorized LoanManager contract.
 *      Does NOT determine credit scores, loan lifecycle, interest, or collateral.
 */
contract LendingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public token;
    address public loanManager;

    // Events
    event FundsTransferred(address indexed lender, address indexed borrower, uint256 amount);
    event FundsDisbursed(address indexed lender, address indexed borrower, uint256 amount);
    event RepaymentExecuted(address indexed borrower, address indexed lender, uint256 amount);
    event RepaymentTransferred(address indexed borrower, address indexed lender, uint256 amount);
    event LoanManagerUpdated(address indexed previousManager, address indexed newManager);
    event TokenUpdated(address indexed previousToken, address indexed newToken);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "LendingPool: Caller is not authorized LoanManager");
        _;
    }

    /**
     * @notice Initializes LendingPool with token and LoanManager addresses
     * @param _token Address of ERC20 token (MockUSDC)
     * @param _loanManager Address of authorized LoanManager contract
     */
    constructor(address _token, address _loanManager) Ownable(msg.sender) {
        require(_token != address(0), "LendingPool: Invalid token address");
        require(_loanManager != address(0), "LendingPool: Invalid LoanManager address");

        token = IERC20(_token);
        loanManager = _loanManager;
    }

    /**
     * @notice Set or update the authorized LoanManager contract
     * @dev Restricted strictly to owner
     * @param _loanManager Address of deployed LoanManager contract
     */
    function setLoanManager(address _loanManager) external onlyOwner {
        require(_loanManager != address(0), "LendingPool: Invalid LoanManager address");
        address prev = loanManager;
        loanManager = _loanManager;
        emit LoanManagerUpdated(prev, _loanManager);
    }

    /**
     * @notice Set or update the underlying token address
     * @dev Restricted strictly to owner
     * @param _token Address of new ERC20 token contract
     */
    function setToken(address _token) external onlyOwner {
        require(_token != address(0), "LendingPool: Invalid token address");
        address prev = address(token);
        token = IERC20(_token);
        emit TokenUpdated(prev, _token);
    }

    /**
     * @notice Transfers loan principal from Lender to Borrower upon loan funding
     * @dev Called exclusively by LoanManager during fundLoan()
     * @param lender The lender providing liquidity
     * @param borrower The borrower receiving principal
     * @param amount The principal amount to disburse
     */
    function transferFunds(
        address lender,
        address borrower,
        uint256 amount
    ) external onlyLoanManager nonReentrant {
        require(lender != address(0), "LendingPool: Invalid lender");
        require(borrower != address(0), "LendingPool: Invalid borrower");
        require(lender != borrower, "LendingPool: Lender cannot be borrower");
        require(amount > 0, "LendingPool: Amount must be greater than zero");

        // Direct transfer from Lender to Borrower using SafeERC20
        token.safeTransferFrom(lender, borrower, amount);

        emit FundsTransferred(lender, borrower, amount);
        emit FundsDisbursed(lender, borrower, amount);
    }

    /**
     * @notice Executes repayment transfer from Borrower to Lender
     * @dev Called exclusively by LoanManager during repayLoan()
     * @param borrower The borrower making repayment
     * @param lender The lender receiving principal + interest
     * @param totalDue The total debt obligation
     */
    function executeRepayment(
        address borrower,
        address lender,
        uint256 totalDue
    ) external onlyLoanManager nonReentrant {
        require(borrower != address(0), "LendingPool: Invalid borrower");
        require(lender != address(0), "LendingPool: Invalid lender");
        require(borrower != lender, "LendingPool: Borrower cannot be lender");
        require(totalDue > 0, "LendingPool: Repayment must be greater than zero");

        // Direct transfer from Borrower to Lender using SafeERC20
        token.safeTransferFrom(borrower, lender, totalDue);

        emit RepaymentExecuted(borrower, lender, totalDue);
        emit RepaymentTransferred(borrower, lender, totalDue);
    }
}
