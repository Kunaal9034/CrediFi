# CrediFi — Unsecured Credit-Based Lending on Ethereum

> **Project:** CrediFi  
> **Tagline:** *"Onchain Credit. Credit-Based Lending. (0% Collateral)"*  
> **Hackathon:** Hack in Hills '26  
> **Network:** Ethereum Sepolia Testnet (Chain ID: `11155111`)  
> **Classification:** Hackathon Release Candidate / Protocol Prototype  

--

## 1. Executive Summary

**CrediFi** is a decentralized, peer-to-peer, credit-based lending protocol built on Ethereum Sepolia. 

Unlike traditional DeFi protocols that mandate 150%+ overcollateralization, CrediFi enables borrowers to request **unsecured loans with 0% collateral**, gated entirely by deterministic, onchain credit scores and borrowing limits managed by autonomous smart contracts.

---

## 2. Problem Statement

1. **Capital Inefficiency in DeFi**: Protocols like Aave and Compound require 120%–150% overcollateralization. This model serves leverage traders and margin speculators, but completely locks out small businesses, everyday borrowers, and capital-constrained builders who need productive liquidity.
2. **Centralized Credit Bureau Monopolies**: Legacy bureaus (Equifax, Experian, TransUnion) are opaque, geographically restricted, slow, and prone to identity theft and database breaches.
3. **Pseudo-Decentralized Credit Workarounds**: Many Web3 credit experiments rely on centralized offchain credit APIs or black-box offchain AI scoring, compromising decentralization and self-sovereignty.

---

## 3. The CrediFi Solution

- **0% Collateral Credit-Based Loans**: Borrowers access liquidity purely against verifiable onchain repayment reputation and transparent credit limits.
- **Deterministic Smart Contract Scoring**: Credit scores (scaled 300 to 850) and borrowing capacity are calculated entirely onchain within `CreditRegistry.sol`.
- **Blockchain as the Sole Financial Source of Truth**: All token transfers, debt obligations, balances, and loan status transitions are enforced by smart contracts on Ethereum Sepolia.
- **Peer-to-Peer Marketplace**: Lenders review open loan requests onchain, evaluate transparent borrower credit histories, and fund loans directly through `LendingPool.sol` to earn real fixed APR yields.
- **High-Performance Read/Indexing Layer**: Alchemy custom webhooks stream verified onchain events to an idempotent Express + MongoDB caching layer, driving instant search, filtering, and rich protocol analytics without compromising onchain authority.

---

## 4. Architecture & Data Flow

```
                         BORROWER / LENDER
                                │
                             MetaMask
                                │
                                ▼
                       React 18 Frontend
                     (Vite + Tailwind CSS)
                                │
                          ethers.js v6
                                │
                                ▼
                ETHEREUM SEPOLIA (SOURCE OF TRUTH)
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
      CreditRegistry       LoanManager         LendingPool
   (Score & Tier Logic)  (State Machine)    (Token Custody)
            ▲                   │                   │
            │                   ▼                   ▼
    onlyLoanManager        Emits Events         MockUSDC
                                │                (mUSDC)
                                ▼
                         Alchemy Webhook
                      (Custom Event Stream)
                                │
                                ▼
                     POST /api/webhooks/alchemy
                    (HMAC-SHA256 Signature Check)
                                │
                                ▼
                        Express Backend
                     (Chain & Event Guards)
                                │
                                ▼
                       MongoDB Database
                 (Idempotent Read/Analytics Cache)
                                │
                                ▼
                      REST APIs & Analytics
                    (Recharts Data Dashboards)
```

### Protocol Source-of-Truth Hierarchy
1. **Ethereum Blockchain (Tier 1 - Authority)**: Financial balances, debt terms, loan states, and credit updates reside in contract storage. If any offchain service fails, users interact directly with the contracts.
2. **Alchemy Webhooks (Tier 2 - Event Transport)**: Cryptographically verified push notifications for mined contract events.
3. **MongoDB + Express (Tier 3 - Query Cache)**: Read-only indexing engine for fast UI filtering, historical pagination, and aggregate analytics.

---

## 5. Smart Contract Architecture

CrediFi's smart contracts adhere to OpenZeppelin security standards, the Checks-Effects-Interactions pattern, and strict role-based access control.

```
                  ┌──────────────────────┐
                  │     LoanManager      │
                  │ (Protocol Controller)│
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌──────────────────┐              ┌──────────────────┐
   │  CreditRegistry  │              │   LendingPool    │
   │ (Credit Scoring) │              │ (Custody & Flow) │
   └──────────────────┘              └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │     MockUSDC     │
                                     │  (ERC20 Token)   │
                                     └──────────────────┘
```

### Contract Responsibilities

| Contract | Address (Sepolia) | Purpose |
| :--- | :--- | :--- |
| **`MockUSDC.sol`** | [`0xfaaF91778853F35FB7Db545dc3586aFc354103d0`](https://sepolia.etherscan.io/address/0xfaaF91778853F35FB7Db545dc3586aFc354103d0) | 6-decimal test ERC20 token with a 10,000 mUSDC faucet limit for testing. |
| **`CreditRegistry.sol`** | [`0x9b117D9528c43Fb2938e43172b1935f38F2C6f90`](https://sepolia.etherscan.io/address/0x9b117D9528c43Fb2938e43172b1935f38F2C6f90) | Computes credit scores (300–850) and borrowing capacity. All state-mutating functions are restricted by `onlyLoanManager`. |
| **`LendingPool.sol`** | [`0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5`](https://sepolia.etherscan.io/address/0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5) | Handles token custody, disbursements, and repayments using `SafeERC20` and `ReentrancyGuard`. Caller must be `onlyLoanManager`. |
| **`LoanManager.sol`** | [`0x21b39401646D783690E3902C90963c711Ff7cC1C`](https://sepolia.etherscan.io/address/0x21b39401646D783690E3902C90963c711Ff7cC1C) | Orchestrates the entire loan lifecycle: creation, funding, repayment, and default trigger. Enforces borrowing power constraints onchain. |

---

## 6. Credit Scoring & Borrowing Power System

The credit engine in `CreditRegistry.sol` runs 100% onchain with pure integer arithmetic:

### Score Ranges & Limits
- **Scale**: 300 to 850 (inspired by the classic FICO range).
- **Default Baseline (New Wallets)**: `500` score → **$1,000.00 mUSDC** borrowing limit.
- **Score Tiers & Borrowing Power**:
  - `300 – 499`: $0 – $500 mUSDC limit (High Risk / Subprime)
  - `500 – 579`: $1,000 mUSDC limit (Neutral / Baseline)
  - `580 – 669`: $2,500 mUSDC limit (Fair)
  - `670 – 739`: $5,000 mUSDC limit (Good)
  - `740 – 799`: $10,000 mUSDC limit (Very Good)
  - `800 – 850`: $25,000 mUSDC limit (Exceptional / Prime)

### Score Mutation Rules
- **On-Time Repayment**: +30 points (+ bonus points for consecutive on-time streaks).
- **Late Repayment (Within Grace Period)**: -50 points.
- **Default (Unpaid After Grace Period)**: Immediate drop to 300 points floor, permanent flag `hasDefaulted = true`, and total revocation of future borrowing privileges.

---

## 7. Loan Lifecycle & Financial Mechanics

Each loan transitions through a deterministic state machine:

```
[ REQUESTED ] ──(Lender Funds Loan)──► [ ACTIVE ] ──(Borrower Repays)──► [ REPAID ]
      │                                    │
(Borrower Cancels)                         │ (Due Date + Grace Period Passes)
      │                                    ▼
      ▼                              [ DEFAULTED ]
 [ CANCELLED ]
```

1. **Request**: Borrower specifies Principal, APR (1 bps to 2000 bps / 20%), and Duration (1 day to 365 days). Contract enforces that `principal + activeBorrowerExposure <= borrowingLimit`.
2. **Funding**: Any external lender (self-funding is forbidden) approves mUSDC and calls `fundLoan(loanId)`. LendingPool transfers principal directly to the borrower.
3. **Repayment**: Borrower approves total repayment amount (`principal + accruedInterest`) and calls `repayLoan(loanId)`. LendingPool routes funds back to the lender, and LoanManager notifies CreditRegistry to update the borrower's score.
4. **Default Handling**: If the loan remains unpaid after `dueDate + GRACE_PERIOD (7 days)`, any address can call `triggerDefault(loanId)`. The contract flags the default, locks the borrower's credit score at 300, and records the default onchain.

### Interest Calculation Formula
All interest calculations use strict integer arithmetic with zero floating-point imprecision:
$$\text{Interest} = \frac{\text{Principal} \times \text{InterestRateBps} \times \text{Duration}}{\text{BPS\_DIVISOR} \times \text{SECONDS\_PER\_YEAR}} = \frac{P \times r \times t}{10,000 \times 31,536,000}$$

---

## 8. Backend & Webhook Architecture

- **Endpoint**: `POST /api/webhooks/alchemy`
- **Security**:
  - HMAC-SHA256 signature verification via `x-alchemy-signature` header using `crypto.timingSafeEqual` (timing-attack resistant).
  - Chain ID validation (`11155111`).
  - Contract address allowlisting (discards events from unauthorized contracts).
  - Event topic filtering (`LoanCreated`, `LoanFunded`, `LoanRepaid`, `LoanDefaulted`, `CreditScoreUpdated`).
- **Idempotency**: Indexed events use a compound unique index on `(transactionHash, logIndex)` to guarantee zero duplicate database writes if Alchemy redelivers a webhook.
- **Admin Backfill**: `POST /api/admin/backfill` protected by `ADMIN_SECRET` to replay all contract events from block zero to rebuild or sync the database cache.

---

## 9. Technology Stack

- **Smart Contracts**: Solidity `^0.8.20`, Hardhat, OpenZeppelin Contracts v5
- **Network**: Ethereum Sepolia (`chainId: 11155111`)
- **Web3 Libraries**: ethers.js v6
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide Icons, React Router v6
- **Backend**: Node.js, Express, Mongoose, Helmet, CORS, dotenv
- **Database**: MongoDB (Local or MongoDB Atlas)
- **Indexing & RPC**: Alchemy Sepolia RPC & Custom Webhook Pipelines

---

## 10. Local Setup & Quick Start

### Prerequisites
- Node.js v18+ and npm
- MongoDB running locally (`mongodb://localhost:27017/credifi`) or a remote MongoDB Atlas URI
- MetaMask browser extension with Sepolia testnet configured

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/Kunaal9034/JusticeVault.git credifi
cd credifi

# Install root, contract, backend, and frontend dependencies
npm install
npm --prefix contracts install
npm --prefix backend install
npm --prefix frontend install
```

### 2. Environment Configuration
Copy `.env.example` templates in root, `backend/`, and `frontend/`:
```bash
# Backend configuration (backend/.env)
PORT=5001
MONGO_URI=mongodb://localhost:27017/credifi
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
CHAIN_ID=11155111
ADMIN_SECRET=YOUR_SECURE_ADMIN_SECRET
ALCHEMY_WEBHOOK_SIGNING_KEY=YOUR_SIGNING_KEY
MOCK_USDC_ADDRESS=0xfaaF91778853F35FB7Db545dc3586aFc354103d0
CREDIT_REGISTRY_ADDRESS=0x9b117D9528c43Fb2938e43172b1935f38F2C6f90
LENDING_POOL_ADDRESS=0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5
LOAN_MANAGER_ADDRESS=0x21b39401646D783690E3902C90963c711Ff7cC1C

# Frontend configuration (frontend/.env)
VITE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
VITE_CHAIN_ID=11155111
VITE_API_URL=http://localhost:5001/api
VITE_MOCK_USDC_ADDRESS=0xfaaF91778853F35FB7Db545dc3586aFc354103d0
VITE_CREDIT_REGISTRY_ADDRESS=0x9b117D9528c43Fb2938e43172b1935f38F2C6f90
VITE_LENDING_POOL_ADDRESS=0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5
VITE_LOAN_MANAGER_ADDRESS=0x21b39401646D783690E3902C90963c711Ff7cC1C
```

### 3. Run Development Servers
```bash
# Start backend API (Port 5001)
npm run dev:backend

# Start frontend development server (Port 5173)
npm run dev:frontend
```

---

## 11. Testing & Verification

CrediFi includes comprehensive multi-tier test suites across smart contracts, backend APIs, and end-to-end integration:

```bash
# Run complete test suite (Contracts + Backend)
npm run test:all

# Run contract unit and integration tests (170 tests)
npm --prefix contracts test

# Run backend API and webhook security tests (31 tests)
npm --prefix backend test

# Run full-stack E2E verification
npm run verify:e2e

# Build frontend production bundle
npm --prefix frontend run build
```

---

## 12. Live Demo Script

See [`docs/demo.md`](file:///docs/demo.md) for the complete step-by-step 3–5 minute presentation playbook.

### Quick Demo Walkthrough
1. **Connect Borrower Wallet**: View baseline credit score (500) and $1,000 borrowing power on `/credit`.
2. **Attempt Over-Limit Loan**: Try requesting a $2,000 loan on `/borrow`. The UI and contract simulation safely reject the transaction.
3. **Request Valid Loan**: Submit a request for $500 mUSDC at 10% APR for 30 days.
4. **Switch to Lender Wallet**: Connect a second wallet, navigate to `/lend`, approve mUSDC, and fund the loan.
5. **Repay Loan**: Switch back to the borrower, navigate to `/my-loans`, and repay the loan with interest.
6. **Verify Score Boost**: Observe the borrower's credit score immediately rise to 530 and borrowing power increase to $1,600 mUSDC.
7. **Verify on Etherscan**: Inspect the onchain transactions and events on Sepolia Etherscan.

---

## 13. Project Roadmap

- [x] **Phase 1: Project Setup & Monorepo Foundation**
- [x] **Phase 2: MockUSDC Token Contract**
- [x] **Phase 3: CreditRegistry Scoring Engine**
- [x] **Phase 4: LoanManager State Machine**
- [x] **Phase 5: LendingPool Custody Layer**
- [x] **Phase 6: Contract Security & Unit Testing (170 tests)**
- [x] **Phase 7: Ethereum Sepolia Testnet Deployment**
- [x] **Phase 8: Frontend Web3 Integration & Custom Hooks**
- [x] **Phase 9: Borrower Loan Request Flow**
- [x] **Phase 10: Peer-to-Peer Lender Funding Flow**
- [x] **Phase 11: Repayment & Onchain Credit Boost**
- [x] **Phase 12: Late Repayment, Grace Period & Default Handlers**
- [x] **Phase 13: Alchemy Webhooks & Idempotent Event Indexer**
- [x] **Phase 14: Protocol Analytics & Recharts Dashboards**
- [x] **Phase 15: Full-Stack E2E Verification & Integration**
- [x] **Phase 16: Security Audit, Demo Polish & Release Freeze**

---

## 14. Known Limitations & Disclaimers

> [!CAUTION]
> **Hackathon Prototype Notice**: CrediFi is an educational prototype engineered for **Hack in Hills '26**.
> - **Testnet Only**: Deployed exclusively on Ethereum Sepolia using test `mUSDC`.
> - **Unaudited**: While smart contracts adhere strictly to OpenZeppelin best practices and pass 170 tests, they have not undergone an external third-party security audit.
> - **Sybil Resistance**: Production deployment would require decentralized identity (e.g. World ID, Gitcoin Passport, or ENS) to prevent multi-wallet address recycling.
> - **No Legal Debt Recovery**: In this prototype, default consequences are strictly protocol-native (onchain credit collapse, loss of borrowing power, and permanent default record). It does not include offchain legal recourse or collateral seizure.
