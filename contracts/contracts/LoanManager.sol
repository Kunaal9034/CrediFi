// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CreditRegistry.sol";
import "./LendingPool.sol";

/**
 * @title LoanManager
 * @notice Protocol Orchestrator & State Machine for CrediFi (Hack in Hills '26).
 * @dev Enforces undercollateralized borrowing limits onchain.
 *      Controls state transitions across the 4-state lifecycle:
 *      REQUESTED -> ACTIVE -> REPAID (or ACTIVE -> DEFAULTED).
 */
contract LoanManager is Ownable, ReentrancyGuard {
    enum LoanStatus {
        REQUESTED,
        ACTIVE,
        REPAID,
        DEFAULTED
    }

    struct Loan {
        uint256 loanId;
        address borrower;
        address lender;
        uint256 principal;
        uint256 interestRate; // In basis points (e.g. 1000 = 10%)
        uint256 duration;     // Duration in seconds
        uint256 startTime;    // Timestamp when funded
        uint256 dueDate;      // Due date timestamp (startTime + duration)
        LoanStatus status;
    }

    CreditRegistry public creditRegistry;
    LendingPool public lendingPool;

    uint256 public loanCounter;
    mapping(uint256 => Loan) private loans;

    // Protocol constraints
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 365 days;
    uint256 public constant MAX_INTEREST_RATE = 5000; // 50% max APR

    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint256 interestRate,
        uint256 duration
    );
    event LoanFunded(
        uint256 indexed loanId,
        address indexed lender,
        uint256 startTime,
        uint256 dueDate
    );
    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 totalPaid,
        bool onTime,
        bool early
    );
    event LoanDefaulted(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed lender
    );
    event ProtocolContractsUpdated(address indexed creditRegistry, address indexed lendingPool);

    constructor(
        address _creditRegistry,
        address _lendingPool,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_creditRegistry != address(0), "LoanManager: Invalid CreditRegistry");
        require(_lendingPool != address(0), "LoanManager: Invalid LendingPool");

        creditRegistry = CreditRegistry(_creditRegistry);
        lendingPool = LendingPool(_lendingPool);
    }

    /**
     * @notice Update connected protocol contracts
     * @param _creditRegistry Address of CreditRegistry
     * @param _lendingPool Address of LendingPool
     */
    function setProtocolContracts(
        address _creditRegistry,
        address _lendingPool
    ) external onlyOwner {
        require(_creditRegistry != address(0), "LoanManager: Invalid CreditRegistry");
        require(_lendingPool != address(0), "LoanManager: Invalid LendingPool");

        creditRegistry = CreditRegistry(_creditRegistry);
        lendingPool = LendingPool(_lendingPool);
        emit ProtocolContractsUpdated(_creditRegistry, _lendingPool);
    }

    /**
     * @notice Request an undercollateralized loan
     * @dev Strictly enforces onchain borrowing limit from CreditRegistry
     * @param amount Requested principal in MockUSDC (6 decimals)
     * @param duration Loan duration in seconds
     * @param interestRate Annual interest rate in basis points (100 = 1%)
     */
    function createLoan(
        uint256 amount,
        uint256 duration,
        uint256 interestRate
    ) external nonReentrant returns (uint256) {
        require(amount > 0, "LoanManager: Amount must be greater than zero");
        require(duration >= MIN_DURATION, "LoanManager: Duration below minimum (1 hour)");
        require(duration <= MAX_DURATION, "LoanManager: Duration exceeds maximum (365 days)");
        require(interestRate <= MAX_INTEREST_RATE, "LoanManager: Interest rate exceeds maximum (50%)");

        // CRITICAL: Onchain borrowing limit enforcement
        uint256 borrowingLimit = creditRegistry.getBorrowingLimit(msg.sender);
        require(
            amount <= borrowingLimit,
            "LoanManager: Requested amount exceeds onchain borrowing limit"
        );

        loanCounter += 1;
        uint256 newLoanId = loanCounter;

        loans[newLoanId] = Loan({
            loanId: newLoanId,
            borrower: msg.sender,
            lender: address(0),
            principal: amount,
            interestRate: interestRate,
            duration: duration,
            startTime: 0,
            dueDate: 0,
            status: LoanStatus.REQUESTED
        });

        // Record loan in CreditRegistry
        creditRegistry.recordLoan(msg.sender, amount);

        emit LoanCreated(newLoanId, msg.sender, amount, interestRate, duration);
        return newLoanId;
    }

    /**
     * @notice Fund an open loan request
     * @dev Transitions loan directly from REQUESTED -> ACTIVE
     * @param loanId The ID of the loan to fund
     */
    function fundLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];

        require(loan.loanId != 0, "LoanManager: Loan does not exist");
        require(loan.status == LoanStatus.REQUESTED, "LoanManager: Loan is not in REQUESTED state");
        require(msg.sender != loan.borrower, "LoanManager: Borrower cannot fund their own loan");

        // Transition State: REQUESTED -> ACTIVE
        loan.status = LoanStatus.ACTIVE;
        loan.lender = msg.sender;
        loan.startTime = block.timestamp;
        loan.dueDate = block.timestamp + loan.duration;

        // Disburse funds via LendingPool: Lender -> Borrower
        lendingPool.transferFunds(msg.sender, loan.borrower, loan.principal);

        emit LoanFunded(loanId, msg.sender, loan.startTime, loan.dueDate);
    }

    /**
     * @notice Repay an active loan
     * @dev Transitions loan directly from ACTIVE -> REPAID
     * @param loanId The ID of the loan to repay
     */
    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];

        require(loan.loanId != 0, "LoanManager: Loan does not exist");
        require(loan.status == LoanStatus.ACTIVE, "LoanManager: Loan is not in ACTIVE state");
        require(msg.sender == loan.borrower, "LoanManager: Only the borrower can repay this loan");

        uint256 totalDue = calculateTotalDue(loanId);
        bool onTime = block.timestamp <= loan.dueDate;
        bool early = block.timestamp <= loan.startTime + (loan.duration / 2);

        // Transition State: ACTIVE -> REPAID
        loan.status = LoanStatus.REPAID;

        // Execute repayment via LendingPool: Borrower -> Lender
        lendingPool.executeRepayment(loan.borrower, loan.lender, totalDue);

        // Update credit score in CreditRegistry
        creditRegistry.recordRepayment(loan.borrower, totalDue, onTime, early);

        emit LoanRepaid(loanId, loan.borrower, totalDue, onTime, early);
    }

    /**
     * @notice Mark an overdue loan as defaulted
     * @dev Transitions loan directly from ACTIVE -> DEFAULTED
     * @param loanId The ID of the loan to default
     */
    function markDefault(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];

        require(loan.loanId != 0, "LoanManager: Loan does not exist");
        require(loan.status == LoanStatus.ACTIVE, "LoanManager: Loan is not in ACTIVE state");
        require(block.timestamp > loan.dueDate, "LoanManager: Loan is not past due date");
        require(
            msg.sender == loan.lender || msg.sender == owner(),
            "LoanManager: Only the lender or owner can mark default"
        );

        // Transition State: ACTIVE -> DEFAULTED
        loan.status = LoanStatus.DEFAULTED;

        // Penalize credit profile in CreditRegistry
        creditRegistry.recordDefault(loan.borrower, loan.principal);

        emit LoanDefaulted(loanId, loan.borrower, loan.lender);
    }

    /**
     * @notice Calculate total debt obligation (principal + interest)
     * @param loanId The ID of the loan
     */
    function calculateTotalDue(uint256 loanId) public view returns (uint256) {
        Loan memory loan = loans[loanId];
        require(loan.loanId != 0, "LoanManager: Loan does not exist");

        // Interest = (Principal * APR_bps * Duration_seconds) / (365 days * 10,000)
        uint256 interest = (loan.principal * loan.interestRate * loan.duration) / (365 days * 10000);
        return loan.principal + interest;
    }

    /**
     * @notice Retrieve loan details
     * @param loanId The ID of the loan
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        require(loans[loanId].loanId != 0, "LoanManager: Loan does not exist");
        return loans[loanId];
    }
}
