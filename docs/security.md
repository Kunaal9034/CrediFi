# CrediFi Security Architecture & Threat Model

**Project:** ArcTech presents CrediFi  
**Tagline:** "Onchain Credit. Undercollateralized Lending."  
**Hackathon:** Hack in Hills '26  
**Audited Contracts:** `MockUSDC.sol`, `CreditRegistry.sol`, `LoanManager.sol`, `LendingPool.sol`

---

## 1. Core Security Architecture & Trust Boundaries

CrediFi adheres to a strict hierarchical separation of concerns across four onchain contracts:

```
                  LoanManager (Protocol Orchestrator)
                 /           \
                ↓             ↓
       CreditRegistry     LendingPool (Token Movement Layer)
                              ↓
                           MockUSDC
```

### Trust Boundary Principles
1. **Blockchain is the Sole Financial Source of Truth**: All financial balances, loan states, credit scores, borrowing power calculations, and debt accounting occur exclusively onchain.
2. **MongoDB / Backend is Strictly an Indexed Cache**: The offchain database serves only for accelerated queries, historical timelines, and analytics. It cannot mutate protocol state or override onchain rules.
3. **Frontend Validation is Not a Security Boundary**: All client-side checks (UI limits, input formatting) are purely UX enhancements. Every invariant is re-enforced deterministically by Solidity smart contracts.

---

## 2. Smart Contract Responsibilities & Access Control

| Contract | Responsibility | Modifying Permissions | Access Control Implementation |
|---|---|---|---|
| **`MockUSDC.sol`** | ERC20 test token | Anyone (via capped faucet) | `require(amount <= 10_000e6)` |
| **`CreditRegistry.sol`** | Credit score & borrowing limit calculation | `onlyLoanManager` strictly | `require(msg.sender == loanManager)` |
| **`LoanManager.sol`** | Loan lifecycle & financial state machine | Borrowers (create/repay), Lenders (fund), Anyone (default after grace period) | Function-level caller validation + `ReentrancyGuard` |
| **`LendingPool.sol`** | Direct token movement execution | `onlyLoanManager` strictly | `require(msg.sender == loanManager)` + `ReentrancyGuard` |

### Privileged Admin Operations
- **`CreditRegistry.setLoanManager`**: Restricted to `onlyOwner`, rejects zero address (`address(0)`).
- **`LendingPool.setLoanManager` / `setToken`**: Restricted to `onlyOwner`, rejects zero address (`address(0)`).
- **`LoanManager.setProtocolContracts` / `setCreditRegistry` / `setLendingPool`**: Restricted to `onlyOwner`, rejects zero address (`address(0)`).
- **Zero-address configuration**: Disallowed in both constructors and administrative setters.

---

## 3. Financial Invariants & Protection Mechanisms

### Invariant 1: Cumulative Borrowing Capacity Gate
A borrower cannot exceed their onchain borrowing limit across simultaneous or sequential loans.
- `outstandingPrincipal[borrower]` tracks the cumulative sum of `REQUESTED` and `ACTIVE` principal.
- New loans must strictly satisfy:
  $$\text{principal} \le \text{getAvailableBorrowingPower}(\text{borrower}) = \max(\text{limit} - \text{outstandingPrincipal}, 0)$$
- Capacity is reserved immediately at `createLoan()`.
- Funding does not add exposure again.
- Settling a loan (`repayLoan()` or `markDefault()`) releases capacity.
- **Attack Prevented**: A borrower with a 500 USDC limit cannot bypass the limit by requesting multiple concurrent loans (e.g., $300 + 200 + 1$ USDC).

### Invariant 2: Deterministic Credit Score Boundaries
- Credit score strictly bounded between `MIN_SCORE = 300` and `MAX_SCORE = 850`.
- New borrowers initialize lazily at `BASE_SCORE = 500` ($500.00$ USDC limit).
- Repayments before due date: $+70$ points.
- Repayments on-time within grace period: $+50$ points.
- Late repayments: $-40$ points.
- Default: $-150$ points.
- **Subprime Cutoff**: Any score $< 350$ yields a borrowing limit of exactly $0$ USDC.

### Invariant 3: Strict 4-State Lifecycle Machine
The state machine enforces exact linear progression without intermediate states:
$$\text{REQUESTED} \xrightarrow{\text{fundLoan()}} \text{ACTIVE} \xrightarrow{\text{repayLoan()}} \text{REPAID}$$
$$\text{ACTIVE} \xrightarrow{\text{markDefault()}} \text{DEFAULTED}$$
- All 9 forbidden state transitions (e.g. `REQUESTED -> REPAID`, `REPAID -> ACTIVE`, `DEFAULTED -> REPAID`, double funding, double repayment, double default) revert unconditionally.

### Invariant 4: Timestamp & Grace Period Rules
- `DEFAULT_GRACE_PERIOD = 1 days` (86,400 seconds).
- Repayment classifications:
  - `EARLY`: `block.timestamp < dueDate` ($+70$ pts)
  - `ON_TIME`: `dueDate <= block.timestamp <= dueDate + DEFAULT_GRACE_PERIOD` ($+50$ pts)
  - `LATE`: `block.timestamp > dueDate + DEFAULT_GRACE_PERIOD` ($-40$ pts, if repaid before default)
- Default condition: Only callable when `block.timestamp > dueDate + DEFAULT_GRACE_PERIOD`. Reverts if called before or during grace period.

### Invariant 5: Direct Token Movement & Zero Pool Custody
- Users approve `LendingPool` directly:
  - Lender: `approve(LendingPool, principal)`
  - Borrower: `approve(LendingPool, totalDue)`
- `LendingPool` uses OpenZeppelin `SafeERC20.safeTransferFrom`:
  - Funding: Directly from `Lender -> Borrower`.
  - Repayment: Directly from `Borrower -> Lender`.
- `LendingPool` token balance is strictly $0$ base units before, during, and after transfers. No protocol custody risk or lockup.

### Invariant 6: Failure Atomicity
- All state-changing methods execute atomically.
- If token transfer fails (e.g. insufficient allowance or insufficient balance), the entire transaction rolls back.
- No partial state updates: loan remains in its initial state, exposure remains unchanged, and credit score is unaffected.

### Invariant 7: Reentrancy Protection
- OpenZeppelin `ReentrancyGuard` (`nonReentrant` modifier) protects all external state-changing entry points in `LoanManager` (`createLoan`, `fundLoan`, `repayLoan`, `markDefault`) and `LendingPool` (`transferFunds`, `executeRepayment`).
- Reentrant callbacks from malicious tokens or recipient hooks revert with `ReentrancyGuardReentrantCall()`.

---

## 4. Unsecured Lending Model (Model A)

CrediFi operates pure reputation-based undercollateralized lending:
- **Zero Collateral**: No collateral tokens are pledged, deposited, or held.
- **No Liquidation**: There are no collateral liquidations, liquidation auctions, or liquidation bonuses.
- **No Price Oracles**: Borrowing power and repayments are denominated in MockUSDC (pegged 1:1 to USD). No Chainlink price feed dependencies exist for collateral valuation.
- **Default Consequence**: Defaults permanently penalize onchain credit score ($-150$ pts) and contract borrowing limits.

---

## 5. Webhook & Offchain Indexer Security

- **HMAC-SHA256 Signature Verification**: Inbound Alchemy webhooks at `POST /api/webhooks/alchemy` are verified against `process.env.ALCHEMY_WEBHOOK_SIGNING_KEY`. Unsigned or tampered payloads return HTTP 401.
- **Triple-Key Idempotency**: MongoDB enforces a compound unique index on `{ chainId: 1, transactionHash: 1, logIndex: 1 }` to prevent duplicate event ingestion.

---

## 6. Known Protocol Limitations (Hackathon Prototype)

> [!WARNING]
> CrediFi is an educational hackathon prototype built for **Hack in Hills '26**. The following limitations are documented by design:
> 1. **Testnet Assets**: Operates exclusively with test `MockUSDC` on Ethereum Sepolia / local Hardhat.
> 2. **Unsecured Debt Enforcement**: Enforced strictly by onchain reputation and borrowing-power clamping, not by offchain legal debt recovery.
> 3. **Heuristic Scoring Model**: Protocol uses deterministic rules-based scoring ($+70/+50/-40/-150$); it does not integrate real-world credit bureaus (Equifax, Experian).
> 4. **No Sybil Resistance**: Credit history is per-wallet. Real-world deployment would require WorldID, Gitcoin Passport, or KYC credentials.
> 5. **Commercial Audit**: Contracts have been rigorously unit and integration tested (159 passing tests), but have not undergone a commercial third-party security audit.
