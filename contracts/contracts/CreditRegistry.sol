// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CreditRegistry
 * @notice Protocol-native onchain credit registry for CrediFi (Hack in Hills '26).
 * @dev Maintains deterministic credit profiles and computes borrowing limits.
 *      Does NOT move ERC20 tokens. Does not depend on MockUSDC or LendingPool.
 *      Mutation functions are strictly restricted to the authorized LoanManager address.
 */
contract CreditRegistry is Ownable {
    // Credit Score Bounds & Defaults
    uint256 public constant MIN_SCORE = 300;
    uint256 public constant BASE_SCORE = 500;
    uint256 public constant MAX_SCORE = 850;

    // Deterministic Score Adjustments
    uint256 public constant SCORE_ON_TIME_REPAY = 50;
    uint256 public constant SCORE_EARLY_BONUS = 20; // 50 + 20 = 70 for early repayment
    uint256 public constant SCORE_LATE_PENALTY = 40;
    uint256 public constant SCORE_DEFAULT_PENALTY = 150;

    // Borrowing Limit Parameters (6 decimals matching MockUSDC)
    uint256 public constant BASE_LIMIT = 500e6; // 500 MockUSDC ($500.00)
    uint256 public constant SUBPRIME_SCORE_CUTOFF = 350;

    // Authorized protocol orchestrator
    address public loanManager;

    /**
     * @notice Borrower credit profile structure
     * @param score Current credit score [300, 850]
     * @param totalLoans Total number of loans taken by the borrower
     * @param repaidLoans Number of loans successfully repaid
     * @param defaultedLoans Number of loans defaulted
     * @param totalBorrowed Cumulative principal borrowed in token base units
     * @param totalRepaid Cumulative principal repaid in token base units
     * @param lastUpdated Timestamp of the most recent profile modification
     * @param initialized Flag indicating if the profile has been initialized
     */
    struct CreditProfile {
        uint256 score;
        uint256 totalLoans;
        uint256 repaidLoans;
        uint256 defaultedLoans;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 lastUpdated;
        bool initialized;
    }

    mapping(address => CreditProfile) private profiles;

    /// @notice Emitted when the authorized LoanManager address is updated
    event LoanManagerUpdated(address indexed previousManager, address indexed newManager);

    /// @notice Emitted when a borrower's credit score or borrowing power is updated
    event CreditProfileUpdated(address indexed borrower, uint256 score, uint256 borrowingLimit);

    /// @notice Emitted when a new loan is recorded
    event LoanRecorded(address indexed borrower, uint256 principal, uint256 totalBorrowed);

    /// @notice Emitted when a loan repayment is recorded
    event RepaymentRecorded(address indexed borrower, uint256 principal, uint256 newScore);

    /// @notice Emitted when a loan default is recorded
    event DefaultRecorded(address indexed borrower, uint256 principal, uint256 newScore);

    /**
     * @dev Restricts caller to the configured LoanManager address
     */
    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "CreditRegistry: Caller is not authorized LoanManager");
        _;
    }

    /**
     * @notice Initializes CreditRegistry with deployer as initial owner
     * @param initialOwner The address of the contract owner
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Set or update the authorized LoanManager contract address
     * @dev Only callable by the contract owner. Rejects zero address.
     * @param _loanManager Address of the deployed LoanManager contract
     */
    function setLoanManager(address _loanManager) external onlyOwner {
        require(_loanManager != address(0), "CreditRegistry: Invalid LoanManager address");
        address prev = loanManager;
        loanManager = _loanManager;
        emit LoanManagerUpdated(prev, _loanManager);
    }

    /**
     * @notice Returns the credit score for a borrower (defaults to 500 if uninitialized)
     * @param borrower The address to query
     * @return uint256 The borrower's credit score between 300 and 850
     */
    function getCreditScore(address borrower) public view returns (uint256) {
        if (!profiles[borrower].initialized) {
            return BASE_SCORE;
        }
        return profiles[borrower].score;
    }

    /**
     * @notice Deterministically calculates maximum borrowing limit in token base units (6 decimals)
     * @dev Formula: BASE_LIMIT * creditScore / BASE_SCORE.
     *      Score < 350: returns 0.
     *      Score 500: 500e6 (500 USDC)
     *      Score 570: 570e6 (570 USDC)
     *      Score 640: 640e6 (640 USDC)
     *      Score 850: 850e6 (850 USDC)
     * @param borrower The address to calculate borrowing power for
     * @return uint256 Maximum borrowing limit in base units
     */
    function getBorrowingLimit(address borrower) public view returns (uint256) {
        uint256 score = getCreditScore(borrower);

        if (score < SUBPRIME_SCORE_CUTOFF) {
            return 0;
        }

        return (BASE_LIMIT * score) / BASE_SCORE;
    }

    /**
     * @notice Retrieve complete credit profile for an address
     * @param borrower The address to query
     * @return CreditProfile memory Full profile data
     */
    function getProfile(address borrower) public view returns (CreditProfile memory) {
        CreditProfile memory profile = profiles[borrower];
        if (!profile.initialized) {
            profile.score = BASE_SCORE;
            profile.initialized = true;
        }
        return profile;
    }

    /**
     * @notice Backwards-compatible alias for getProfile
     * @param borrower The address to query
     * @return CreditProfile memory Full profile data
     */
    function getCreditProfile(address borrower) external view returns (CreditProfile memory) {
        return getProfile(borrower);
    }

    /**
     * @notice Record a newly funded loan against borrower history
     * @dev Callable only by authorized LoanManager. Does not modify score.
     * @param borrower The borrower address
     * @param principal The borrowed principal amount in token base units
     */
    function recordLoan(address borrower, uint256 principal) external onlyLoanManager {
        require(borrower != address(0), "CreditRegistry: Invalid borrower");
        require(principal > 0, "CreditRegistry: Invalid principal");

        _ensureInitialized(borrower);
        profiles[borrower].totalLoans += 1;
        profiles[borrower].totalBorrowed += principal;
        profiles[borrower].lastUpdated = block.timestamp;

        emit LoanRecorded(borrower, principal, profiles[borrower].totalBorrowed);
    }

    /**
     * @notice Record a loan repayment and deterministically update score
     * @dev Callable only by authorized LoanManager.
     *      Early: +70 (50 on-time + 20 early bonus)
     *      On-time: +50
     *      Late: -40
     * @param borrower The borrower address
     * @param principal The repaid principal amount
     * @param onTime True if repaid on or before due date
     * @param early True if repaid early (bonus applies)
     */
    function recordRepayment(
        address borrower,
        uint256 principal,
        bool onTime,
        bool early
    ) external onlyLoanManager {
        require(borrower != address(0), "CreditRegistry: Invalid borrower");
        require(principal > 0, "CreditRegistry: Invalid principal");

        _ensureInitialized(borrower);
        profiles[borrower].repaidLoans += 1;
        profiles[borrower].totalRepaid += principal;
        profiles[borrower].lastUpdated = block.timestamp;

        uint256 currentScore = profiles[borrower].score;
        uint256 newScore;

        if (onTime) {
            uint256 bonus = early ? (SCORE_ON_TIME_REPAY + SCORE_EARLY_BONUS) : SCORE_ON_TIME_REPAY;
            newScore = currentScore + bonus;
            if (newScore > MAX_SCORE) {
                newScore = MAX_SCORE;
            }
        } else {
            // Late repayment penalty (-40)
            if (currentScore > MIN_SCORE + SCORE_LATE_PENALTY) {
                newScore = currentScore - SCORE_LATE_PENALTY;
            } else {
                newScore = MIN_SCORE;
            }
        }

        profiles[borrower].score = newScore;
        uint256 newLimit = getBorrowingLimit(borrower);

        emit RepaymentRecorded(borrower, principal, newScore);
        emit CreditProfileUpdated(borrower, newScore, newLimit);
    }

    /**
     * @notice Record a loan default and penalize borrower credit score by 150 points
     * @dev Callable only by authorized LoanManager. Clamped at MIN_SCORE (300).
     * @param borrower The borrower address
     * @param principal The defaulted loan principal amount
     */
    function recordDefault(address borrower, uint256 principal) external onlyLoanManager {
        require(borrower != address(0), "CreditRegistry: Invalid borrower");
        require(principal > 0, "CreditRegistry: Invalid principal");

        _ensureInitialized(borrower);
        profiles[borrower].defaultedLoans += 1;
        profiles[borrower].lastUpdated = block.timestamp;

        uint256 currentScore = profiles[borrower].score;
        uint256 newScore;

        if (currentScore > MIN_SCORE + SCORE_DEFAULT_PENALTY) {
            newScore = currentScore - SCORE_DEFAULT_PENALTY;
        } else {
            newScore = MIN_SCORE;
        }

        profiles[borrower].score = newScore;
        uint256 newLimit = getBorrowingLimit(borrower);

        emit DefaultRecorded(borrower, principal, newScore);
        emit CreditProfileUpdated(borrower, newScore, newLimit);
    }

    /**
     * @dev Lazily initializes borrower profile with base score of 500
     */
    function _ensureInitialized(address borrower) internal {
        if (!profiles[borrower].initialized) {
            profiles[borrower].score = BASE_SCORE;
            profiles[borrower].initialized = true;
            profiles[borrower].lastUpdated = block.timestamp;
        }
    }
}
