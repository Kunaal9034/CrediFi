# Smart Contract Architecture & Specifications

## 1. Hierarchy & Relationships

```
LoanManager (Protocol Orchestrator)
 ├── calls CreditRegistry (State & Authorization Gated)
 └── calls LendingPool (Token Custody & Transfer Execution)
        └── interacts with MockUSDC (Test ERC20)
```

1. **`MockUSDC.sol`**:
   - Standard ERC20 with 6 decimals (matching real USDC conventions).
   - Initial supply: 0 units.
   - Public faucet function `faucet(address to, uint256 amount)` with safety cap of 10,000 mUSDC ($10,000 \times 10^6$ base units) per claim, emitting `FaucetMinted(address indexed to, uint256 amount)`.
   - Standard `approve`, `transfer`, `transferFrom`.
   - Zero awareness of loans, credit scores, or pools.

2. **`CreditRegistry.sol`**:
   - Maintains `CreditProfile` mapping per address:
     - `score` (uint256, initial 500, min 300, max 850)
     - `totalLoans` (uint256)
     - `repaidLoans` (uint256)
     - `defaultedLoans` (uint256)
     - `totalBorrowed` (uint256)
     - `totalRepaid` (uint256)
     - `lastUpdated` (uint256)
   - Scoring rules (deterministic integer arithmetic):
     - Base score: `500`
     - On-time repayment: `+50`
     - Early repayment bonus: `+20` (total `+70`)
     - Late repayment penalty: `-40`
     - Default penalty: `-150`
     - Clamped to $[300, 850]$.
   - Borrowing Limit Formula (Deterministic, 6 decimals):
     $$ \text{borrowingLimit} = \frac{\text{BASE\_LIMIT} \times \text{creditScore}}{\text{BASE\_SCORE}} $$
     - `BASE_SCORE` = 500, `BASE_LIMIT` = $500 \times 10^6$ units ($500.00$ MockUSDC)
     - If `creditScore < 350`, `borrowingLimit = 0` (delinquent borrower cutoff).
     - Score 500: $500.00$ MockUSDC ($500 \times 10^6$ units)
     - Score 570: $570.00$ MockUSDC ($570 \times 10^6$ units)
     - Score 640: $640.00$ MockUSDC ($640 \times 10^6$ units)
     - Score 850: $850.00$ MockUSDC ($850 \times 10^6$ units)
   - Access Control: Mutations restricted strictly to `onlyLoanManager`:
     - `recordLoan(address borrower, uint256 principal) external onlyLoanManager`
     - `recordRepayment(address borrower, uint256 principal, bool onTime, bool early) external onlyLoanManager`
     - `recordDefault(address borrower, uint256 principal) external onlyLoanManager`
     - `setLoanManager(address _loanManager) external onlyOwner`
   - Events emitted:
     - `CreditProfileUpdated(address indexed borrower, uint256 score, uint256 borrowingLimit)`
     - `LoanRecorded(address indexed borrower, uint256 principal, uint256 totalBorrowed)`
     - `RepaymentRecorded(address indexed borrower, uint256 principal, uint256 newScore)`
     - `DefaultRecorded(address indexed borrower, uint256 principal, uint256 newScore)`
     - `LoanManagerUpdated(address indexed previousManager, address indexed newManager)`
   - Public view functions:
     - `getCreditScore(address borrower) external view returns (uint256)`
     - `getBorrowingLimit(address borrower) external view returns (uint256)`
     - `getProfile(address borrower) external view returns (CreditProfile memory)`
     - `getCreditProfile(address borrower) external view returns (CreditProfile memory)`

3. **`LoanManager.sol`**:
   - Protocol orchestrator and state machine. Enforces loan lifecycles, onchain borrowing capacity, rate/duration limits, and coordinates with `CreditRegistry` and `LendingPool`.
   - **Loan Structure (`Loan`):**
     - `uint256 loanId`: Deterministic sequence counter.
     - `address borrower`: Loan creator (`msg.sender`).
     - `address lender`: Funder address (set upon `fundLoan`).
     - `uint256 principal`: Borrowed base units in MockUSDC (6 decimals).
     - `uint256 interestRateBps`: Annualized simple interest rate [1, 2000] (0.01% - 20.00%).
     - `uint256 duration`: Loan duration in seconds [1 day, 365 days].
     - `uint256 totalDue`: Principal + computed annualized simple interest.
     - `uint256 createdAt`: Timestamp when loan request was created.
     - `uint256 dueDate`: Final due date timestamp (finalized upon funding as `block.timestamp + duration`).
     - `LoanStatus status`: Strict 4-state enum (`REQUESTED`, `ACTIVE`, `REPAID`, `DEFAULTED`).
   - **Onchain Borrowing-Capacity & Outstanding Debt Exposure:**
     - Tracks cumulative exposure per borrower: `mapping(address => uint256) public outstandingPrincipal;` (represents sum of `REQUESTED` and `ACTIVE` principal).
     - New loans must strictly satisfy:
       ```solidity
       uint256 availablePower = getAvailableBorrowingPower(msg.sender);
       require(principal <= availablePower, "LoanManager: Requested amount exceeds onchain borrowing limit");
       ```
     - Borrowers cannot bypass limits by submitting multiple concurrent `REQUESTED` loans; exposure is reserved immediately at `createLoan()`.
     - `fundLoan()` transitions to `ACTIVE` without adding exposure again.
     - `repayLoan()` and `markDefault()` release exposure (`outstandingPrincipal -= principal`).
   - **Exact Interest Formula (Solidity Integer Arithmetic):**
     ```solidity
     function calculateInterest(uint256 principal, uint256 interestRateBps, uint256 duration) public pure returns (uint256) {
         return (principal * interestRateBps * duration) / (365 days * 10000);
     }
     function calculateTotalDue(uint256 principal, uint256 interestRateBps, uint256 duration) public pure returns (uint256) {
         return principal + calculateInterest(principal, interestRateBps, duration);
     }
     ```
   - **Protocol Bounds & Constants:**
     - `MIN_INTEREST_RATE_BPS = 1` (0.01% min APR)
     - `MAX_INTEREST_RATE_BPS = 2000` (20.00% max APR)
     - `MIN_DURATION = 1 days` (86,400 seconds)
     - `MAX_DURATION = 365 days` (31,536,000 seconds)
     - `DEFAULT_GRACE_PERIOD = 1 days` (86,400 seconds)
   - **Repayment Classifications & Credit Timing:**
     - `EARLY` (`block.timestamp < dueDate`): Calls `CreditRegistry.recordRepayment(borrower, principal, true, true)` -> **+70 score points**.
     - `ON_TIME` (`dueDate <= block.timestamp <= dueDate + DEFAULT_GRACE_PERIOD`): Calls `CreditRegistry.recordRepayment(borrower, principal, true, false)` -> **+50 score points**.
     - `LATE` (`block.timestamp > dueDate + DEFAULT_GRACE_PERIOD` while still `ACTIVE`): Calls `CreditRegistry.recordRepayment(borrower, principal, false, false)` -> **-40 score points**.
   - **Default Mechanics:**
     - Callable by anyone once `block.timestamp > dueDate + DEFAULT_GRACE_PERIOD`.
     - Transitions `ACTIVE -> DEFAULTED`.
     - Releases outstanding debt exposure.
     - Calls `CreditRegistry.recordDefault(borrower, principal)` -> **-150 score penalty**.
     - Zero collateral, no liquidation (pure unsecured lending).
   - **Primary Protocol Events:**
     - `LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 interestRateBps, uint256 duration, uint256 totalDue, uint256 dueDate)`
     - `LoanFunded(uint256 indexed loanId, address indexed lender, address indexed borrower, uint256 principal, uint256 dueDate)`
     - `LoanRepaid(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 principal, uint256 totalDue, RepaymentType repaymentType)`
     - `LoanDefaulted(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 principal)`
     - `ProtocolContractsUpdated(address indexed creditRegistry, address indexed lendingPool)`
   - **Security & Access Control:**
     - Inherits OpenZeppelin `Ownable` and `ReentrancyGuard`.
     - External state-changing functions (`createLoan`, `fundLoan`, `repayLoan`, `markDefault`) protected by `nonReentrant`.
     - Zero-address validation in constructor and admin setters (`setProtocolContracts`, `setCreditRegistry`, `setLendingPool`).
     - Protocol contract configurations restricted to `onlyOwner`.

4. **`LendingPool.sol`**:
   - Protocol Token Movement & Custody Layer for CrediFi.
   - **Separation of Concerns:** LendingPool does **NOT** own protocol financial policy. `LoanManager` owns all loan state, lifecycle rules, interest formulas, and credit scoring integration. LendingPool is strictly an authorized token transfer executor.
   - **Token Movement Model:**
     - Uses OpenZeppelin `SafeERC20 for IERC20`.
     - Direct `safeTransferFrom` execution: tokens transfer directly between counterparties (`Lender -> Borrower` upon funding; `Borrower -> Lender` upon repayment) without requiring permanent pool custody or residual balances.
   - **Access Control:**
     - Protected by `onlyLoanManager` modifier: only the configured `LoanManager` address can call protocol transfer functions.
     - Unauthorized callers, lenders, borrowers, or arbitrary users attempting direct invocation strictly revert.
     - Admin address configuration (`setLoanManager`, `setToken`) is restricted strictly to contract `owner` (`onlyOwner`), and rejects zero addresses.
   - **Reentrancy Protection:**
     - Inherits OpenZeppelin `ReentrancyGuard`.
     - `transferFunds` and `executeRepayment` are protected by `nonReentrant`.
   - **Funding Flow:**
     1. Lender approves `LendingPool` directly: `MockUSDC.approve(LendingPool, principal)`.
     2. Lender invokes `LoanManager.fundLoan(loanId)`.
     3. `LoanManager` transitions loan to `ACTIVE` and calls `LendingPool.transferFunds(lender, borrower, principal)`.
     4. `LendingPool` executes `token.safeTransferFrom(lender, borrower, principal)`.
     5. Emits `FundsTransferred(lender, borrower, principal)` and `FundsDisbursed(lender, borrower, principal)`.
   - **Repayment Flow:**
     1. Borrower approves `LendingPool` directly: `MockUSDC.approve(LendingPool, totalDue)`.
     2. Borrower invokes `LoanManager.repayLoan(loanId)`.
     3. `LoanManager` validates repayment timing, transitions loan to `REPAID`, and calls `LendingPool.executeRepayment(borrower, lender, totalDue)`.
     4. `LendingPool` executes `token.safeTransferFrom(borrower, lender, totalDue)`.
     5. Emits `RepaymentExecuted(borrower, lender, totalDue)` and `RepaymentTransferred(borrower, lender, totalDue)`.
   - **Security Invariants & Non-Responsibilities:**
     - Only `LoanManager` can initiate transfers.
     - Zero lender or borrower addresses are rejected.
     - Zero amounts are rejected.
     - Self-funding (`lender == borrower`) and self-repayment (`borrower == lender`) are rejected.
     - Zero collateral: no collateral deposits, no collateral withdrawals, no liquidation, no liquidation auctions, no LTV ratios, no price oracles.
     - Contains no loan state, no interest calculation, no credit scoring, and no offchain database logic.

5. **Financial Mechanism Classification:**
   - **Model A: Credit-Based Unsecured Lending (Zero Collateral)**.
   - Borrowing capacity is governed strictly by onchain reputation and credit score.
   - Zero collateral is pledged, deposited, or locked.
   - No collateral liquidation or auction mechanisms exist.
   - Blockchain is the sole financial source of truth.

---

## 2. Loan Lifecycle & State Transition Matrix

### Lifecycle Diagram
```
REQUESTED ──────(fundLoan)──────► ACTIVE ──────(repayLoan)──────► REPAID
                                   │
                                   └─────────(markDefault)──────► DEFAULTED
```

*There is no separate `FUNDED` state. Calling `fundLoan()` transitions the loan directly from `REQUESTED` to `ACTIVE`.*

### State Transition Matrix

| Current State | Target State | Trigger Function | Allowed? | Rationale / Enforcement |
|---|---|---|---|---|
| `None` | `REQUESTED` | `createLoan()` | **ALLOWED** | Borrower requests loan within onchain credit limit. |
| `REQUESTED` | `ACTIVE` | `fundLoan()` | **ALLOWED** | Lender deposits MockUSDC; funds transfer to borrower. |
| `REQUESTED` | `REPAID` | Any | **FORBIDDEN** | Reverts: Loan cannot be repaid before it is funded. |
| `REQUESTED` | `DEFAULTED`| Any | **FORBIDDEN** | Reverts: Unfunded loan cannot default. |
| `ACTIVE` | `REPAID` | `repayLoan()` | **ALLOWED** | Borrower repays principal + interest; funds transfer to lender. |
| `ACTIVE` | `DEFAULTED`| `markDefault()`| **ALLOWED** | Due date exceeded without repayment; credit penalized onchain. |
| `REPAID` | `ACTIVE` | Any | **FORBIDDEN** | Reverts: Settled loan cannot be reactivated. |
| `REPAID` | `REPAID` | `repayLoan()` | **FORBIDDEN** | Reverts: Double repayment strictly blocked. |
| `DEFAULTED` | `ACTIVE` | Any | **FORBIDDEN** | Reverts: Defaulted loan cannot be reactivated. |
| `DEFAULTED` | `REPAID` | Any | **FORBIDDEN** | Reverts: Defaulted loan cannot be repaid. |
