# CrediFi Architecture Specification

## 1. System Overview

CrediFi separates responsibilities between the immutable blockchain layer and the query/indexing layer:

1. **Decentralized Settlement Layer (Ethereum Sepolia)**:
   - Contains all financial state, logic, rules, and token balances.
   - Enforces credit rules and undercollateralized limits deterministically.
   - Authorizes token transfers between lenders, pools, and borrowers.

2. **Application & Indexing Layer (Node.js/Express + MongoDB)**:
   - Receives events via Alchemy webhooks.
   - Verifies HMAC-SHA256 signatures before parsing.
   - Processes events idempotently using the compound key `(chainId, transactionHash, logIndex)`.
   - Caches loan states, credit updates, and transaction logs for low-latency queries and Recharts protocol analytics.

3. **Presentation Layer (React + Vite + Tailwind CSS)**:
   - Reads directly from smart contracts via RPC for immediate onchain state (credit score, borrowing limit, loan status, token balance).
   - Uses the backend REST API for transaction histories, filtered lists, and aggregate metrics.
   - Interacts with MetaMask via `ethers.js v6`.

---

## 2. High-Level Architecture

```
                         USER
                           │
                        MetaMask
                           │
                           ▼
                  React Frontend (Vite + Tailwind)
                           │
                        ethers.js v6
                           │
                           ▼
                    Sepolia Network
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        CreditRegistry  LoanManager  LendingPool
                           │            │
                           │            ▼
                           │        MockUSDC
                           │
                           ▼
                       Events
              (LoanCreated, LoanFunded, LoanRepaid,
               LoanDefaulted, CreditProfileUpdated)
                           │
                           ▼
                   Alchemy Webhook
                           │
                           ▼
                   POST /api/webhooks/alchemy
                   (Signature Verified)
                           │
                           ▼
                       Express
                           │
                           ▼
                       MongoDB
                   (Idempotent Cache)
                           │
                           ▼
                       REST API
                           │
                           ▼
                    React Analytics (Recharts)
```

---

## 3. Smart Contract Hierarchy & Responsibilities

```
LoanManager (Protocol Orchestrator)
 ├── calls CreditRegistry (Credit History & Scoring)
 └── calls LendingPool (Token Custody & Transfer Execution)
        └── interacts with MockUSDC (Test ERC20 Asset)
```

- **`LoanManager`**: Protocol orchestrator. Determines and validates all loan states. Enforces that requested loan amounts do not exceed onchain borrowing limits.
- **`LendingPool`**: Token movement layer. Executes safe token transfers (Lender -> Borrower upon funding, Borrower -> Lender upon repayment). Does **not** independently determine loan lifecycle state.
- **`CreditRegistry`**: Credit history layer. Maintains borrower profiles and calculates borrowing limits. State mutations are strictly restricted to `onlyLoanManager`.
- **`MockUSDC`**: Test ERC20 token with a demo faucet. Agnostic to loans and credit scoring.

---

## 4. Event-Driven Webhook Pipeline

```
[Contract State Transition]
         │
         ▼
[Solidity Event Emitted] (LoanCreated, LoanFunded, LoanRepaid, LoanDefaulted)
         │
         ▼
[Alchemy Webhook Delivery]
         │
         ▼
[POST /api/webhooks/alchemy]
         │
         ├── 1. Verify HMAC-SHA256 Signature (x-alchemy-signature)
         ├── 2. Parse Event (chainId, txHash, logIndex, args)
         ├── 3. Check Idempotency Key (chainId + txHash + logIndex)
         └── 4. Atomic Update in MongoDB & Recalculate ProtocolStats
```
