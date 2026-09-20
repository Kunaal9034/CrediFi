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
   - Public faucet function `faucet(address to, uint256 amount)` with safety caps for hackathon demo testing.
   - Standard `approve`, `transfer`, `transferFrom`.
   - Zero awareness of loans, credit scores, or pools.

2. **`CreditRegistry.sol`**:
   - Maintains `CreditProfile` mapping per address:
     - `score` (uint256, initial 500, min 300, max 850)
     - `loansTaken` (uint256)
     - `loansRepaid` (uint256)
     - `defaults` (uint256)
     - `totalBorrowed` (uint256)
     - `totalRepaid` (uint256)
   - Scoring rules (configurable hackathon parameters):
     - Base score: `500`
     - On-time repayment: `+50`
     - Early repayment bonus: `+20`
     - Late repayment penalty: `-40`
     - Default penalty: `-150`
   - Access Control: Mutations restricted strictly to `onlyLoanManager`:
     - `recordLoan(address borrower, uint256 amount) external onlyLoanManager`
     - `recordRepayment(address borrower, uint256 amount, bool onTime, bool early) external onlyLoanManager`
     - `recordDefault(address borrower) external onlyLoanManager`
   - Public view functions:
     - `getCreditScore(address borrower) external view returns (uint256)`
     - `getBorrowingLimit(address borrower) external view returns (uint256)`
     - `getCreditProfile(address borrower) external view returns (CreditProfile memory)`

3. **`LoanManager.sol`**:
   - Protocol orchestrator. Determines and validates all loan states.
   - **Enforces Undercollateralized Borrowing Limit Onchain:**
     ```solidity
     uint256 limit = creditRegistry.getBorrowingLimit(msg.sender);
     require(amount <= limit, "LoanManager: Requested amount exceeds onchain borrowing limit");
     ```
   - Lifecycle functions:
     - `createLoan(uint256 amount, uint256 duration, uint256 interestRate)`: Validates amount <= borrowing limit; emits `LoanCreated`.
     - `fundLoan(uint256 loanId)`: Transitions `REQUESTED -> ACTIVE`; triggers `LendingPool.transferFunds()`; emits `LoanFunded`.
     - `repayLoan(uint256 loanId)`: Transitions `ACTIVE -> REPAID`; triggers `LendingPool.executeRepayment()`; updates credit via `CreditRegistry.recordRepayment()`; emits `LoanRepaid`.
     - `markDefault(uint256 loanId)`: Transitions `ACTIVE -> DEFAULTED`; updates credit via `CreditRegistry.recordDefault()`; emits `LoanDefaulted`.

4. **`LendingPool.sol`**:
   - Handles actual token movement.
   - Protected with OpenZeppelin `SafeERC20` and `ReentrancyGuard`.
   - Mutation functions restricted to `onlyLoanManager`:
     - `transferFunds(address lender, address borrower, uint256 amount)`
     - `executeRepayment(address borrower, address lender, uint256 totalDue)`
   - Does **not** independently determine loan lifecycle state.

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
