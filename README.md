# JusticeVault
### Tamper-Proof Digital Evidence & Chain-of-Custody Management System

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![Network](https://img.shields.io/badge/Network-Polygon%20Amoy-8247e5.svg)](https://amoy.polygonscan.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

JusticeVault is an enterprise Web3 digital evidence management platform engineered to establish an immutable, verifiable, and legally auditable chain of custody for digital evidence (CCTV videos, digital crime scene photography, audio recordings, and forensic disk dumps).

---

## 🏛️ Foundational Architectural Principle

**The actual evidence files are NEVER stored directly on the blockchain.**

```
                     [ ORIGINAL EVIDENCE FILE ]
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
   Authoritative             Off-Chain            Off-Chain Metadata
  SHA-256 Digest           Storage / IPFS            (MongoDB)
 (Calculated on Server)   (Access-Controlled)   (Case Info & Users)
         │                       │
         └───────────┬───────────┘
                     ▼
          [ POLYGON AMOY TESTNET ]
           - EvidenceChain.sol
           - Immutable SHA-256 (bytes32)
           - Chronological Custody History
           - Non-repudiable Actor Signatures
```

---

## 🚀 Quick Start (Development & Demo)

### 1. Prerequisites
- **Node.js:** v18+ (tested on v22)
- **NPM:** v9+
- **MetaMask Extension** (optional for cryptographic signing demo)

### 2. Launch Client & Server Together
From the repository root:
```bash
# Start backend API (Port 5000) and frontend SPA (Port 5173) simultaneously:
npm run dev
```

The application will be accessible at:
👉 **Frontend:** [http://localhost:5173](http://localhost:5173)
👉 **Backend API:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 👥 Pre-Configured Demo Personas

The system automatically initializes 5 authorized personnel accounts with default password `Password123!`.
You can also use the **1-Click Demo Switcher** in the top navigation bar to switch between roles instantly during evaluations:

| Persona | Name | Role | Email |
| :--- | :--- | :--- | :--- |
| **Police Officer** | Det. Sarah Jenkins | `OFFICER` | `officer@justicevault.gov` |
| **Forensic Specialist** | Dr. Evelyn Reed | `FORENSIC` | `forensic@justicevault.gov` |
| **Judge / Magistrate** | Judge Catherine Adams | `JUDGE` | `judge@justicevault.gov` |
| **Prosecutor** | DA David Miller | `PROSECUTOR` | `prosecutor@justicevault.gov` |
| **System Administrator**| Marcus Vance | `ADMIN` | `admin@justicevault.gov` |

---

## 🧪 Running Automated Test Suites

### Smart Contract Tests (Hardhat)
```bash
cd blockchain
npx hardhat test
```
*Result: 14 passing tests (registration, duplicate checks, custody event logging, cryptographic verification).*

### Backend Tests (Node Test Runner)
```bash
cd server
npm test
```
*Result: All tests passing (SHA-256 stream calculation, content-addressed CIDs, role invariants).*

---

## 📂 Repository Structure

```
Hackathon/
├── blockchain/           # Hardhat development, Solidity contract, Amoy deploy scripts
│   ├── contracts/        # EvidenceChain.sol
│   ├── scripts/          # deploy.js
│   └── test/             # EvidenceChain.test.js
├── server/               # Express backend REST API
│   ├── src/controllers/  # Auth, Cases, Evidence, Custody, Audit, Stats
│   ├── src/models/       # User, Case, Evidence, CustodyEvent, AuditLog
│   ├── src/services/     # HashingService, StorageService, BlockchainService
│   └── tests/            # Automated unit tests
├── client/               # React + Vite + Tailwind CSS Frontend SPA
│   ├── src/components/   # StatusBadge, CustodyTimeline, HashDisplay, Modals
│   ├── src/context/      # AuthContext, Web3Context
│   └── src/pages/        # Dashboard, Cases, Evidence, Verify, Admin
├── demo_assets/          # Sample authentic and tampered evidence for live demonstration
└── docs/                 # Architecture specifications & DEMO_SCRIPT.md
```

---

## ⚖️ Hackathon Demonstration Walkthrough
For the step-by-step evaluation guide and tamper demonstration, see:
👉 [docs/DEMO_SCRIPT.md](file:///c:/Users/skuna/OneDrive/Desktop/Hackathon/docs/DEMO_SCRIPT.md)
