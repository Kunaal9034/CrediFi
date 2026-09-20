// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CreditRegistry.sol";
import "./LendingPool.sol";

/**
 * @title LoanManager
 * @notice Protocol Orchestrator & State Machine for CrediFi (Hack in Hills '26).
 * @dev Enforces onchain borrowing power and outstanding debt exposure.
 *      Manages the strict 4-state lifecycle: REQUESTED -> ACTIVE -> REPAID / DEFAULTED.
 *      Zero collateral - pure reputation-driven unsecured lending.
 */
contract LoanManager is Ownable, ReentrancyGuard {
    enum LoanStatus {
        REQUESTED,
        ACTIVE,
        REPAID,
        DEFAULTED
    }

    enum RepaymentType {
        EARLY,
        ON_TIME,
        LATE
    }

    struct Loan {
        uint256 loanId;
        address borrower;
        address lender;
        uint256 principal;
        uint256 interestRateBps;
        uint256 duration;     // Duration in seconds
        uint256 totalDue;     // Principal + calculated simple interest
        uint256 createdAt;    // Timestamp when loan request was created
        uint256 dueDate;      // Due date timestamp (set upon funding)
        LoanStatus status;
    }

    // Connected protocol layer contracts
    CreditRegistry public creditRegistry;
    LendingPool public lendingPool;

    // Loan sequence counter
    uint256 public loanCounter;
    mapping(uint256 => Loan) private loans;

    // Cumulative outstanding principal exposure per borrower (REQUESTED + ACTIVE)
    mapping(address => uint256) public outstandingPrincipal;

    // Protocol Constants
    uint256 public constant MIN_INTEREST_RATE_BPS = 1;     // 0.01% min APR
    uint256 public constant MAX_INTEREST_RATE_BPS = 2000;  // 20.00% max APR
    uint256 public constant MIN_DURATION = 1 days;         // 1 day min duration
    uint256 public constant MAX_DURATION = 365 days;       // 365 days max duration
    uint256 public constant DEFAULT_GRACE_PERIOD = 1 days; // 1 day grace period before default

    // Primary Protocol Events
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint256 interestRateBps,
        uint256 duration,
        uint256 totalDue,
        uint256 dueDate
    );

    event LoanFunded(
        uint256 indexed loanId,
        address indexed lender,
        address indexed borrower,
        uint256 principal,
        uint256 dueDate
    );

    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed lender,
        uint256 principal,
        uint256 totalDue,
        RepaymentType repaymentType
    );

    event LoanDefaulted(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed lender,
        uint256 principal
    );

    event ProtocolContractsUpdated(address indexed creditRegistry, address indexed lendingPool);

    /**
     * @notice Initializes LoanManager with addresses of CreditRegistry and LendingPool
     * @param _creditRegistry Address of deployed CreditRegistry contract
     * @param _lendingPool Address of deployed LendingPool contract
     * @param initialOwner Address of contract administrator/owner
     */
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
     * @notice Updates connected protocol contracts
     * @dev Restricted strictly to contract owner
     * @param _creditRegistry New CreditRegistry address
     * @param _lendingPool New LendingPool address
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
     * @notice Updates CreditRegistry address
     * @dev Restricted to owner, rejects zero address
     * @param _creditRegistry New CreditRegistry address
     */
    function setCreditRegistry(address _creditRegistry) external onlyOwner {
        require(_creditRegistry != address(0), "LoanManager: Invalid CreditRegistry");
        creditRegistry = CreditRegistry(_creditRegistry);
        emit ProtocolContractsUpdated(_creditRegistry, address(lendingPool));
    }

    /**
     * @notice Updates LendingPool address
     * @dev Restricted to owner, rejects zero address
     * @param _lendingPool New LendingPool address
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        require(_lendingPool != address(0), "LoanManager: Invalid LendingPool");
        lendingPool = LendingPool(_lendingPool);
        emit ProtocolContractsUpdated(address(creditRegistry), _lendingPool);
    }

    /**
     * @notice Calculates annualized simple interest using integer arithmetic
     * @dev Formula: (principal * interestRateBps * duration) / (365 days * 10,000)
     * @param principal The loan principal in token base units
     * @param interestRateBps Annual interest rate in basis points (100 = 1%)
     * @param duration Duration in seconds
     * @return uint256 Accrued simple interest in token base units
     */
    function calculateInterest(
        uint256 principal,
        uint256 interestRateBps,
        uint256 duration
    ) public pure returns (uint256) {
        return (principal * interestRateBps * duration) / (365 days * 10000);
    }

    /**
     * @notice Calculates total debt obligation (principal + simple interest)
     * @param principal The loan principal
     * @param interestRateBps Annual interest rate in basis points
     * @param duration Duration in seconds
     * @return uint256 Total amount due upon repayment
     */
    function calculateTotalDue(
        uint256 principal,
        uint256 interestRateBps,
        uint256 duration
    ) public pure returns (uint256) {
        return principal + calculateInterest(principal, interestRateBps, duration);
    }

    /**
     * @notice Helper to calculate total due for an existing loan
     * @param loanId The ID of the loan
     * @return uint256 Stored totalDue amount
     */
    function calculateTotalDue(uint256 loanId) external view returns (uint256) {
        Loan memory loan = loans[loanId];
        require(loan.loanId != 0, "LoanManager: Loan does not exist");
        return loan.totalDue;
    }

    /**
     * @notice Returns current outstanding principal exposure (REQUESTED + ACTIVE) for a borrower
     * @param borrower The address to query
     * @return uint256 Cumulative outstanding principal
     */
    function getOutstandingPrincipal(address borrower) external view returns (uint256) {
        return outstandingPrincipal[borrower];
    }

    /**
     * @notice Returns remaining available borrowing power for a borrower
     * @dev max(borrowingLimit - outstandingPrincipal, 0)
     * @param borrower The address to query
     * @return uint256 Available borrowing capacity
     */
    function getAvailableBorrowingPower(address borrower) public view returns (uint256) {
        uint256 limit = creditRegistry.getBorrowingLimit(borrower);
        uint256 outstanding = outstandingPrincipal[borrower];
        if (outstanding >= limit) {
            return 0;
        }
        return limit - outstanding;
    }

    /**
     * @notice Request an unsecured loan within current available borrowing power
     * @dev Strictly enforces onchain borrowing capacity accounting for outstanding exposure.
     *      Creates loan in REQUESTED state. Does NOT call CreditRegistry.recordLoan() here.
     * @param principal Requested principal in MockUSDC (6 decimals)
     * @param interestRateBps Annual interest rate in basis points [1, 2000]
     * @param duration Loan duration in seconds [1 day, 365 days]
     * @return uint256 Assigned loanId
     */
    function createLoan(
        uint256 principal,
        uint256 interestRateBps,
        uint256 duration
    ) external nonReentrant returns (uint256) {
        require(principal > 0, "LoanManager: Principal must be greater than zero");
        require(duration > 0, "LoanManager: Duration must be greater than zero");
        require(duration >= MIN_DURATION, "LoanManager: Duration below minimum (1 day)");
        require(duration <= MAX_DURATION, "LoanManager: Duration exceeds maximum (365 days)");
        require(interestRateBps >= MIN_INTEREST_RATE_BPS, "LoanManager: Interest rate below minimum (1 bps)");
        require(interestRateBps <= MAX_INTEREST_RATE_BPS, "LoanManager: Interest rate exceeds maximum (2000 bps)");

        // CRITICAL INVARIANT: Outstanding exposure enforcement
        uint256 availablePower = getAvailableBorrowingPower(msg.sender);
        require(
            principal <= availablePower,
            "LoanManager: Requested amount exceeds onchain borrowing limit"
        );

        // Immediately reserve borrowing exposure so concurrent requests cannot exceed limit
        outstandingPrincipal[msg.sender] += principal;

        loanCounter += 1;
        uint256 newLoanId = loanCounter;

        uint256 totalDue = calculateTotalDue(principal, interestRateBps, duration);
        uint256 estimatedDueDate = block.timestamp + duration;

        loans[newLoanId] = Loan({
            loanId: newLoanId,
            borrower: msg.sender,
            lender: address(0),
            principal: principal,
            interestRateBps: interestRateBps,
            duration: duration,
            totalDue: totalDue,
            createdAt: block.timestamp,
            dueDate: estimatedDueDate,
            status: LoanStatus.REQUESTED
        });

        emit LoanCreated(
            newLoanId,
            msg.sender,
            principal,
            interestRateBps,
            duration,
            totalDue,
            estimatedDueDate
        );

        return newLoanId;
    }

    /**
     * @notice Fund an open loan request
     * @dev Transitions loan directly from REQUESTED -> ACTIVE.
     *      Instructs LendingPool to transfer funds from lender to borrower.
     *      Calls CreditRegistry.recordLoan() only after successful transfer.
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
        loan.dueDate = block.timestamp + loan.duration;

        // Execute token transfer via LendingPool: Lender -> Borrower
        lendingPool.transferFunds(msg.sender, loan.borrower, loan.principal);

        // Record loan in CreditRegistry only after successful funding
        creditRegistry.recordLoan(loan.borrower, loan.principal);

        emit LoanFunded(loanId, msg.sender, loan.borrower, loan.principal, loan.dueDate);
    }

    /**
     * @notice Repay an active loan
     * @dev Transitions loan directly from ACTIVE -> REPAID.
     *      Transfers totalDue via LendingPool: Borrower -> Lender.
     *      Determines repayment classification (EARLY, ON_TIME, LATE) and updates CreditRegistry.
     * @param loanId The ID of the loan to repay
     */
    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];

        require(loan.loanId != 0, "LoanManager: Loan does not exist");
        require(loan.status == LoanStatus.ACTIVE, "LoanManager: Loan is not in ACTIVE state");
        require(msg.sender == loan.borrower, "LoanManager: Only the borrower can repay this loan");

        RepaymentType repType;
        bool onTime;
        bool early;

        if (block.timestamp < loan.dueDate) {
            // Early repayment (before dueDate) -> +70 points
            repType = RepaymentType.EARLY;
            onTime = true;
            early = true;
        } else if (block.timestamp <= loan.dueDate + DEFAULT_GRACE_PERIOD) {
            // On-time repayment (within grace period) -> +50 points
            repType = RepaymentType.ON_TIME;
            onTime = true;
            early = false;
        } else {
            // Late repayment (after grace period but still ACTIVE) -> -40 points
            repType = RepaymentType.LATE;
            onTime = false;
            early = false;
        }

        // Transition State: ACTIVE -> REPAID
        loan.status = LoanStatus.REPAID;

        // Release borrowing exposure
        outstandingPrincipal[loan.borrower] -= loan.principal;

        // Execute repayment transfer via LendingPool: Borrower -> Lender
        lendingPool.executeRepayment(loan.borrower, loan.lender, loan.totalDue);

        // Update credit score in CreditRegistry
        creditRegistry.recordRepayment(loan.borrower, loan.principal, onTime, early);

        emit LoanRepaid(
            loanId,
            loan.borrower,
            loan.lender,
            loan.principal,
            loan.totalDue,
            repType
        );
    }

    /**
     * @notice Mark an overdue loan as defaulted
     * @dev Transitions loan directly from ACTIVE -> DEFAULTED.
     *      Callable by anyone after dueDate + DEFAULT_GRACE_PERIOD has elapsed.
     *      Releases outstanding borrowing exposure and penalizes CreditRegistry score by -150.
     * @param loanId The ID of the loan to default
     */
    function markDefault(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];

        require(loan.loanId != 0, "LoanManager: Loan does not exist");
        require(loan.status == LoanStatus.ACTIVE, "LoanManager: Loan is not in ACTIVE state");
        require(
            block.timestamp > loan.dueDate + DEFAULT_GRACE_PERIOD,
            "LoanManager: Loan is not past due date plus grace period"
        );

        // Transition State: ACTIVE -> DEFAULTED
        loan.status = LoanStatus.DEFAULTED;

        // Release borrowing exposure
        outstandingPrincipal[loan.borrower] -= loan.principal;

        // Penalize credit profile in CreditRegistry
        creditRegistry.recordDefault(loan.borrower, loan.principal);

        emit LoanDefaulted(loanId, loan.borrower, loan.lender, loan.principal);
    }

    /**
     * @notice Retrieve full loan details
     * @param loanId The ID of the loan
     * @return Loan memory struct
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        require(loans[loanId].loanId != 0, "LoanManager: Loan does not exist");
        return loans[loanId];
    }
}
