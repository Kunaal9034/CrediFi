# CrediFi — Hackathon Judge Q&A & Technical Defense

This document provides concise, technically rigorous answers to critical architectural, financial, and security questions about CrediFi.

---

### 1. Why blockchain?
Traditional credit markets suffer from opaque proprietary scoring, regional fragmentation, high origination overhead, and platform lock-in. A public blockchain provides an immutable, transparent, and portable financial identity. Financial contracts, lending pools, and repayment histories run permissionlessly without relying on centralized intermediaries.

---

### 2. Why not traditional lending?
Traditional unsecured lending excludes roughly 1.4 billion unbanked or underbanked individuals worldwide who lack legacy credit bureau footprints. It requires invasive KYC, paper documentation, and weeks of underwriting. CrediFi provides global, programmatic, 24/7 access to peer-to-peer capital with instant settlement and transparent rules.

---

### 3. How is credit score calculated?
Credit scores are computed deterministically onchain within `CreditRegistry.sol` on an integer scale from **300 (minimum/defaulted) to 850 (maximum)**:
- **Baseline score**: 500 for new borrowers.
- **On-time repayment**: +30 points.
- **Consecutive streak bonus**: Additional bonus points for consecutive on-time repayments.
- **Late repayment** (within grace period): -50 points.
- **Default** (unpaid after grace period): Immediate collapse to 300 points and total revocation of borrowing privileges.

---

### 4. Can the borrower manipulate their score?
**No.** Borrowers cannot self-fund loans to wash-trade credit points. `LoanManager.sol` enforces `require(msg.sender != loan.borrower)` at the contract level. Additionally, borrowing limit expansion is capped per tier, and active + requested exposure is subtracted from available borrowing power, preventing rapid synthetic volume inflation.

---

### 5. Who controls the score?
**Only the smart contracts.** In `CreditRegistry.sol`, state-mutating functions (`recordRepayment`, `recordLateRepayment`, `recordDefault`) are strictly protected by the `onlyLoanManager` modifier. Neither the protocol admin, backend servers, nor any external user can arbitrarily modify or forge a user's credit score.

---

### 6. Can the frontend bypass borrowing limits?
**No.** The frontend only performs preliminary validation for user feedback. `LoanManager.sol` independently calls `creditRegistry.calculateBorrowingLimit(borrower)` during `requestLoan` and reverts with `"LoanManager: Borrower cannot exceed borrowing limit"` if `principal + activeBorrowerExposure > limit`.

---

### 7. What prevents double funding?
`LoanManager.sol` uses strict state machine validation and the Checks-Effects-Interactions pattern. When `fundLoan(loanId)` is invoked, the contract checks `require(loan.status == LoanStatus.REQUESTED)`. Upon valid execution, `loan.status` is immediately updated to `LoanStatus.ACTIVE` before token transfers occur. Subsequent funding attempts will revert.

---

### 8. What prevents double repayment?
`repayLoan(loanId)` checks `require(loan.status == LoanStatus.ACTIVE)` and verifies `msg.sender == loan.borrower`. Upon repayment, `loan.status` is transitioned to `LoanStatus.REPAID`. Any re-invocation of `repayLoan` on that `loanId` reverts immediately.

---

### 9. What happens on default?
If a loan passes its due date plus the grace period (7 days) without repayment, anyone can call `triggerDefault(loanId)`. The smart contract:
1. Transitions loan status to `DEFAULTED`.
2. Calls `CreditRegistry.recordDefault()`, which drops the borrower's score to the 300 floor.
3. Sets `hasDefaulted = true`, permanently locking the borrower out of creating any new loan requests.

---

### 10. Why no collateral?
Existing DeFi lending protocols (e.g. Aave, Compound) require 120%–150% overcollateralization, functioning primarily as leverage tools for crypto-rich traders rather than capital access for productive borrowing. CrediFi introduces true unsecured P2P credit where reputation, skin-in-the-game credit limits, and verifiable repayment history replace capital lockup.

---

### 11. Why MongoDB if blockchain is the source of truth?
Directly querying Ethereum archive nodes for multi-filter UI queries (e.g. searching loans by status, sorting by APR, aggregating user historical stats) has high latency and RPC rate limits. MongoDB acts strictly as a **read cache / indexing layer** populated by verified onchain events. If MongoDB ever disagrees with the blockchain, **the blockchain always wins**.

---

### 12. Why Alchemy?
Alchemy provides enterprise-grade Ethereum RPC infrastructure and webhook pipelines (`Custom Webhooks`). Alchemy notifies the CrediFi backend whenever `MockUSDC`, `LoanManager`, or `CreditRegistry` emit events, enabling near-instant UI synchronization without expensive polling.

---

### 13. Why Sepolia?
Sepolia is the primary recommended Ethereum testnet with active client diversity, accurate EIP-1559 gas mechanics, and identical EVM execution to Ethereum Mainnet. It allows full fidelity end-to-end testing of contract calls, event emissions, and wallet interactions without real-money risk.

---

### 14. How does the system scale?
- **Onchain**: Contracts are written in lightweight, gas-optimized Solidity with minimal storage slots and zero external loop operations.
- **Layer 2 / Rollup Readiness**: CrediFi can deploy unchanged to Arbitrum, Optimism, Base, or Polygon for sub-cent transaction fees.
- **Offchain**: Event-driven backend microservice architecture with indexed MongoDB collections scales horizontally to support thousands of queries per second.

---

### 15. What happens if the backend goes down?
**The protocol remains 100% operational.** The frontend includes direct Web3 contract fallback. Borrowers can still request loans, lenders can still fund, and borrowers can still repay directly through MetaMask interacting with the smart contracts. Only offchain analytics and search filtering are temporarily degraded.

---

### 16. What happens if MongoDB is wrong?
MongoDB holds zero financial custody or authorization power. All financial transfers, allowances, and balances exist solely on Ethereum. If the database becomes corrupt or out of sync, the administrator can invoke the idempotent `POST /api/admin/backfill` endpoint to replay all historical events directly from the blockchain to restore state.

---

### 17. What happens if a webhook is delivered twice?
The backend webhook handler in `backend/src/routes/webhooks.js` implements strict **idempotency**:
- Events are tracked by their unique compound transaction hash and log index (`transactionHash + logIndex`).
- If an event has already been processed, it is safely acknowledged and discarded without re-applying state changes or corrupting records.

---

### 18. How is the system secured?
- **Smart Contracts**: OpenZeppelin `ReentrancyGuard`, `Ownable`, and `SafeERC20`. Strict Checks-Effects-Interactions, 0% collateral state machine constraints, and integer math without floating-point risks.
- **Access Control**: Lending pool token movement restricted exclusively to authorized `LoanManager`.
- **Backend**: HMAC-SHA256 signature verification with constant-time comparison (`crypto.timingSafeEqual`) on Alchemy webhooks, chain ID validation, contract address allowlisting, and `ADMIN_SECRET` protected backfill.

---

### 19. Where is AI used?
CrediFi's core financial and credit decisions are **100% deterministic smart contracts** to guarantee complete fairness, auditability, and decentralization. Optional AI capabilities (if enabled) are strictly non-custodial: providing natural language market insights or summarizing loan parameters without altering financial rules.

---

### 20. What would be added for mainnet?
1. **Multi-Asset Support**: Real USDC, USDT, and DAI lending pools.
2. **Layer 2 Deployment**: Primary deployment on Base or Arbitrum for $0.01 gas fees.
3. **Sybil Resistance / DID**: Integration with World ID, Gitcoin Passport, or ENS to prevent multiple identity creation.
4. **Decentralized Oracles & Governance**: Chainlink price feeds and DAO governance for interest rate curves.
5. **Secondary Market**: Tokenized loan notes (ERC-721 / ERC-1155) allowing lenders to trade active debt positions for early liquidity.
