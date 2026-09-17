# JusticeVault
### Tamper-Proof Digital Evidence & Chain-of-Custody Management System

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![Network](https://img.shields.io/badge/Network-Polygon%20Amoy%20(80002)-8247e5.svg)](https://amoy.polygonscan.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%206-61dafb.svg)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📑 Table of Contents

1. [Project Overview & Purpose](#-project-overview--purpose)
2. [Foundational Architectural Principles](#-foundational-architectural-principles)
3. [Key Features & Capabilities](#-key-features--capabilities)
4. [Complete Technology Stack](#-complete-technology-stack)
5. [Repository Structure & Codebase Explanation](#-repository-structure--codebase-explanation)
6. [System Readiness & Operational Status](#-system-readiness--operational-status)
7. [Installation & Dependency Setup](#-installation--dependency-setup)
8. [Local Development Startup](#-local-development-startup)
9. [Pre-Configured Demonstration Personas & RBAC](#-pre-configured-demonstration-personas--rbac)
10. [Building for Production](#-building-for-production)
11. [Environment Variables Reference](#-environment-variables-reference)
12. [Evidence Storage & File Download Setup](#-evidence-storage--file-download-setup)
13. [Personnel Profiles, Wallet Linking & Account Management](#-personnel-profiles-wallet-linking--account-management)
14. [Managing Cases, Evidence Categories & Custody Events](#-managing-cases-evidence-categories--custody-events)
15. [Live Demonstration Script & Tamper-Detection Walkthrough](#-live-demonstration-script--tamper-detection-walkthrough)
16. [Blockchain Deployment Guide (Local & Polygon Amoy)](#-blockchain-deployment-guide-local--polygon-amoy)
17. [Troubleshooting & Common Issues](#-troubleshooting--common-issues)
18. [Security Invariants & Handling Rules](#-security-invariants--handling-rules)

---

## 🏛️ Project Overview & Purpose

**JusticeVault** is an enterprise-grade Web3 digital evidence and chain-of-custody management platform. It is engineered to solve a fundamental crisis in criminal justice and forensic administration: **the vulnerability of digital evidence to silent tampering, alteration, unauthorized access, or custodial repudiation**.

In modern legal proceedings, evidence—such as surveillance camera footage, body-worn camera streams, 911 audio recordings, crime scene photography, and digital forensic drive images—is vulnerable to corruption, accidental metadata scrubbing, and malicious tampering. If an opposing counsel questions whether a digital video presented in court is identical to the file collected at the crime scene, traditional systems often rely on internal server logs that can themselves be altered by administrators.

### Core Mission & Solution
JusticeVault bridges the gap between off-chain legal efficiency and on-chain mathematical certainty:
- **Server-Side Authoritative Hashing:** Evidence files are digested upon arrival using SHA-256 directly from the incoming binary stream.
- **Off-Chain Storage:** Heavy media files are stored off-chain in content-addressed storage (local storage or IPFS) to avoid blockchain bloat and cost.
- **Immutable On-Chain Anchoring:** The cryptographic SHA-256 digest (32 bytes), along with every custodial handover, is permanently written to a smart contract on the **Polygon Amoy Testnet (Chain ID: 80002)**.
- **Instant Judicial Verification:** Any legal officer or judge can upload an evidence file at any point in the future; JusticeVault recalculates the digest and checks it directly against the blockchain contract. If even one bit has been modified, the system raises an immediate integrity violation alert.

---

## 📐 Foundational Architectural Principles

### 1. The On-Chain / Off-Chain Boundary
**Raw evidence media files are NEVER stored on the blockchain.**

```
                     [ ORIGINAL EVIDENCE FILE ]
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
   Authoritative             Off-Chain            Off-Chain Metadata
  SHA-256 Digest           Storage / IPFS            (MongoDB)
 (Computed on Server)     (Access-Controlled)   (Case Info & Users)
         │                       │
         └───────────┬───────────┘
                     ▼
          [ POLYGON AMOY TESTNET ]
           - EvidenceChain.sol (Chain ID: 80002)
           - Immutable SHA-256 (bytes32)
           - Chronological Custody History
           - Non-repudiable Actor Signatures
```

### 2. Relayer Trust Boundary
- **User Authentication:** Users authenticate via JWT (Role-Based Access Control) and optionally link their MetaMask wallet.
- **Cryptographic Action Nonces:** Users sign unique authentication nonces with MetaMask (EIP-191 personal sign) to prove possession of their assigned wallet address.
- **Trusted Relayer Model:** The backend verifies user permissions and cryptographic signatures, then relays transactions to the `EvidenceChain.sol` contract using a designated backend **Operator / Relayer Wallet** (`OPERATOR_PRIVATE_KEY`).
- **Trust Boundary Note:** The smart contract trusts the authorized operator. While the hash on-chain is tamper-evident and immutable once written, the system relies on the authorized backend operator to relay legitimate evidence records.

---

## ✨ Key Features & Capabilities

1. **Role-Based Access Control (RBAC):**
   - Strict separation of duties between `OFFICER`, `FORENSIC`, `PROSECUTOR`, `JUDGE`, and `ADMIN`.
   - **1-Click Demo Persona Switcher** in the top navigation bar to evaluate user workflows instantly.
2. **Authoritative Server-Side Hashing:**
   - Client-provided hashes are never trusted. The server reads the multipart file stream and calculates the authoritative SHA-256 checksum in real-time.
3. **Dual-Tier Storage Architecture:**
   - Built-in `LocalStorageProvider` (`server/uploads/ipfs_store/`) with deterministic multihash CIDv0 generation (`Qm...`) for zero-dependency offline hackathons.
   - Plug-and-play support for cloud IPFS via **Pinata API / JWT**.
4. **Chronological Chain of Custody:**
   - Tracks all evidence state transitions: `REGISTERED`, `ACCESSED`, `TRANSFERRED`, `ANALYZED`, `VERIFIED`, and `FLAGGED`.
   - Records actor ID, timestamp, reason, recipient, and on-chain transaction hash.
5. **Interactive Verification Studio:**
   - Drag-and-drop comparison engine to verify any external file against on-chain records.
   - Outputs side-by-side hash comparison, block number, and instant `✓ VERIFIED` or `✗ FAILED / HASH MISMATCH` status.
6. **MetaMask Web3 Integration:**
   - Automatic Polygon Amoy network switching (`0x13882`).
   - Wallet binding and cryptographic signature verification.
7. **Comprehensive Audit Logging:**
   - Administrative audit trail capturing user IP address, action type, affected resource, status, and associated blockchain transaction hashes.

---

## 🛠️ Complete Technology Stack

### Frontend Application (`client/`)
- **Framework:** React 18 (SPA)
- **Tooling & Bundler:** Vite 6
- **Routing:** React Router v7
- **Styling:** Tailwind CSS 3 with PostCSS & Autoprefixer
- **Web3 Integration:** Ethers.js v6 (`BrowserProvider`, `Signer`, `Contract`)
- **Icons & UI:** Lucide React (`lucide-react`)
- **HTTP Client:** Axios with JWT interceptors

### Backend API Server (`server/`)
- **Runtime:** Node.js (v18+, tested on v22)
- **Web Framework:** Express 4
- **Security Middleware:** Helmet (HTTP header security), CORS, Express Rate Limit
- **Database & ODM:** MongoDB with Mongoose 8
- **Embedded Database:** `mongodb-memory-server` (automatic fallback when local/Atlas MongoDB is unconfigured)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`) with `bcryptjs` password hashing
- **File Ingestion:** Multer (multipart streaming)
- **Web3 Relayer:** Ethers.js v6 (`JsonRpcProvider`, `Wallet`, `Contract`)

### Smart Contract & Blockchain (`blockchain/`)
- **Smart Contract Language:** Solidity `^0.8.20`
- **Security Standards:** OpenZeppelin Contracts v5 (`Ownable`)
- **Development Framework:** Hardhat 2.22 with `@nomicfoundation/hardhat-toolbox`
- **Target Network:** Polygon Amoy Testnet (Chain ID: `80002`)
- **Deployment Scripts:** Node.js automation with automatic ABI and address synchronization

---

## 📂 Repository Structure & Codebase Explanation

```
JusticeVault/
├── package.json                        # Root package scripts (concurrent dev runner, test triggers)
├── package-lock.json                   # Root lockfile
├── .gitignore                          # Strict security exclusions (.env, artifacts, uploads, node_modules)
├── .env.example                        # Root environment variable template
├── README.md                           # Master single-source project documentation
│
├── demo_assets/                        # Authentic and tampered media files for live evaluations
│   ├── vault_cctv_cam2.mp4             # Authentic 1080p CCTV evidence video
│   └── vault_cctv_cam2_TAMPERED.mp4    # Single-byte corrupted file demonstrating tamper alert
│
├── blockchain/                         # Hardhat Web3 development environment
│   ├── contracts/
│   │   └── EvidenceChain.sol           # Core smart contract (immutable evidence & custody storage)
│   ├── scripts/
│   │   └── deploy.js                   # Deployment pipeline with automatic ABI synchronization
│   ├── test/
│   │   └── EvidenceChain.test.js       # 14 automated unit tests validating all contract invariants
│   ├── deployments/
│   │   └── hardhat.json                # Local deployment record (Chain ID: 31337)
│   ├── hardhat.config.js               # Network definitions (Hardhat localhost, Polygon Amoy 80002)
│   ├── .env.example                    # Template for blockchain operator key and RPC endpoint
│   └── package.json                    # Blockchain scripts (compile, test, deploy)
│
├── server/                             # Express REST API backend
│   ├── src/
│   │   ├── app.js                      # Express app entrypoint, middleware, routes, and server boot
│   │   ├── config/
│   │   │   ├── database.js             # MongoDB connection manager with MongoMemoryServer fallback
│   │   │   └── contractAbi.json        # Synchronized contract ABI and address artifact
│   │   ├── constants/
│   │   │   ├── custodyActions.js       # Custody action enums and contract mapping
│   │   │   ├── evidenceStatus.js       # Evidence lifecycle states and media categories
│   │   │   └── roles.js                # System RBAC roles (ADMIN, OFFICER, FORENSIC, PROSECUTOR, JUDGE)
│   │   ├── controllers/
│   │   │   ├── authController.js       # Login, register, profile update, and nonce verification
│   │   │   ├── caseController.js       # Case creation, listing, status updates, and case file linking
│   │   │   ├── evidenceController.js   # Evidence upload, SHA-256 calculation, and verification
│   │   │   ├── custodyController.js    # Custody handoff and forensic examination records
│   │   │   ├── auditController.js      # System audit log retrieval and filtering
│   │   │   └── statsController.js      # Dashboard analytics, metrics, and case breakdowns
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js       # JWT validation and user context hydration
│   │   │   ├── rbacMiddleware.js       # Role-based route guard
│   │   │   ├── uploadMiddleware.js     # Multer file streaming with size limits
│   │   │   ├── auditMiddleware.js      # Automatic logging of audit events
│   │   │   └── errorHandler.js         # Centralized HTTP error handler
│   │   ├── models/
│   │   │   ├── User.js                 # User schema, credentials, badge number, and wallet address
│   │   │   ├── Case.js                 # Criminal case docket schema and assigned personnel
│   │   │   ├── Evidence.js             # Evidence metadata, SHA-256 digest, IPFS CID, and blockchain state
│   │   │   ├── CustodyEvent.js         # Immutable custody trail schema
│   │   │   └── AuditLog.js             # System action audit log schema
│   │   ├── services/
│   │   │   ├── hashingService.js       # Streaming SHA-256 calculation and hex/bytes32 conversions
│   │   │   ├── storageService.js       # Content-addressed storage (LocalStorageProvider & Pinata)
│   │   │   └── blockchainService.js    # Relayer service interacting with EvidenceChain on Amoy
│   │   └── utils/
│   │       └── seeder.js               # Auto-seeder creating demo personas and CASE-2026-001
│   ├── tests/
│   │   └── server.test.js              # Automated backend tests (SHA-256, storage CIDs, RBAC)
│   ├── .env.example                    # Backend environment variable template
│   └── package.json                    # Server scripts and dependencies
│
└── client/                             # React + Vite frontend SPA
    ├── src/
    │   ├── main.jsx                    # React entrypoint
    │   ├── App.jsx                     # Application router and protected route wrappers
    │   ├── index.css                   # Tailwind CSS imports and custom design styles
    │   ├── components/
    │   │   ├── common/
    │   │   │   ├── Navbar.jsx          # Top navigation bar with 1-Click Demo Switcher
    │   │   │   ├── Sidebar.jsx         # Role-aware sidebar navigation
    │   │   │   ├── RoleBadge.jsx       # Visual role badges (color-coded by role)
    │   │   │   ├── StatusBadge.jsx     # Evidence and case status indicators
    │   │   │   └── HashDisplay.jsx     # Cryptographic hash formatter with 1-click copy
    │   │   ├── custody/
    │   │   │   ├── CustodyTimeline.jsx # Visual chronological custody trail
    │   │   │   └── TransferModal.jsx   # Custody transfer dialog
    │   │   └── evidence/
    │   │       ├── EvidenceUploadModal.jsx # Evidence file ingestion modal
    │   │       └── VerificationModal.jsx   # On-chain verification dialog
    │   ├── context/
    │   │   ├── AuthContext.jsx         # Authentication state, login, logout, and demo switcher
    │   │   └── Web3Context.jsx         # MetaMask connection, network switching, and nonce signing
    │   ├── layouts/
    │   │   └── AppLayout.jsx           # Main layout frame with sidebar, navbar, and alert banner
    │   ├── pages/
    │   │   ├── Dashboard.jsx           # Overview metrics, recent evidence, and quick actions
    │   │   ├── CasesList.jsx           # Case docket list and new case creation modal
    │   │   ├── CaseDetails.jsx         # Detailed case dossier, evidence list, and investigators
    │   │   ├── EvidenceList.jsx        # Evidence catalog with category and status filters
    │   │   ├── EvidenceDetails.jsx     # Single evidence view, custody history, and verification trigger
    │   │   ├── VerifyEvidence.jsx      # Standalone verification studio with drag-and-drop
    │   │   ├── AdminUsers.jsx          # User management and role assignments
    │   │   ├── AuditLogs.jsx           # Immutable audit log explorer
    │   │   ├── Login.jsx               # Standard credential login page
    │   │   └── Register.jsx            # Account registration with role and badge configuration
    │   ├── contracts/
    │   │   └── contractAbi.json        # Synchronized ABI and deployed contract address
    │   └── services/
    │       └── api.js                  # Axios client configured with JWT authorization headers
    ├── index.html                      # HTML template with Google Fonts (Inter)
    ├── vite.config.js                  # Vite configuration with API reverse proxy
    ├── tailwind.config.js              # Tailwind styling configuration
    ├── postcss.config.js               # PostCSS configuration
    ├── .env.example                    # Client environment template
    └── package.json                    # Client scripts and dependencies
```

---

## 🚦 System Readiness & Operational Status

| Component | Status | Operational Details |
|---|---|---|
| **Git Repository** | 🟢 **Complete** | Tracked on `main`, working tree clean, baseline preserved. |
| **Dependencies** | 🟢 **Complete** | All packages installed across root, `blockchain/`, `server/`, and `client/`. |
| **Frontend UI** | 🟢 **Operational** | Running at `http://localhost:5173`. Instant demo switcher, upload UI, verification studio, and MetaMask Web3 context active. |
| **Backend API** | 🟢 **Operational** | Running at `http://localhost:5000`. Health check (`/api/health`) returns `HEALTHY`. |
| **Database** | 🟢 **Operational** | Automatic embedded `MongoMemoryServer` bootstraps in-memory database with pre-seeded demo accounts. |
| **Storage Engine** | 🟢 **Operational** | Deterministic `LocalStorageProvider` (`server/uploads/ipfs_store/`) active with multihash CID generation. Pinata cloud IPFS optional. |
| **Smart Contract Tests** | 🟢 **Operational** | 14/14 Hardhat tests passing (`npm run blockchain:test`). Solidity 0.8.20 compiled cleanly with optimizer. |
| **Backend Tests** | 🟢 **Operational** | 6/6 tests passing (`npm run server:test`) validating streaming SHA-256 calculation and RBAC invariants. |
| **Operator Wallet** | 🟡 **Pending User** | Enter your MetaMask operator wallet private key into local `blockchain/.env` and `server/.env` as `OPERATOR_PRIVATE_KEY`. |
| **Testnet POL Balance** | 🟡 **Pending User** | Obtain testnet POL from [Polygon Faucet](https://faucet.polygon.technology) to fund gas fees. |
| **Polygon Amoy Deployment** | 🟡 **Pending Deployment** | Once the operator wallet has POL, run `npm run blockchain:deploy:amoy` to deploy `EvidenceChain.sol` to Polygon Amoy (Chain ID: 80002). |
| **Amoy Contract Address** | 🟡 **Pending Deployment** | Will be populated automatically upon executing `deploy:amoy`. Local Hardhat address (`0x5FbDB...`) must NOT be used on Amoy. |

---

## 💻 Installation & Dependency Setup

### 1. Prerequisites
- **Node.js:** v18.x or v20.x or v22.x (verified on v22.x)
- **NPM:** v9.x or v10.x
- **MetaMask Extension:** Installed in your Chromium/Firefox browser (required for live Web3 signature demo)

### 2. Clone & Install All Modules
Clone the repository and install dependencies across the monorepo using the root convenience script:
```bash
git clone https://github.com/Kunaal9034/JusticeVault.git
cd JusticeVault

# Install dependencies across root, blockchain, server, and client:
npm run install:all
```

Or install each package manually:
```bash
npm install
cd blockchain && npm install
cd ../server && npm install
cd ../client && npm install
cd ..
```

---

## 🚀 Local Development Startup

### 1. Launch Full Stack Concurrently
From the project root:
```bash
npm run dev
```
This starts:
- **Backend Express Server:** [http://localhost:5000](http://localhost:5000)
- **Frontend Vite SPA:** [http://localhost:5173](http://localhost:5173)

### 2. Independent Startup (Alternative)
If you prefer running the backend and frontend in separate terminals:
```bash
# Terminal 1: Backend API
npm run dev:server
# (runs 'cd server && npm run dev' with node --watch)

# Terminal 2: Frontend Client
npm run dev:client
# (runs 'cd client && npm run dev' with vite)
```

### 3. Verification of Local Services
- Open your browser to **`http://localhost:5173`** to access the JusticeVault dashboard.
- Verify the backend API health check:
  ```bash
  curl http://localhost:5000/api/health
  # Response: {"status":"HEALTHY","system":"JusticeVault Core API","environment":"development"}
  ```

---

## 👥 Pre-Configured Demonstration Personas & RBAC

Upon startup, the database auto-seeder (`server/src/utils/seeder.js`) populates 5 authorized personnel accounts.
You can log in manually with email and password (`Password123!`), or click the **"Demo Switcher"** dropdown in the top navigation bar to switch roles instantly:

| Persona | Name | Role | Email | Password | Clearance & Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Investigating Officer** | Det. Sarah Jenkins | `OFFICER` | `officer@justicevault.gov` | `Password123!` | Ingests evidence, registers cases, initiates custody handoffs |
| **Forensic Specialist** | Dr. Evelyn Reed | `FORENSIC` | `forensic@justicevault.gov` | `Password123!` | Downloads evidence, executes toolkits, logs forensic notes |
| **Judge / Magistrate** | Judge Catherine Adams | `JUDGE` | `judge@justicevault.gov` | `Password123!` | Runs independent judicial cryptographic verification |
| **Prosecutor** | DA David Miller | `PROSECUTOR` | `prosecutor@justicevault.gov` | `Password123!` | Reviews custody audit trail and builds legal case files |
| **Chief Administrator** | Marcus Vance | `ADMIN` | `admin@justicevault.gov` | `Password123!` | Manages user accounts, assigns roles, reviews full audit logs |

---

## 📦 Building for Production

### 1. Build Frontend Bundle
```bash
cd client
npm run build
```
- Outputs the optimized, production-ready bundle to `client/dist/`.
- Verifies that all modules transform cleanly and Tailwind CSS compiles without errors.

### 2. Run Backend in Production Mode
```bash
cd server
NODE_ENV=production node src/app.js
```

---

## ⚙️ Environment Variables Reference

Environment variable templates (`.env.example`) are provided in the root, `server/`, `client/`, and `blockchain/`.
Real `.env` files are strictly excluded by `.gitignore` and must **never** be committed to Git.

### 1. Server Environment (`server/.env`)
| Variable | Required? | Default / Sample | Description |
|---|---|---|---|
| `PORT` | Optional | `5000` | Port on which the Express REST API listens. |
| `NODE_ENV` | Optional | `development` | Environment mode (`development` or `production`). |
| `MONGODB_URI` | Optional | `""` *(blank)* | Connection string for MongoDB Atlas. If left blank, automatically bootstraps an in-memory database. |
| `JWT_SECRET` | **Required** | Generated Hex | Cryptographically secure secret used to sign and verify user session JWTs. |
| `JWT_EXPIRES_IN` | Optional | `24h` | Validity duration of issued authentication tokens. |
| `AMOY_RPC_URL` | Optional | `https://rpc-amoy.polygon.technology` | Public RPC endpoint for Polygon Amoy Testnet. |
| `CONTRACT_ADDRESS` | **Required for Amoy** | `""` *(blank)* | Address of deployed `EvidenceChain.sol` on Polygon Amoy. |
| `OPERATOR_PRIVATE_KEY` | **Required for Amoy** | `""` *(blank)* | Private key of the backend relayer wallet (must be funded with testnet POL). |
| `PINATA_JWT` | Optional | `""` *(blank)* | JWT bearer token for Pinata cloud IPFS pinning. |
| `MAX_UPLOAD_SIZE_MB` | Optional | `500` | Maximum allowable file size for uploaded evidence files. |

> [!TIP]
> **Generating a Secure `JWT_SECRET`:**
> Run this command to generate a cryptographically secure 64-byte hex string and store it in `server/.env`:
> ```bash
> node -e "const crypto = require('crypto'); console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex'))"
> ```

### 2. Client Environment (`client/.env`)
> [!WARNING]
> All variables prefixed with `VITE_` are publicly accessible in the client browser bundle. **Never place private keys, database passwords, or JWT secrets here.**

| Variable | Required? | Value | Description |
|---|---|---|---|
| `VITE_API_URL` | Required | `http://localhost:5000/api` | Base URL of the backend REST API. |
| `VITE_CHAIN_ID` | Required | `80002` | Target EVM Chain ID (Polygon Amoy Testnet). |
| `VITE_CHAIN_NAME` | Required | `"Polygon Amoy Testnet"` | Human-readable network name displayed in MetaMask prompts. |
| `VITE_RPC_URL` | Required | `https://rpc-amoy.polygon.technology` | Public RPC URL used by MetaMask for network switching. |
| `VITE_BLOCK_EXPLORER_URL` | Required | `https://amoy.polygonscan.com` | Block explorer URL for linking transaction receipts. |
| `VITE_CONTRACT_ADDRESS` | **Pending Amoy** | `""` *(blank)* | Polygon Amoy contract address populated after deployment. |

### 3. Blockchain Environment (`blockchain/.env`)
| Variable | Required? | Description |
|---|---|---|
| `AMOY_RPC_URL` | Optional | Defaults to `https://rpc-amoy.polygon.technology`. |
| `OPERATOR_PRIVATE_KEY` | **Required for Deployment** | 64-char private key of the deployer/relayer wallet funded with Amoy POL. |
| `POLYGONSCAN_API_KEY` | Optional | API key used for verifying smart contract source code on Polygonscan. |

---

## 💾 Evidence Storage & File Download Setup

JusticeVault implements an access-controlled off-chain storage architecture.

### How Evidence Upload Works
1. When an authorized officer uploads a file via the frontend (`/evidence` -> `EvidenceUploadModal`), the request is streamed via Multer to `server/uploads/temp/`.
2. The backend [hashingService.js](file:///c:/Users/skuna/OneDrive/Desktop/Hackathon/server/src/services/hashingService.js) reads the binary stream and computes the authoritative SHA-256 digest.
3. The file is handed to [storageService.js](file:///c:/Users/skuna/OneDrive/Desktop/Hackathon/server/src/services/storageService.js):
   - **Cloud Mode (Pinata):** If `PINATA_JWT` is configured, the file is pinned to IPFS via Pinata's API, and the IPFS CID (`Qm...`) is recorded.
   - **Local Mode (Default):** If Pinata is unconfigured, the file is moved to `server/uploads/ipfs_store/` named by its SHA-256 hash, and a deterministic multihash CID is computed.
4. The temporary file in `server/uploads/temp/` is deleted immediately.

### How Evidence File Download Works
- Authorized users (Officers, Forensics, Prosecutors, Judges) can download evidence directly through the API:
  ```http
  GET /api/evidence/:id/download
  Headers: Authorization: Bearer <jwt_token>
  ```
- The backend verifies user permissions, looks up the physical storage path, and streams the binary content with appropriate `Content-Disposition` headers.
- Every download automatically logs an `ACCESSED` custody event and an audit trail entry.

---

## 👤 Personnel Profiles, Wallet Linking & Account Management

### 1. User Schema & Personnel Profiles (`server/src/models/User.js`)
User records maintain departmental credentials and Web3 cryptographic identities:
- **`name`:** Investigator / Legal official full name.
- **`email`:** Official agency email (unique identifier).
- **`badgeNumber`:** Official police badge, lab license, or judicial bar identifier (e.g., `BADGE-7721`).
- **`department`:** Operational unit (e.g., `Homicide Division`, `Digital Forensics Lab`).
- **`role`:** RBAC role (`OFFICER`, `FORENSIC`, `PROSECUTOR`, `JUDGE`, `ADMIN`).
- **`walletAddress`:** Ethereum/Polygon wallet address used for cryptographic signatures.

### 2. Linking a MetaMask Wallet to an Account
1. Log in with your personnel account.
2. In the top navigation bar, click **"Connect Wallet"**.
3. Approve the connection in MetaMask.
4. Click **"Verify Signer"**:
   - The backend issues a unique cryptographic challenge nonce (`POST /api/auth/nonce`).
   - MetaMask prompts you to sign the nonce using EIP-191 personal sign.
   - The backend cryptographically verifies the signature (`POST /api/auth/verify-signature`) using `ethers.verifyMessage` and binds the verified wallet to your session.

### 3. Adding or Updating Personnel Accounts
- Administrators can manage users via the **Admin Panel** (`/admin/users`).
- New personnel can also be registered at `/register`.

---

## 🗂️ Managing Cases, Evidence Categories & Custody Events

### 1. Creating a New Case Docket
1. Navigate to **Cases** (`/cases`) in the sidebar.
2. Click **"+ New Case"**.
3. Complete the case docket:
   - **Case ID:** Unique reference (e.g., `CASE-2026-002`).
   - **Title:** Case description (e.g., `State v. Reynolds — Cyber Extortion Investigation`).
   - **Incident Date & Jurisdiction:** Operational location and date.
   - **Summary:** Narrative scope of investigation.
4. Click **"Create Case Docket"**.

### 2. Supported Evidence Categories
Evidence ingested into JusticeVault must be categorized under one of the formal evidentiary types:
- `CCTV_VIDEO`: Security camera surveillance clips and drone recordings.
- `AUDIO_RECORDING`: 911 dispatch calls, wiretap intercepts, and witness audio.
- `DIGITAL_IMAGE`: Crime scene photography and biometric scans.
- `FORENSIC_DOCUMENT`: Financial records, signed declarations, and warrants.
- `DATA_DUMP`: Hard drive bitstream images, memory dumps, and mobile phone extractions.
- `OTHER`: Miscellaneous digital evidentiary artifacts.

### 3. Custodial State Machine
Every custody transition is tracked chronologically:
- `REGISTERED`: Initial ingestion and blockchain anchoring.
- `ACCESSED`: File viewed or downloaded for legal preparation.
- `TRANSFERRED`: Physical or operational transfer between authorized personnel.
- `ANALYZED`: Forensic extraction, audio filtering, or biometric scanning performed.
- `VERIFIED`: Independent judicial cryptographic verification executed.
- `FLAGGED`: Integrity failure detected (tampering or hash divergence).

---

## 🧪 Live Demonstration Script & Tamper-Detection Walkthrough

This scenario demonstrates JusticeVault's tamper-detection capability using the sample assets included in `demo_assets/`.

### Scenario: `CASE-2026-001` (Metro Financial Center Vault Burglary)

#### Step 1: Evidence Ingestion & Authoritative Hashing
1. Open JusticeVault at `http://localhost:5173`.
2. In the top navigation bar, select **"Demo Switcher: Officer"** (Det. Sarah Jenkins).
3. Click **"Register Evidence"**.
4. Select Case: `CASE-2026-001: Metro Financial Center Vault Burglary`.
5. Upload the authentic file: [demo_assets/vault_cctv_cam2.mp4](file:///c:/Users/skuna/OneDrive/Desktop/Hackathon/demo_assets/vault_cctv_cam2.mp4).
6. Title: `Subterranean Vault CCTV Camera 02`.
7. Category: `CCTV Video Footage`.
8. Click **"Register Evidence"**:
   - The backend calculates the authoritative SHA-256 digest (`65d4f86e84...`).
   - The file is saved in content-addressed storage and pinned with a multihash CID.
   - The evidence is cataloged with `blockchainStatus: 'PENDING'` (or confirmed on Polygon Amoy if deployed).

#### Step 2: Custodial Transfer to Forensics
1. Open the created evidence item (`EV-001`).
2. Click **"Transfer Custody"**.
3. Select Recipient: `Dr. Evelyn Reed (Forensic Specialist)`.
4. Reason: `Transferred to Cyber Forensics Unit for biometric extraction`.
5. Click **"Confirm Transfer"**. Notice the custody timeline updates immediately.

#### Step 3: Forensic Examination
1. Click **"Demo Switcher: Forensics"** (switches to Dr. Evelyn Reed).
2. Open `EV-001`.
3. Click **"Download File"** (automatically logs an `ACCESSED` custody event).
4. Click **"Record Analysis"**.
5. Tool Used: `Autopsy Forensic Browser v4.21`.
6. Notes: `Frame-by-frame analysis completed. Suspect facial keyframe identified at 02:14:09.`
7. Submit the analysis.

#### Step 4: Judicial Cryptographic Verification (Success Case)
1. Click **"Demo Switcher: Judge"** (Judge Catherine Adams).
2. Open **Verification Studio** (`/verify`) or open `EV-001` and click **"Verify Hash"**.
3. Drag & drop the authentic file: `demo_assets/vault_cctv_cam2.mp4`.
4. Click **"Run Cryptographic Verification"**:
   - The backend recalculates the SHA-256 digest from the uploaded file.
   - Compares it against the registered digest.
   - Result:
     ```
     ✓ VERIFIED — CRYPTOGRAPHIC HASH MATCH
     Original Registered Digest:   65d4f86e84470fdbc8a6a7b979d952c0c223e23cba1a8094723a4694e74539f5
     Recalculated Upload Digest:   65d4f86e84470fdbc8a6a7b979d952c0c223e23cba1a8094723a4694e74539f5
     Status: Cryptographic integrity confirmed. Evidence is authentic and unmodified.
     ```

#### Step 5: The Tamper Test (Integrity Violation Demonstration)
1. In the Verification Studio, select **"Verify Another File"**.
2. Select Evidence ID: `EV-001`.
3. Drag & drop the tampered file: [demo_assets/vault_cctv_cam2_TAMPERED.mp4](file:///c:/Users/skuna/OneDrive/Desktop/Hackathon/demo_assets/vault_cctv_cam2_TAMPERED.mp4) (where a single character has been modified).
4. Click **"Run Cryptographic Verification"**:
   - Result:
     ```
     ✗ CRITICAL INTEGRITY FAILURE — HASH MISMATCH DETECTED
     Original Registered Digest:   65d4f86e84470fdbc8a6a7b979d952c0c223e23cba1a8094723a4694e74539f5
     Recalculated Upload Digest:   18ce3fd677859cc5bcfa78a6bb3c129bfec99ca8ae2ad94846eecdfbbb260838
     Status: ALERT! File content diverges from registered authoritative record.
     ```
   - The evidence status is automatically flagged in the custody timeline!

#### Step 6: System Audit Trail
1. Click **"Demo Switcher: Admin"** (Marcus Vance).
2. Navigate to **Audit Logs** (`/admin/audit`).
3. View the complete immutable audit trail capturing the initial upload, custody transfer, forensic analysis, file download, and the failed verification attempt with timestamp, user ID, and IP address.

---

## ⛓️ Blockchain Deployment Guide (Local & Polygon Amoy)

### 1. Automated Testing & Compilation
```bash
# Run 14 smart contract unit tests:
npm run blockchain:test

# Compile contract with optimizer:
npm run blockchain:compile

# Run backend unit tests:
npm run server:test
```

### 2. Deploying to Polygon Amoy Testnet (Chain ID: 80002)

When ready to deploy `EvidenceChain.sol` to the live Polygon Amoy Testnet:

1. **Configure Operator Key:**
   In `blockchain/.env`:
   ```env
   AMOY_RPC_URL=https://rpc-amoy.polygon.technology
   OPERATOR_PRIVATE_KEY=0xYOUR_64_CHAR_HEXADECIMAL_PRIVATE_KEY
   ```
2. **Fund Operator Wallet:**
   Ensure your operator wallet address has at least 0.2 POL from [Polygon Faucet](https://faucet.polygon.technology).
3. **Execute Deployment:**
   ```bash
   npm run blockchain:deploy:amoy
   ```
   The deployment script (`blockchain/scripts/deploy.js`) automatically:
   - Deploys `EvidenceChain.sol` via Hardhat.
   - Saves deployment details to `blockchain/deployments/amoy.json`.
   - Synchronizes ABI and deployed contract address to `server/src/config/contractAbi.json` and `client/src/contracts/contractAbi.json`.
4. **Update Environment Files:**
   Set `CONTRACT_ADDRESS=<deployed_address>` and `OPERATOR_PRIVATE_KEY=<key>` in `server/.env`, and `VITE_CONTRACT_ADDRESS=<deployed_address>` in `client/.env`.

---

## 🔧 Troubleshooting & Common Issues

### 1. Port 5000 or 5173 Already in Use
- **Symptom:** `EADDRINUSE: address already in use :::5000`
- **Fix (Windows PowerShell):**
  ```powershell
  # Find and kill process on port 5000:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
  # Find and kill process on port 5173:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process -Force
  ```

### 2. "CONTRACT_ADDRESS is not set in environment"
- **Explanation:** This is a safe notice indicating the backend is running in local/hybrid mode without an active Polygon Amoy deployment. The system functions normally, recording transactions with `blockchainStatus: 'PENDING'`. Once you deploy to Amoy, populate `CONTRACT_ADDRESS` in `server/.env`.

### 3. "Deployer account has 0 balance on amoy"
- **Symptom:** Smart contract deployment to Polygon Amoy halts with balance error.
- **Fix:** Obtain free testnet POL for your operator wallet address from [Polygon Faucet](https://faucet.polygon.technology) before running `npm run blockchain:deploy:amoy`.

### 4. Local Hardhat Address Warning
- **Warning:** **Do NOT use `0x5FbDB2315678afecb367f032d93F642f64180aa3` as the Polygon Amoy contract address.**
- **Explanation:** `0x5FbDB...` is the deterministic address generated by local Hardhat on Chain ID `31337`. Polygon Amoy (Chain ID `80002`) requires an actual contract deployment.

### 5. MongoDB Connection Failure
- **Behavior:** JusticeVault automatically detects if MongoDB is unreachable and falls back to an embedded in-memory database (`mongodb-memory-server`), ensuring zero setup hurdles during hackathon evaluations.

---

## 🔒 Security Invariants & Handling Rules

> [!CAUTION]
> **CRITICAL SECURITY RULES FOR COLLABORATORS:**
> 1. **NEVER commit `.env` files** or real private keys to Git or GitHub.
> 2. **NEVER expose your Secret Recovery Phrase** (12 or 24 seed words).
> 3. **Frontend environment variables (`VITE_*`) are public.** Never put private keys, JWT signing secrets, or database credentials in `client/.env`.
> 4. **Raw evidence must never be stored on-chain.**
> 5. **Server-calculated SHA-256 hashes are authoritative.** Client-supplied hashes are never trusted.
