# Security Specifications & Threat Model

## 1. Smart Contract Protections
- **Undercollateralized Limit Gate (Onchain Enforced)**:
  `LoanManager.createLoan()` queries `CreditRegistry.getBorrowingLimit(msg.sender)` and reverts onchain if `requestedAmount > borrowingLimit`. The blockchain contract is the sole and final authority.
- **Access Control (`onlyLoanManager`)**:
  - `CreditRegistry` mutations (`recordLoan`, `recordRepayment`, `recordDefault`) can only be invoked by the authorized `LoanManager` contract.
  - `LendingPool` transfer functions (`transferFunds`, `executeRepayment`) can only be invoked by the authorized `LoanManager` contract.
- **Reentrancy Protection**:
  OpenZeppelin `ReentrancyGuard` applied on external token movement functions in `LendingPool`.
- **Safe Token Operations**:
  OpenZeppelin `SafeERC20` (`safeTransfer`, `safeTransferFrom`) ensures compliance with ERC20 standard and automatic revert on failed transfers.
- **State Transition Invariants**:
  Every state transition is checked against the state transition matrix. Double funding and double repayment revert unconditionally.

---

## 2. Webhook & Indexer Security
- **Alchemy Signature Verification**:
  All incoming requests to `POST /api/webhooks/alchemy` must be signed with HMAC-SHA256 using `process.env.ALCHEMY_WEBHOOK_SIGNING_KEY`.
  ```javascript
  const hmac = crypto.createHmac('sha256', process.env.ALCHEMY_WEBHOOK_SIGNING_KEY);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  if (digest !== req.headers['x-alchemy-signature']) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  ```
- **Triple-Key Idempotency**:
  Events are indexed using a compound unique index on `{ chainId: 1, transactionHash: 1, logIndex: 1 }` in MongoDB.
  - First delivery: Event parsed and processed.
  - Duplicate delivery: Caught by unique index query, returning 200 OK ("Event already processed") without duplicate record creation.

---

## 3. Prototype Limitations & Threat Model Disclaimers

> [!CAUTION]
> **Hackathon Prototype Notice**: CrediFi is an educational prototype built for **Hack in Hills '26**.
> - Contracts have not undergone a commercial security audit.
> - Operates exclusively with test MockUSDC on Ethereum Sepolia.
> - Simplified heuristic credit scoring; does not check off-chain credit bureaus.
> - Proof-of-concept operates per-wallet without full Sybil resistance.
