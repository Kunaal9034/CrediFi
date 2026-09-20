# CrediFi — Onchain Credit & Undercollateralized Lending

> **Project:** ArcTech presents CrediFi  
> **Tagline:** *"Onchain Credit. Undercollateralized Lending."*  
> **Hackathon:** Hack in Hills '26  
> **Network:** Ethereum Sepolia Testnet  

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
                                      +---------------------------------------------+
                                      |              MetaMask Wallet                |
                                      +----------------------+----------------------+
                                                             |
                                                             | Signs Transactions
                                                             v
+------------------------+                           +-------+----------------------+
| React / Vite Frontend  | <=== Reads RPC State ===> |  Ethereum Sepolia Testnet    |
| (Tailwind, ethers.js)  |                           |                              |
+-----------+------------+                           |  1. MockUSDC.sol             |
            |                                        |  2. CreditRegistry.sol       |
            | Queries REST API                       |  3. LoanManager.sol          |
            v                                        |  4. LendingPool.sol          |
+-----------+------------+                           +--------------+---------------+
| Express Backend API    |                                          |
| (Idempotent Indexer)   | <=== POST /api/webhooks/alchemy <======= | Confirmed Logs
+-----------+------------+      (Alchemy Webhooks Engine)           v
            |                                               (Event Streams)
            v
+-----------+------------+
| MongoDB Cache / Store  |  *NOTE: Blockchain is the SOLE financial truth.
| (History & Analytics)  |        MongoDB is an index/cache layer only.
+------------------------+
```

---

## 4. Technology Stack

- **Smart Contracts:** Solidity `^0.8.20`, Hardhat, OpenZeppelin Contracts v5 (ERC20, SafeERC20, ReentrancyGuard, Ownable)
- **Blockchain Network:** Ethereum Sepolia Testnet (Chain ID `11155111`)
- **Blockchain Infrastructure:** Alchemy JSON-RPC & Alchemy Custom Webhooks
- **Frontend:** React 18, Vite, Tailwind CSS, ethers.js v6, React Router v6, Recharts, Lucide Icons
- **Backend:** Node.js, Express, ethers.js v6, Mongoose, Helmet, CORS
- **Database:** MongoDB (Idempotent Event Log & Application Cache)

---

## 5. Repository Structure

```
Hackathon/
├── contracts/               # Hardhat smart contracts workspace
│   ├── contracts/           # MockUSDC, CreditRegistry, LoanManager, LendingPool
│   ├── scripts/             # Deployment & verification scripts
│   ├── test/                # Hardhat unit and integration tests
│   └── hardhat.config.cjs   # Hardhat configuration (Solidity 0.8.20)
├── frontend/                # Vite + React + Tailwind CSS client
│   ├── src/
│   │   ├── components/      # Reusable UI & Web3 components
│   │   ├── pages/           # Landing, Dashboard, Borrow, Lend, Loans, Credit, Analytics
│   │   ├── context/         # Web3Context (MetaMask provider, signers, contract instances)
│   │   └── utils/           # Formatters, constants, and ABIs
├── backend/                 # Express REST API & Alchemy Webhook Indexer
│   ├── src/
│   │   ├── controllers/     # loan, user, analytics controllers
│   │   ├── routes/          # loan, user, analytics, webhook routes
│   │   ├── models/          # User, Loan, Transaction, ProtocolStats schemas
│   │   ├── listeners/       # Blockchain event listeners & webhook processors
│   │   └── services/        # Event ingestion & analytics computation
├── docs/                    # Architectural & API specifications
│   ├── architecture.md
│   ├── smart-contracts.md
│   ├── api.md
│   ├── deployment.md
│   ├── security.md
│   └── demo.md
├── package.json             # Root monorepo orchestration
└── .env.example             # Master environment variable template
```

---

## 6. Environment Variables

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

## 7. Local Development & Setup

### Prerequisites
- Node.js `v18+` (Tested on `v22.22.0`)
- npm `v9+`
- MetaMask browser extension installed

### 1. Install Dependencies
```bash
# From workspace root
npm run install:all
```

### 2. Compile & Test Smart Contracts
```bash
npm run compile:contracts
npm run test:contracts
```

### 3. Run Development Servers
```bash
# Start backend API (Port 5000)
npm run dev:backend

# Start frontend (Port 5173)
npm run dev:frontend
```

---

## 8. Verified Contract Addresses (Sepolia Testnet)

*To be populated upon Phase 7 deployment:*
- **MockUSDC:** `TBD`
- **CreditRegistry:** `TBD`
- **LoanManager:** `TBD`
- **LendingPool:** `TBD`

---

## 9. Hackathon Demo Flow

1. **Connect MetaMask:** User connects wallet to CrediFi on Ethereum Sepolia.
2. **Faucet & Minting:** User mints test MockUSDC for demo purposes.
3. **Credit Profile Inspection:** Initial credit score defaults to 500 with a baseline borrowing power of 500 USDC.
4. **Loan Request (Borrower):** Borrower creates a loan request onchain. State becomes `REQUESTED`.
5. **Loan Funding (Lender):** Second wallet views the open loan in the marketplace and funds it via `LendingPool`. Funds transfer directly to the borrower. State becomes `ACTIVE`.
6. **Repayment (Borrower):** Borrower approves and repays principal + interest. Funds transfer back to the lender.
7. **Credit Score Increment:** Contract updates credit score (+50 for on-time repayment, +20 early), immediately expanding borrowing capacity.
8. **Real-time Event Indexing:** Alchemy webhook catches emitted events and indexes them into MongoDB for protocol analytics and history.

---

## 10. Limitations & Disclaimers

> [!CAUTION]
> **Hackathon Prototype Notice**: CrediFi is an educational prototype developed for **Hack in Hills '26**.
> - Smart contracts have not undergone a formal security audit.
> - Operates exclusively with test tokens on Ethereum Sepolia.
> - Does NOT provide real-world credit bureau equivalence or guaranteed legal debt recovery.
