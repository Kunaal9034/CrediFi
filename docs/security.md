# Security Specifications & Threat Model

## 1. Smart Contract Protections
- **Reentrancy Protection**: Use OpenZeppelin `ReentrancyGuard` on fund and repayment functions in `LendingPool` and `LoanManager`.
- **Access Control**: Strict `onlyLoanManager` modifiers on `CreditRegistry` to ensure credit profiles cannot be tampered with by arbitrary addresses.
- **Safe Token Transfers**: Use OpenZeppelin `SafeERC20` (`safeTransfer`, `safeTransferFrom`) for standard ERC20 compatibility and reversion on failed transfers.
- **State Transition Invariants**:
  - A loan can only be funded if status == `REQUESTED`.
  - A loan can only be repaid if status == `ACTIVE`.
  - Double funding and double repayments are strictly impossible.
- **Integer Safety**: Solidity `^0.8.20` default arithmetic overflow/underflow checks.

## 2. Webhook & API Security
- **Alchemy Signature Verification**: Validate `x-alchemy-signature` with HMAC-SHA256.
- **Idempotent Ingestion**: Unique compound index on `(transactionHash, logIndex)` in MongoDB prevents replay attacks or duplicate event logs.
- **Secret Hygiene**: Zero private keys or server secrets in frontend bundles or git.
