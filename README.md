# CrediFi — Onchain Credit & Undercollateralized Lending

> **Project:** ArcTech presents CrediFi  
> **Tagline:** *"Onchain Credit. Undercollateralized Lending."*  
> **Hackathon:** Hack in Hills '26  
> **Network:** Ethereum Sepolia Testnet  
> **Classification:** Hackathon Prototype with production-oriented engineering practices.

---

## 1. Problem Statement

Decentralized Finance (DeFi) has historically suffered from extreme **overcollateralization** (often 150%–300%), locking massive amounts of idle capital and excluding retail borrowers, small businesses, and founders without liquid crypto wealth. 

Traditional credit bureaus (Equifax, Experian, TransUnion) are closed, regional, centralized, and opaque. Furthermore, existing DeFi credit solutions either rely on centralized off-chain credit APIs (compromising decentralization) or use opaque off-chain AI heuristics.

## 2. Solution

**CrediFi** introduces transparent, protocol-native onchain credit profiles and peer-to-peer undercollateralized lending.

- **Deterministic Onchain Credit Scoring:** Credit scores (starting at 500) and borrowing limits are computed directly onchain by `CreditRegistry.sol` based on verifiable loan repayment history.
- **Pure Smart Contract Financial Truth:** The Ethereum Sepolia blockchain is the immutable source of truth for all loan states, interest calculation, debt obligations, and credit updates.
- **Transparent Undercollateralized P2P Lending:** Borrowers request loans up to their credit limit without locking 150%+ collateral; lenders fund loans via `LendingPool.sol` earning protocol yields.
- **Idempotent Web3 Indexer & Analytics:** Alchemy webhooks stream confirmed contract events to an Express/MongoDB caching layer for lightning-fast marketplace browsing, transaction timelines, and protocol analytics.

---

## 3. Architecture

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

**Core Principle:**
- **Blockchain:** Sole financial source of truth.
- **MongoDB:** Strictly an indexed cache for fast queries and analytics. Never determines balances or financial state.
- **Alchemy:** Infrastructure for JSON-RPC reads and push webhook notifications.

---

## 4. Smart Contract Hierarchy & Responsibilities

```
LoanManager (Protocol Orchestrator)
 ├── calls CreditRegistry (State & Authorization Gated)
 └── calls LendingPool (Token Custody & Transfer Execution)
        └── interacts with MockUSDC (Test ERC20)
```

1. **`MockUSDC.sol`**: Standard ERC20 token (6 decimals) with a capped faucet (`faucet()`) for demo testing.
2. **`CreditRegistry.sol`**: Manages onchain credit profiles and computes borrowing limits deterministically. All score mutations (`recordLoan`, `recordRepayment`, `recordDefault`) are strictly protected by `onlyLoanManager`.
3. **`LoanManager.sol`**: Protocol orchestrator and state machine. **Enforces onchain undercollateralized borrowing limits in `createLoan()`** and enforces the 4-state lifecycle (`REQUESTED` -> `ACTIVE` -> `REPAID` or `DEFAULTED`).
4. **`LendingPool.sol`**: Token custody and movement layer (`SafeERC20`, `ReentrancyGuard`). Token disbursements and repayment transfers are triggered only by `onlyLoanManager`.

---

## 5. Technology Stack

- **Smart Contracts:** Solidity `^0.8.20`, Hardhat, OpenZeppelin Contracts v5 (ERC20, SafeERC20, ReentrancyGuard, Ownable)
- **Blockchain Network:** Ethereum Sepolia Testnet (Chain ID `11155111`)
- **Blockchain Infrastructure:** Alchemy JSON-RPC & Alchemy Custom Webhooks
- **Frontend:** React 18, Vite, Tailwind CSS, ethers.js v6, React Router v6, Recharts, Lucide Icons
- **Backend:** Node.js, Express, ethers.js v6, Mongoose, Helmet, CORS
- **Database:** MongoDB (Idempotent Event Log & Application Cache)

---

## 6. Team Ownership

| Team Member | Role | Core Responsibilities |
|---|---|---|
| **Ratan Shah** | Frontend Lead | React UI, Tailwind styling, MetaMask integration, ethers.js frontend integration, Dashboard, Borrow UI, Lending Marketplace, My Loans, Transaction Progress UX, Protocol Analytics UI. |
| **Kunaal** | Backend & Smart Contract Lead | Primary Smart Contract architecture, Node.js + Express backend, MongoDB schemas, Alchemy webhook integration with HMAC verification, triple-key idempotency, REST APIs, Analytics aggregation service, deployment scripts. |

---

## 7. Environment Variables

See [`.env.example`](file:///.env.example) for master configuration.

### Smart Contracts (`contracts/.env`):
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
DEPLOYER_PRIVATE_KEY=YOUR_SEPOLIA_TESTNET_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

### Backend (`backend/.env`):
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/credifi
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
ALCHEMY_API_KEY=YOUR_ALCHEMY_KEY
ALCHEMY_WEBHOOK_SIGNING_KEY=YOUR_SIGNING_KEY
CHAIN_ID=11155111
CREDIT_REGISTRY_ADDRESS=0x...
LOAN_MANAGER_ADDRESS=0x...
LENDING_POOL_ADDRESS=0x...
MOCK_USDC_ADDRESS=0x...
```

### Frontend (`frontend/.env`):
```env
VITE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
VITE_CHAIN_ID=11155111
VITE_API_URL=http://localhost:5000/api
VITE_CREDIT_REGISTRY_ADDRESS=0x...
VITE_LOAN_MANAGER_ADDRESS=0x...
VITE_LENDING_POOL_ADDRESS=0x...
VITE_MOCK_USDC_ADDRESS=0x...
```

---

## 8. Local Development & Testing

### 1. Run Complete Test Suite (Contracts + Backend)
```bash
npm run test:all
```

### 2. Compile & Deploy Smart Contracts
```bash
# Compile contracts
npm run compile:contracts

# Deploy to Sepolia testnet
npm run deploy:sepolia

# Verify bytecode & protocol links
npm --prefix contracts run verify:sepolia

# Seed realistic demo state onchain (Hackathon Demo Seed)
npm --prefix contracts run seed:sepolia
```

### 3. Run Development Servers
```bash
# Start backend API (Port 5000)
npm run dev:backend

# Start frontend (Port 5173)
npm run dev:frontend
```

---

## 9. 15-Phase Implementation Roadmap

- [x] **PHASE 1: Project Setup** - Monorepo architecture, Hardhat setup, Vite build, Express health check.
- [x] **PHASE 2: MockUSDC** - ERC20 test token with capped demo faucet, unit tests.
- [x] **PHASE 3: CreditRegistry** - Onchain credit scoring, `onlyLoanManager` access control, unit tests.
- [x] **PHASE 4: LoanManager** - State machine, onchain borrowing limit gate, unit tests.
- [x] **PHASE 5: LendingPool** - Safe token movement, SafeERC20 + ReentrancyGuard, unit tests.
- [x] **PHASE 6: Smart Contract Tests** - 45 passing unit and integration tests.
- [x] **PHASE 7: Sepolia Deployment** - Deployment script, bytecode verification script, demo seed script.
- [x] **PHASE 8: Wallet + Frontend Web3** - MetaMask integration, custom hooks, network guard.
- [x] **PHASE 9: Borrow Flow** - Undercollateralized loan request form, onchain limit checks.
- [x] **PHASE 10: Lending Flow** - Peer-to-peer lending marketplace, token approvals, funding flow.
- [x] **PHASE 11: Repayment + Credit Update** - Loan repayment, automatic score boost, borrowing power expansion.
- [x] **PHASE 12: Backend + MongoDB** - Mongoose schemas, REST API endpoints, RPC provider.
- [x] **PHASE 13: Alchemy Event Indexing** - HMAC-SHA256 signature verification, triple-key idempotency.
- [x] **PHASE 14: Analytics** - Protocol aggregation service, Recharts visual analytics.
- [x] **PHASE 15: Security + End-to-End Testing + Demo** - Integration verification, threat model review.

---

## 10. Limitations & Disclaimers

> [!CAUTION]
> **Hackathon Prototype Notice**: CrediFi is an educational prototype developed for **Hack in Hills '26**.
> - Smart contracts have not undergone a formal third-party security audit.
> - Operates exclusively with test tokens on Ethereum Sepolia.
> - Simplified heuristic credit scoring; does not incorporate off-chain credit bureau data.
> - Proof-of-concept operates per-wallet without full Sybil identity checks.
> - Does NOT provide real-world credit bureau equivalence or guaranteed legal debt recovery.
