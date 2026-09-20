# REST API & Webhook Specifications

## Endpoints

### 1. Health Check
`GET /api/health`
Response:
```json
{
  "status": "ok",
  "service": "CrediFi Backend API",
  "timestamp": "2026-09-20T13:50:00Z"
}
```

### 2. User Profile
`GET /api/users/:wallet`
Returns indexed user profile, aggregate statistics, and transaction count.

### 3. Loans
- `GET /api/loans`: Returns list of loans (supports filtering by status `REQUESTED`, `ACTIVE`, `REPAID`, `DEFAULTED`).
- `GET /api/loans/user/:wallet`: Returns all loans where the wallet is either borrower or lender.
- `GET /api/loans/:loanId`: Returns specific loan details.

### 4. Transactions
`GET /api/transactions/:wallet`
Returns historical indexed transactions and events associated with a wallet.

### 5. Analytics
`GET /api/analytics`
Returns aggregate protocol metrics: total users, total loans, total volume, active/completed/defaulted loans, repayment rate, average loan amount, average interest rate.

### 6. Alchemy Webhook
`POST /api/webhooks/alchemy`
Receives emitted smart contract logs, verifies signature, deduplicates via `(transactionHash, logIndex)`, and updates the database.
