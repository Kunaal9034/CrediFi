// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CreditRegistry
 * @notice Protocol-native onchain credit registry for CrediFi (Hack in Hills '26).
 * @dev Maintains deterministic credit profiles and borrowing power.
 *      Mutation functions are strictly restricted to the authorized LoanManager contract.
 */
contract CreditRegistry is Ownable {
    uint8 private constant TOKEN_DECIMALS = 6; // MockUSDC has 6 decimals

    // Configurable protocol scoring parameters
    uint256 public constant INITIAL_SCORE = 500;
    uint256 public constant MIN_SCORE = 300;
    uint256 public constant MAX_SCORE = 850;

    uint256 public repaymentBonus = 50;       // +50 on-time repayment
    uint256 public earlyRepaymentBonus = 20;  // +20 additional bonus for early repayment
    uint256 public latePenalty = 40;          // -40 late repayment penalty
    uint256 public defaultPenalty = 150;      // -150 default penalty

    // Authorized protocol orchestrator
    address public loanManager;

    struct CreditProfile {
        uint256 score;
        uint256 loansTaken;
        uint256 loansRepaid;
        uint256 defaults;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        bool initialized;
    }

    mapping(address => CreditProfile) private profiles;

    event LoanManagerUpdated(address indexed previousManager, address indexed newManager);
    event CreditProfileUpdated(address indexed borrower, uint256 oldScore, uint256 newScore, uint256 newLimit);
    event LoanRecorded(address indexed borrower, uint256 amount, uint256 totalBorrowed);
    event RepaymentRecorded(address indexed borrower, uint256 amount, bool onTime, bool early, uint256 newScore);
    event DefaultRecorded(address indexed borrower, uint256 newScore);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "CreditRegistry: Caller is not authorized LoanManager");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Set or update the authorized LoanManager contract
     * @param _loanManager Address of the deployed LoanManager contract
     */
    function setLoanManager(address _loanManager) external onlyOwner {
        require(_loanManager != address(0), "CreditRegistry: Invalid LoanManager address");
        address prev = loanManager;
        loanManager = _loanManager;
        emit LoanManagerUpdated(prev, _loanManager);
    }

    /**
     * @notice Retrieve borrower credit score (initializes to 500 if new)
     * @param borrower The address to query
     */
    function getCreditScore(address borrower) public view returns (uint256) {
        if (!profiles[borrower].initialized) {
            return INITIAL_SCORE;
        }
        return profiles[borrower].score;
    }

    /**
     * @notice Retrieve complete credit profile for an address
     * @param borrower The address to query
     */
    function getCreditProfile(address borrower) external view returns (CreditProfile memory) {
        CreditProfile memory profile = profiles[borrower];
        if (!profile.initialized) {
            profile.score = INITIAL_SCORE;
            profile.initialized = true;
        }
        return profile;
    }

    /**
     * @notice Deterministically calculates maximum borrowing limit in MockUSDC (6 decimals)
     * @dev Enforced by LoanManager.createLoan().
     *      Score 300: 0 USDC
     *      Score 301-499: Scale up to 490 USDC
     *      Score 500 (Base): 500 USDC
     *      Score 501-850: 500 USDC + 10 USDC per point above 500 (up to 4,000 USDC)
     * @param borrower The address to calculate borrowing power for
     */
    function getBorrowingLimit(address borrower) public view returns (uint256) {
        uint256 score = getCreditScore(borrower);

        if (score <= MIN_SCORE) {
            return 0;
        }

        uint256 oneToken = 10 ** TOKEN_DECIMALS;

        if (score < INITIAL_SCORE) {
            // Below 500: scaled linearly down from 500 to 0 between 500 and 300
            // Range = 200 points. limit = (score - 300) * 2.5 USDC
            uint256 pointsAboveMin = score - MIN_SCORE;
            return (pointsAboveMin * 5 * oneToken) / 2;
        } else {
            // Base 500 USDC + 10 USDC per point above 500
            uint256 pointsAboveBase = score - INITIAL_SCORE;
            return (500 * oneToken) + (pointsAboveBase * 10 * oneToken);
        }
    }

    /**
     * @notice Record a newly created/requested loan
     * @dev Callable only by authorized LoanManager
     * @param borrower The borrower address
     * @param amount The borrowed principal
     */
    function recordLoan(address borrower, uint256 amount) external onlyLoanManager {
        require(borrower != address(0), "CreditRegistry: Invalid borrower");
        require(amount > 0, "CreditRegistry: Invalid amount");

        _ensureInitialized(borrower);
        profiles[borrower].loansTaken += 1;
        profiles[borrower].totalBorrowed += amount;

        emit LoanRecorded(borrower, amount, profiles[borrower].totalBorrowed);
    }

    /**
     * @notice Record a loan repayment and deterministically update score
     * @dev Callable only by authorized LoanManager
     * @param borrower The borrower address
     * @param amount The repaid amount
     * @param onTime True if repaid on or before due date
     * @param early True if repaid well before due date (bonus applied)
     */
    function recordRepayment(
        address borrower,
        uint256 amount,
        bool onTime,
        bool early
    ) external onlyLoanManager {
        require(borrower != address(0), "CreditRegistry: Invalid borrower");

        _ensureInitialized(borrower);
        profiles[borrower].loansRepaid += 1;
        profiles[borrower].totalRepaid += amount;

        uint256 oldScore = profiles[borrower].score;
        uint256 newScore = oldScore;

        if (onTime) {
            newScore += repaymentBonus;
            if (early) {
                newScore += earlyRepaymentBonus;
            }
            if (newScore > MAX_SCORE) {
                newScore = MAX_SCORE;
            }
        } else {
            // Late repayment penalty
            if (newScore > MIN_SCORE + latePenalty) {
                newScore -= latePenalty;
            } else {
                newScore = MIN_SCORE;
            }
        }

        profiles[borrower].score = newScore;
        uint256 newLimit = getBorrowingLimit(borrower);

        emit RepaymentRecorded(borrower, amount, onTime, early, newScore);
        emit CreditProfileUpdated(borrower, oldScore, newScore, newLimit);
    }

    /**
     * @notice Record a loan default and heavily penalize credit score
     * @dev Callable only by authorized LoanManager
     * @param borrower The borrower address
     */
    function recordDefault(address borrower) external onlyLoanManager {
        require(borrower != address(0), "CreditRegistry: Invalid borrower");

        _ensureInitialized(borrower);
        profiles[borrower].defaults += 1;

        uint256 oldScore = profiles[borrower].score;
        uint256 newScore = oldScore;

        if (newScore > MIN_SCORE + defaultPenalty) {
            newScore -= defaultPenalty;
        } else {
            newScore = MIN_SCORE;
        }

        profiles[borrower].score = newScore;
        uint256 newLimit = getBorrowingLimit(borrower);

        emit DefaultRecorded(borrower, newScore);
        emit CreditProfileUpdated(borrower, oldScore, newScore, newLimit);
    }

    function _ensureInitialized(address borrower) internal {
        if (!profiles[borrower].initialized) {
            profiles[borrower].score = INITIAL_SCORE;
            profiles[borrower].initialized = true;
        }
    }
}
