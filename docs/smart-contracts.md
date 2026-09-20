# Smart Contract Architecture & Specifications

## Core Contracts

1. **`MockUSDC.sol`**:
   - Standard ERC20 with 6 decimals (matching real USDC conventions).
   - Public faucet function `faucet(address to, uint256 amount)` with safety caps for hackathon testing.
   - Standard `approve`, `transfer`, `transferFrom`.

2. **`CreditRegistry.sol`**:
   - Maintains `CreditProfile` mapping per address:
     - `score` (uint256, initial 500, min 300, max 850)
     - `loansTaken` (uint256)
     - `loansRepaid` (uint256)
     - `defaults` (uint256)
     - `totalBorrowed` (uint256)
     - `totalRepaid` (uint256)
   - Scoring rules:
     - Base score: 500
     - On-time repayment: +50
     - Early repayment: +20 bonus
     - Late repayment: -40
     - Default: -150
   - Authorized callers: Only `LoanManager` can record loan events.

3. **`LoanManager.sol`**:
   - Manages loan lifecycle: `REQUESTED`, `FUNDED`, `ACTIVE`, `REPAID`, `DEFAULTED`.
   - Validates state transitions, prevents double funding or double repayment.
   - Coordinates with `CreditRegistry` and `LendingPool`.

4. **`LendingPool.sol`**:
   - Holds custody during transit or handles safe ERC20 movements.
   - Moves MockUSDC from Lender to Borrower upon funding.
   - Moves MockUSDC from Borrower to Lender + protocol upon repayment.
