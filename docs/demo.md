# CrediFi Live Demo Playbook (Hack in Hills '26)

**Protocol**: CrediFi — Unsecured Credit-Based Lending on Ethereum Sepolia  
**Target Duration**: 3 – 5 Minutes  
**Network**: Ethereum Sepolia (`chainId: 11155111`)  
**Source of Truth**: Ethereum Smart Contracts (MongoDB is strictly an indexed read cache)

---

## 1. Demo Prerequisites

- Google Chrome / Brave with MetaMask browser extension installed.
- Two distinct Ethereum addresses/accounts configured in MetaMask (e.g. "Borrower Account" and "Lender Account").
- Sepolia testnet ETH for gas in both wallets (~0.05 ETH each).
- Web application running locally (`http://localhost:5173`) or deployed production frontend.
- CrediFi backend running (`http://localhost:5001`) with MongoDB connection active.
- Alchemy Sepolia webhook tunnel active (or polling fallback enabled).

---

## 2. Wallets & Addresses Required

| Role | Suggested Name | Minimum Balance | Purpose |
| :--- | :--- | :--- | :--- |
| **Borrower Wallet** | `CrediFi Borrower` | ~0.02 Sepolia ETH | Connects, showcases initial credit score (500), requests loan, repays loan |
| **Lender Wallet** | `CrediFi Lender` | ~0.02 Sepolia ETH + 2,000 mUSDC | Inspects open marketplace, approves mUSDC, funds loan, earns yield |

---

## 3. Sepolia Network Setup

Ensure MetaMask is connected to **Sepolia**:
- **Network Name**: Sepolia
- **RPC URL**: `https://eth-sepolia.g.alchemy.com/v2/...` or public `https://rpc.sepolia.org`
- **Chain ID**: `11155111`
- **Currency Symbol**: `ETH`
- **Block Explorer**: `https://sepolia.etherscan.io`

### Deployed Contract Addresses
- **MockUSDC (`mUSDC`)**: [`0xfaaF91778853F35FB7Db545dc3586aFc354103d0`](https://sepolia.etherscan.io/address/0xfaaF91778853F35FB7Db545dc3586aFc354103d0)
- **CreditRegistry**: [`0x9b117D9528c43Fb2938e43172b1935f38F2C6f90`](https://sepolia.etherscan.io/address/0x9b117D9528c43Fb2938e43172b1935f38F2C6f90)
- **LendingPool**: [`0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5`](https://sepolia.etherscan.io/address/0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5)
- **LoanManager**: [`0x21b39401646D783690E3902C90963c711Ff7cC1C`](https://sepolia.etherscan.io/address/0x21b39401646D783690E3902C90963c711Ff7cC1C)

---

## 4. Faucet Instructions

Both wallets require testnet MockUSDC (`mUSDC`):
1. Connect wallet to CrediFi frontend.
2. Click the **"Claim 1,000 mUSDC Faucet"** button on the Navigation bar or Dashboard.
3. Confirm the onchain transaction (calls `MockUSDC.faucet(msg.sender, 1000 * 10^6)`).
4. Verify token balance increases by **1,000 mUSDC** directly in the header chip.

---

## 5. Demo Loan Parameters

| Parameter | Recommended Demo Value | Description |
| :--- | :--- | :--- |
| **Principal** | `500 mUSDC` | Well within a starting borrower's 1,000 mUSDC borrowing power |
| **APR** | `10.00%` (`1000 bps`) | Standard attractive fixed annual interest rate |
| **Duration** | `30 Days` (`2,592,000 s`) | Standard compliant loan duration |
| **Interest Due** | `~4.10 mUSDC` | Integer math: `(500 * 1000 * 30 days) / (10000 * 365 days)` |
| **Total Repayment** | `~504.10 mUSDC` | Principal + accrued interest settled to lender upon repayment |

---

## 6. Exact Demo Sequence (3–5 Minute Pitch)

### 0:00 – 0:30 | Problem Statement
- **Narrative**: *"In Web3 DeFi today, borrowing requires 150%+ collateral lockup. This excludes billions of creditworthy individuals and freezes capital efficiency. CrediFi introduces peer-to-peer unsecured, credit-based lending with zero collateral, driven entirely by onchain credit reputation and deterministic smart contracts."*

### 0:30 – 1:00 | Credit Dashboard
- Switch to **Borrower Wallet** in MetaMask.
- Navigate to `/credit` (Credit Profile) & `/dashboard`.
- **Showcase**:
  - Credit Score: `500` (Neutral baseline starting tier).
  - Borrowing Power: `$1,000.00 mUSDC`.
  - Zero active exposure.
  - Transparent onchain score algorithm formula: tier brackets from 300 to 850.

### 1:00 – 1:20 | Over-Limit Safety Demonstration (Contract Revert)
- Navigate to `/borrow`.
- In the Request Loan form:
  - Enter Principal: `2,000 mUSDC` (Exceeds $1,000 limit).
- Click **"Request Loan"**.
- **Expected UI Result**:
  - The UI highlights input in red: *"Requested principal exceeds your maximum borrowing power ($1,000.00)"*.
  - If pushed directly to contract: MetaMask prompts transaction simulation, transaction is immediately rejected with:  
    `Transaction reverted: Requested amount exceeds your active borrowing power`.
- **Key takeaway**: Smart contract enforces the borrowing power ceiling onchain—frontend limits cannot be bypassed.

### 1:20 – 2:00 | Valid Loan Request
- Enter valid demo values:
  - Principal: `500` mUSDC
  - APR: `10%`
  - Duration: `30` Days
- Click **"Request Loan"** & approve in MetaMask.
- **Expected UI Result**:
  - Transaction modal displays: `Submitting → Confirming → Success`.
  - Redirects to `/my-loans`.
  - Loan appears in `REQUESTED` state.
  - Borrower's remaining borrowing power immediately updates onchain to `$500.00 mUSDC` (preventing over-exposure).

### 2:00 – 2:30 | Lender Marketplace & Funding
- Switch MetaMask to **Lender Wallet**.
- Refresh or navigate to `/lend`.
- Open loan `#X` appears in the marketplace with 10% APR, 30 days duration, and borrower credit score 500.
- Click **"Fund Loan"**:
  - Step 1: Click **"Approve 500 mUSDC"** (sets ERC20 allowance on LendingPool).
  - Step 2: Click **"Confirm Funding"** (calls `LoanManager.fundLoan(loanId)`).
- **Expected UI Result**:
  - Loan moves from `REQUESTED` → `ACTIVE`.
  - 500 mUSDC is transferred directly from Lender to Borrower through `LendingPool`.
  - Borrower receives 500 mUSDC immediately.

### 2:30 – 3:00 | Borrower Repayment
- Switch MetaMask back to **Borrower Wallet**.
- Go to `/my-loans` → Click Loan Details.
- Total repayment due shows `~504.10 mUSDC`.
- Click **"Repay Loan"**:
  - Step 1: Approve `504.10 mUSDC` to LendingPool.
  - Step 2: Confirm `repayLoan(loanId)`.
- **Expected UI Result**:
  - Loan status transitions immediately to `REPAID`.
  - Funds return to Lender with earned interest yield.

### 3:00 – 3:30 | Credit Score Boost & Etherscan Verification
- Navigate to `/credit`.
- **Expected UI Result**:
  - Score increases from **500 → 530** (+30 points for successful on-time repayment).
  - Borrowing power expands from **$1,000 → $1,600 mUSDC**.
  - Repayment streak increments to `1`.
  - Repayment transaction is linked directly to Sepolia Etherscan:
    `https://sepolia.etherscan.io/tx/0x...`
- Point to the onchain `CreditRegistry` emitting `CreditScoreUpdated`.

### 3:30 – 4:30 | Architecture & Closing Statement
- Open `/analytics`.
- **Showcase**:
  - 100% real onchain-derived analytics (Total Volume, Active Loans, Repaid Loans, Default Rate: 0%).
- Conclude: *"CrediFi bridges the biggest missing primitive in DeFi: decentralized, unsecured credit where honest borrowers build verifiable reputation and lenders earn real yield."*

---

## 7. Contingency & Backup Plans

### A. MetaMask Network Lag / Congestion
- If Sepolia gas fluctuates or MetaMask stalls, ensure gas fee priority is set to "Market" or "Fast".
- Keep Sepolia Etherscan open in another tab to show confirmed state directly if the RPC provider is lagging.

### B. Indexer / Backend / MongoDB Interruption
- The CrediFi frontend is engineered with direct Web3 fallback:
  - If the backend REST API (`/api/loans`) is unavailable, `useContract` reads states directly from `LoanManager` onchain.
  - The UI will continue functioning for funding, repayment, and credit queries because **the blockchain is the sole financial authority**.

### C. Self-Funding Prevention
- If a presenter accidentally attempts to fund a loan with the borrower wallet, the contract cleanly reverts with `LoanManager: Borrower cannot fund their own loan` and the UI explains: *"Self-funding is prohibited"*. Switch accounts in MetaMask to proceed.
