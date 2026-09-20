# CrediFi Architecture Specification

## 1. System Overview

CrediFi separates responsibilities between the immutable blockchain layer and the query/indexing layer:

1. **Decentralized Settlement Layer (Ethereum Sepolia)**:
   - Contains all financial state, logic, rules, and token balances.
   - Enforces credit rules deterministically.
   - Authorizes token transfers between lenders, pools, and borrowers.

2. **Application & Indexing Layer (Node.js/Express + MongoDB)**:
   - Receives events via Alchemy webhooks.
   - Processes events idempotently using `(transactionHash, logIndex)`.
   - Caches loan states, credit updates, and transaction logs for low-latency queries and Recharts protocol analytics.

3. **Presentation Layer (React + Vite + Tailwind CSS)**:
   - Reads directly from smart contracts for immediate onchain state (credit score, borrowing limit, loan status, token balance).
   - Uses the backend REST API for transaction histories, filtered lists, and aggregate metrics.
   - Interacts with MetaMask via `ethers.js v6`.

## 2. Event-Driven Pipeline

```
[Contract State Transition]
         │
         ▼
[Solidity Event Emitted] (e.g. LoanCreated, LoanFunded, LoanRepaid)
         │
         ▼
[Alchemy Webhook Delivery]
         │
         ▼
[POST /api/webhooks/alchemy]
         │
         ├── Check Signature (HMAC SHA-256)
         ├── Check Idempotency Key (txHash + logIndex)
         └── Store / Update MongoDB Collections
```
