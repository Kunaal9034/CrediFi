# JusticeVault: Complete Deployment & Configuration Guide

**Document Purpose:** A beginner-friendly, technically precise guide explaining every configuration value, secret, deployment step, and verification procedure required to run JusticeVault on a local network, Polygon Amoy Testnet, or a future production environment.

---

## Section 1 — Deployment Overview

JusticeVault integrates three application layers:
1. **Blockchain Layer (`blockchain/`):** Hardhat environment, Solidity smart contracts (`EvidenceChain.sol`), and deployment pipelines.
2. **Backend API Layer (`server/`):** Node.js / Express application, MongoDB data models, streaming SHA-256 calculation, and operator relayer service.
3. **Frontend Client Layer (`client/`):** React (Vite) single-page application with MetaMask Web3 integration and Verification Studio.

### Complete Deployment Lifecycle Flow

```
+───────────────────────────────────────────────────────────────────────────+
│                           LOCAL DEVELOPMENT                               │
│  1. Clone repository & install dependencies (root, blockchain, server, UI)│
│  2. Configure initial .env files from .env.example templates              │
│  3. Execute 14-point smart contract unit test suite (npx hardhat test)     │
+─────────────────────────────────────┬─────────────────────────────────────+
                                      │
                                      ▼
+───────────────────────────────────────────────────────────────────────────+
│                       POLYGON AMOY SETUP & DEPLOYMENT                     │
│  4. Create dedicated Operator / Relayer wallet in MetaMask                │
│  5. Obtain testnet POL from official Polygon Amoy faucet                  │
│  6. Configure OPERATOR_PRIVATE_KEY & AMOY_RPC_URL in blockchain/.env      │
│  7. Deploy EvidenceChain.sol to Polygon Amoy (Chain ID 80002)             │
│  8. Capture ACTUAL deployed contract address (0x...) from deployment logs │
│  9. Automatically / manually sync ABI to server and client directories    │
+─────────────────────────────────────┬─────────────────────────────────────+
                                      │
                                      ▼
+───────────────────────────────────────────────────────────────────────────+
│                     BACKEND & DATABASE CONFIGURATION                      │
│ 10. Generate cryptographic JWT_SECRET for session security                │
│ 11. Configure CONTRACT_ADDRESS & OPERATOR_PRIVATE_KEY in server/.env      │
│ 12. Set MONGODB_URI (local MongoDB, Atlas cluster, or embedded fallback)  │
│ 13. Select storage provider (LocalStorageProvider or Pinata IPFS)         │
│ 14. Launch backend API server (npm run dev:server)                        │
+─────────────────────────────────────┬─────────────────────────────────────+
                                      │
                                      ▼
+───────────────────────────────────────────────────────────────────────────+
│                        FRONTEND CLIENT LAUNCH                             │
│ 15. Configure VITE_CONTRACT_ADDRESS in client/.env (same as backend)      │
│ 16. Verify VITE_CHAIN_ID=80002 & VITE_RPC_URL in client/.env              │
│ 17. Launch Vite development server (npm run dev:client)                   │
+─────────────────────────────────────┬─────────────────────────────────────+
                                      │
                                      ▼
+───────────────────────────────────────────────────────────────────────────+
│                      END-TO-END VERIFICATION                             │
│ 18. Authenticate user & connect MetaMask wallet to Polygon Amoy           │
│ 19. Ingest evidence file -> verify server calculates SHA-256 digest        │
│ 20. Confirm backend relayer anchors hash on-chain (real Amoy txHash)      │
│ 21. Inspect transaction on Polygonscan (https://amoy.polygonscan.com)     │
│ 22. Perform verification test:                                            │
│     - Original file upload -> HASH MATCH (✓ VERIFIED)                     │
│     - 1-byte altered file upload -> HASH MISMATCH (✗ FLAGGED)             │
+───────────────────────────────────────────────────────────────────────────+
```

### Environment Comparison

| Attribute | Local Hardhat | Polygon Amoy Testnet | Future Production |
| :--- | :--- | :--- | :--- |
| **Chain ID** | `31337` | `80002` | `137` (Polygon Mainnet) or Custom Subnet |
| **RPC URL** | `http://127.0.0.1:8545` | `https://rpc-amoy.polygon.technology` | Dedicated Alchemy / Infura / Private Node |
| **Gas Cost** | Free (simulated) | Free (via testnet faucet POL) | Real POL / Gas token |
| **Database** | Embedded Memory / Local Mongo | MongoDB Atlas M0 (Free Tier) | Dedicated MongoDB Atlas with VPC Peering |
| **Storage** | Local Content-Addressed Disk | Local Disk / Pinata IPFS | Private IPFS Cluster with AES-256-GCM |
| **Relayer Key** | Hardhat default key (`0xac09...`) | Funded Testnet Key in `server/.env` | Hardware Security Module (KMS / HSM) |

---

## Section 2 — Placeholder → Real Value Table

The following table lists every deployment variable across the JusticeVault repository:

| Variable / File | Current Placeholder / Default | Replace With | Where To Get It | Secret? | Where Used |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SERVER: `PORT`** | `5000` | Port number (e.g. `5000`) | Standard API port (default is fine) | No | `server/.env` |
| **SERVER: `NODE_ENV`** | `development` | `development` or `production` | Set based on deployment target | No | `server/.env` |
| **SERVER: `MAX_UPLOAD_SIZE_MB`** | `500` | Integer (e.g. `500`) | System storage capacity / policy | No | `server/.env` (Multer limits) |
| **SERVER: `MONGODB_URI`** | Blank (falls back to memory) | `mongodb+srv://...` or `mongodb://127.0.0.1:27017/justicevault` | MongoDB Atlas dashboard or local MongoDB | **YES** | `server/.env` (`database.js`) |
| **SERVER: `JWT_SECRET`** | `replace_with_secure_random...` | 64-char random hex string | Generated via crypto command (Section 8) | **CRITICAL** | `server/.env` (`authMiddleware.js`) |
| **SERVER: `JWT_EXPIRES_IN`** | `24h` | Token duration (e.g. `24h`) | Security policy configuration | No | `server/.env` |
| **SERVER: `AMOY_RPC_URL`** | `https://rpc-amoy.polygon.technology` | Public RPC or Alchemy/Infura RPC URL | Polygon docs or Alchemy/Infura dashboard | **YES** (if provider URL includes key) | `server/.env` (`blockchainService.js`) |
| **SERVER: `CONTRACT_ADDRESS`** | Blank | Real deployed contract address (`0x...`) | Output of `scripts/deploy.js` on Amoy | No | `server/.env` (`blockchainService.js`) |
| **SERVER: `OPERATOR_PRIVATE_KEY`** | Blank | 64-char private key of relayer wallet (`0x...`) | Exported from MetaMask relayer account | **CRITICAL** | `server/.env` (`blockchainService.js`) |
| **SERVER: `PINATA_JWT`** | Blank | Pinata API JWT Bearer token | Pinata.cloud API Key Management | **YES** | `server/.env` (`storageService.js`) |
| **SERVER: `PINATA_API_KEY`** | Blank | Pinata Public API key (legacy option) | Pinata.cloud API Key Management | **YES** | `server/.env` (`storageService.js`) |
| **SERVER: `PINATA_API_SECRET`** | Blank | Pinata Secret API key (legacy option) | Pinata.cloud API Key Management | **CRITICAL** | `server/.env` (`storageService.js`) |
| **BLOCKCHAIN: `AMOY_RPC_URL`** | `https://rpc-amoy.polygon.technology` | Same as server `AMOY_RPC_URL` | Polygon docs or RPC provider | **YES** (if key in URL) | `blockchain/.env` (`hardhat.config.js`) |
| **BLOCKCHAIN: `OPERATOR_PRIVATE_KEY`** | Blank | Same as server `OPERATOR_PRIVATE_KEY` | MetaMask relayer account | **CRITICAL** | `blockchain/.env` (`hardhat.config.js`) |
| **BLOCKCHAIN: `POLYGONSCAN_API_KEY`** | Blank | Polygonscan API Key (Optional) | `polygonscan.com` API dashboard | **YES** | `blockchain/.env` (Contract verification) |
| **CLIENT: `VITE_API_URL`** | `http://localhost:5000/api` | Backend API base URL | Backend host configuration | No | `client/.env` (`api.js`) |
| **CLIENT: `VITE_CHAIN_ID`** | `80002` | `80002` | Polygon Amoy constant | No | `client/.env` (`Web3Context.jsx`) |
| **CLIENT: `VITE_CHAIN_NAME`** | `"Polygon Amoy Testnet"` | Network display name | Standard network title | No | `client/.env` (`Web3Context.jsx`) |
| **CLIENT: `VITE_RPC_URL`** | `https://rpc-amoy.polygon.technology` | Public RPC URL | Public RPC (never put private API key here) | No | `client/.env` (`Web3Context.jsx`) |
| **CLIENT: `VITE_BLOCK_EXPLORER_URL`**| `https://amoy.polygonscan.com` | `https://amoy.polygonscan.com` | Polygonscan Amoy URL | No | `client/.env` |
| **CLIENT: `VITE_CONTRACT_ADDRESS`** | Blank | Real deployed contract address (`0x...`) | Output of `scripts/deploy.js` on Amoy | No | `client/.env` |

---

## Section 3 — Important Contract Address Explanation

> [!WARNING]
> **DO NOT USE `0x5FbDB2315678afecb367f032d93F642f64180aa3` AS THE POLYGON AMOY CONTRACT ADDRESS!**

### Why this address exists:
- `0x5FbDB2315678afecb367f032d93F642f64180aa3` is the **deterministic default address** produced by local Hardhat network deployments when using the default account `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` at nonce 0.
- It is **not** an on-chain contract address on Polygon Amoy.

### How the real address is generated:
- The actual Polygon Amoy contract address is generated **dynamically** at the time `EvidenceChain.sol` is broadcast to Polygon Amoy (Chain ID 80002) by your funded operator account.
- The address depends on the operator wallet address and its current transaction nonce.
- The deployment script will print:
  ```
  Contract Address:      0x<ACTUAL_AMOY_CONTRACT_ADDRESS>
  ```
- You must copy that printed address into:
  1. `server/.env`:
     ```env
     CONTRACT_ADDRESS=0x<ACTUAL_AMOY_CONTRACT_ADDRESS>
     ```
  2. `client/.env`:
     ```env
     VITE_CONTRACT_ADDRESS=0x<ACTUAL_AMOY_CONTRACT_ADDRESS>
     ```
- Both backend and frontend **must point to the exact same deployed Amoy contract address**.

---

## Section 4 — How to Get the Polygon Amoy RPC URL

### What is `AMOY_RPC_URL`?
A JSON-RPC URL provides an HTTP endpoint allowing your backend and deployment scripts to communicate with the Polygon Amoy testnet blockchain (querying balances, reading contract state, and broadcasting transactions).

### Configured Default in JusticeVault
The JusticeVault architecture is pre-configured to use the official Polygon Amoy public endpoint:
```
https://rpc-amoy.polygon.technology
```

### Dedicated RPC Provider Alternatives (Recommended for Production / Stability)
Public RPC endpoints can occasionally experience rate limits or temporary latency. If you prefer a dedicated node provider:
1. **Alchemy:**
   - Sign in at `https://dashboard.alchemy.com/`.
   - Create an app -> Select **Polygon Amoy**.
   - Copy the HTTPS URL (`https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY`).
2. **Infura:**
   - Sign in at `https://app.infura.io/`.
   - Create an API key -> Select **Polygon Amoy**.
   - Copy the endpoint (`https://polygon-amoy.infura.io/v3/YOUR_API_KEY`).

### Where to put it:
In `server/.env`:
```env
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```
In `blockchain/.env`:
```env
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

> [!NOTE]
> If your provider URL contains a secret API key, **never put that private RPC URL into `client/.env`**. The frontend must always use the public RPC URL (`https://rpc-amoy.polygon.technology`).

---

## Section 5 — How to Create the Operator Wallet

### The Role of `OPERATOR_PRIVATE_KEY`
The Operator Wallet acts as the **backend relayer**. When an authorized officer uploads digital evidence, the backend server uses this wallet's private key to sign and submit the on-chain transaction to `EvidenceChain.sol`, paying the network gas fee.

### Critical Security Boundaries
- This is **NOT** a user's normal personal wallet.
- This private key belongs **exclusively** to the backend relayer infrastructure.
- **NEVER** place this key in `client/.env`.
- **NEVER** prefix this key with `VITE_` (doing so bundles it into public browser JavaScript).
- **NEVER** commit this key to GitHub, share it in screenshots, or send it to AI assistants.

### Step-by-Step Creation in MetaMask
1. Open the **MetaMask** browser extension.
2. Click on the account selector dropdown at the top of the extension.
3. Select **"Add account or hardware wallet"** -> Click **"Add a new account"**.
4. Name the account clearly: `JusticeVault Relayer / Operator`.
5. Click **Create**.
6. Click the three vertical dots (menu) next to the new account -> Select **Account details**.
7. Click **"Show private key"**.
8. Enter your MetaMask password to unlock.
9. Click and hold to reveal, then copy the 64-character hexadecimal key.

### Configuration
In `server/.env`:
```env
OPERATOR_PRIVATE_KEY=0xYOUR_64_CHAR_HEXADECIMAL_PRIVATE_KEY_HERE
```
In `blockchain/.env`:
```env
OPERATOR_PRIVATE_KEY=0xYOUR_64_CHAR_HEXADECIMAL_PRIVATE_KEY_HERE
```

---

## Section 6 — How to Fund the Operator Wallet

Deploying smart contracts and submitting evidence records on Polygon Amoy requires testnet **POL** tokens to pay for transaction execution gas.

### Step-by-Step Funding Procedure
1. **Copy the Operator Public Address:**
   - In MetaMask, select your newly created `JusticeVault Relayer / Operator` account.
   - Click the account name to copy the public address (`0x...`).
2. **Acquire Testnet POL from an Official Faucet:**
   - Use an official Polygon-supported Amoy faucet and verify the current faucet URL before use.
   - Recommended official source: **Polygon Official Faucet** (`https://faucet.polygon.technology/`).
   - Select **Network:** `Polygon Amoy`.
   - Select **Token:** `POL`.
   - Paste your Operator Wallet public address (`0x...`).
   - Click **Submit** / **Confirm**.
3. **Alternative Faucets (if primary is congested):**
   - Alchemy Amoy Faucet (`https://www.alchemy.com/faucets/polygon-amoy`).
4. **Verify Wallet Balance:**
   - Open the Polygon Amoy Block Explorer:
     ```
     https://amoy.polygonscan.com/address/<YOUR_OPERATOR_WALLET_ADDRESS>
     ```
   - Confirm that the account has at least **0.5 to 1.0 POL**.
   - In MetaMask, ensure the network is switched to **Polygon Amoy** to view your balance directly.

---

## Section 7 — How to Get `MONGODB_URI`

JusticeVault uses MongoDB via Mongoose to store user profiles, investigative case dossiers, evidence metadata, and custody histories.

### Option A: Local MongoDB (For Local Machine Development)
If you have MongoDB Community Server installed locally:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/justicevault
```

> [!TIP]
> **Embedded Fallback:** If `MONGODB_URI` is left blank, the JusticeVault backend (`server/src/config/database.js`) will automatically bootstrap an embedded in-memory MongoDB server (`mongodb-memory-server`) for zero-configuration testing.

### Option B: MongoDB Atlas Cloud (Recommended for Shared / Cloud Demonstrations)
MongoDB Atlas is a fully managed cloud database service.

**How to create your Atlas database:**
1. Sign up for a free account at `https://www.mongodb.com/cloud/atlas`.
2. Create a free **M0 Shared Cluster**.
3. Under **Security** -> **Database Access**, create a database user:
   - Example Username: `justicevault_admin`
   - Password: Click "Autogenerate Secure Password" and copy it.
4. Under **Security** -> **Network Access**, click **Add IP Address**:
   - For local development / hackathon testing, select **"Allow Access from Anywhere"** (`0.0.0.0/0`).
5. Under **Deployments** -> **Database**, click **Connect** -> Select **Drivers** (Node.js).
6. Copy the connection string format:
   ```
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/justicevault?retryWrites=true&w=majority
   ```
7. Replace `<username>` and `<password>` with your database user credentials.

### Configuration
In `server/.env`:
```env
MONGODB_URI=mongodb+srv://justicevault_admin:YourSecretPasswordHere@cluster0.abcde.mongodb.net/justicevault?retryWrites=true&w=majority
```
*(Never put this URI or password in `client/.env`.)*

---

## Section 8 — How to Generate `JWT_SECRET`

### What is `JWT_SECRET`?
The `JWT_SECRET` is a cryptographic secret key used by the backend server to sign and verify JSON Web Tokens (JWT) for user session authentication.

> [!CAUTION]
> Never use predictable strings like `"secret"`, `"justicevault"`, `"password"`, or `"123456"`. An attacker who guesses your JWT secret can forge tokens and impersonate administrators, officers, or judges.

### Safe Command to Generate a High-Entropy Secret
Open Windows PowerShell and run this command:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example Output:**
```
9e2f4a18b6c73d5e0a8f1234567890abcdef1234567890abcdef1234567890abcd
```

### Configuration
In `server/.env`:
```env
JWT_SECRET=9e2f4a18b6c73d5e0a8f1234567890abcdef1234567890abcdef1234567890abcd
```
*(Never place `JWT_SECRET` into `client/.env`.)*

---

## Section 9 — Pinata / IPFS Configuration

### How Storage Works in JusticeVault
JusticeVault implements a hybrid storage abstraction (`server/src/services/storageService.js`):
1. **Local Storage Fallback (`LocalStorageProvider`):** Files are stored in `server/uploads/ipfs_store` using content-addressed filenames based on their SHA-256 hash.
2. **Decentralized Pinning (`PinataIPFSProvider`):** Files are pinned to the IPFS network via the Pinata Cloud API.

### Which Pinata Credentials to Configure
The JusticeVault backend supports **either** modern JWT authentication or legacy API keys:
- **Option 1 (Recommended):** `PINATA_JWT` (Pinata's modern API token).
- **Option 2 (Legacy):** `PINATA_API_KEY` and `PINATA_API_SECRET`.

> [!NOTE]
> You do **not** need to configure both. Setting `PINATA_JWT` alone is sufficient and recommended. If neither is set, JusticeVault automatically falls back to local content-addressed storage.

### How to Obtain Pinata Credentials
1. Sign up for a free account at `https://www.pinata.cloud/`.
2. Navigate to **API Keys** -> Click **"New Key"**.
3. Under Permissions, enable **"pinFileToIPFS"** (or Admin for full access).
4. Name your key: `JusticeVault-Evidence-Pinner`.
5. Click **Generate Key**.
6. Copy the **JWT** string (starts with `eyJ...`).

### Configuration
In `server/.env`:
```env
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_full_pinata_jwt_token_here
```

### Public IPFS Security Warning
- Files pinned to public IPFS gateways are accessible to **anyone** who knows or computes the Content Identifier (CID).
- Backend authentication proxies internal downloads, but does **not** make an unencrypted public IPFS object private.
- For hackathon evaluations, `LocalStorageProvider` is recommended for local confidential evidence, while public IPFS should only be used for non-sensitive fictional demo assets.

---

## Section 10 — Deploying `EvidenceChain.sol` to Polygon Amoy

### Pre-Deployment Verification
Before deploying to Polygon Amoy, verify that:
1. Your operator wallet is funded with Amoy POL (Section 6).
2. `blockchain/.env` contains your `AMOY_RPC_URL` and `OPERATOR_PRIVATE_KEY`.
3. All smart contract unit tests pass locally.

### Exact Deployment Commands

From the workspace root directory:
```powershell
# 1. Run unit test suite to ensure contract validity
npm run blockchain:test

# 2. Compile contracts
npm run blockchain:compile

# 3. Deploy to Polygon Amoy Testnet
npm run blockchain:deploy:amoy
```

Alternatively, from within the `blockchain/` directory:
```powershell
cd blockchain
npx hardhat test
npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy
```

### Expected Deployment Output
The deployment script (`blockchain/scripts/deploy.js`) will execute pre-flight checks, deploy the contract, wait for block confirmation, verify read queries, save the deployment record, and synchronize the ABI:

```
====================================================
JusticeVault: EvidenceChain Deployment Pipeline
Target Network: amoy
====================================================
Deployer / Operator Address: 0xYourOperatorAddressHere
Account Balance: 1.25 POL/ETH
Connected Chain ID: 80002

Initiating contract deployment...
Deployment Transaction Hash: 0x9f8e7d6c5b4a3...
Waiting for block confirmation...
====================================================
>>> EvidenceChain Deployed Successfully!
Contract Address:     0x1234567890AbCdEf1234567890aBcDeF12345678
Deployer/Operator:    0xYourOperatorAddressHere
Network Name:         amoy
Chain ID:             80002
Transaction Hash:     0x9f8e7d6c5b4a3...
====================================================

Verifying on-chain contract state query...
Query Verified: Contract Owner = 0xYourOperatorAddressHere
Query Verified: Deployer Operator Status = true
Deployment record saved to: blockchain/deployments/amoy.json
ABI synchronized to: server/src/config/contractAbi.json
ABI synchronized to: client/src/contracts/contractAbi.json
Deployment and ABI synchronization complete.
```

---

## Section 11 — Where the Actual Contract Address Comes From

### Distinguishing Contract Address vs. Transaction Hash

> [!IMPORTANT]
> The **Contract Address** and the **Deployment Transaction Hash** are two completely different values!

```
Deployment Output:
Contract Address:      0x1234567890AbCdEf1234567890aBcDeF12345678   <-- CONTRACT ADDRESS
Transaction Hash:      0x9f8e7d6c5b4a3210fedcba09876543210abcdef...  <-- TRANSACTION HASH
```

1. **Contract Address (`0x1234...`):**
   - **What it is:** The permanent on-chain address where your smart contract code lives on Polygon Amoy.
   - **Where it is used:**
     - In `server/.env`: `CONTRACT_ADDRESS=0x1234567890AbCdEf1234567890aBcDeF12345678`
     - In `client/.env`: `VITE_CONTRACT_ADDRESS=0x1234567890AbCdEf1234567890aBcDeF12345678`
2. **Transaction Hash (`0x9f8e...`):**
   - **What it is:** The receipt identifier for the specific transaction that deployed the contract.
   - **Where it is used:** Used for auditing and inspecting the deployment on Polygonscan. It is **not** the contract address.

---

## Section 12 — How to Verify the Contract on Polygonscan

After deployment, verify that the contract exists on the official Polygon Amoy block explorer:

1. Copy your real deployed contract address (`0x...`).
2. Open your web browser and navigate to:
   ```
   https://amoy.polygonscan.com
   ```
3. Paste the contract address into the search bar at the top and press Enter.
4. Verify the following on the explorer page:
   - **Balance:** Displays current balance (typically 0 POL).
   - **Contract Creator:** Displays your Operator Wallet address (`0x...`).
   - **Creation Tx:** Displays the deployment transaction hash.
   - **Token Tracker / Contract:** Displays `EvidenceChain`.
5. Click on the creation transaction hash to view gas fees paid, timestamp, and block number.

---

## Section 13 — ABI Synchronization

### What is the ABI?
The **Application Binary Interface (ABI)** is a JSON file that defines the methods, inputs, outputs, and events of your smart contract. Both the backend relayer and the frontend Web3 interface need the exact ABI matching your deployed contract.

### File Locations in JusticeVault
- **Source Artifact:** `blockchain/artifacts/contracts/EvidenceChain.sol/EvidenceChain.json`
- **Backend ABI:** `server/src/config/contractAbi.json`
- **Frontend ABI:** `client/src/contracts/contractAbi.json`

### Automatic Synchronization
The deployment script (`blockchain/scripts/deploy.js`) automatically synchronizes the ABI and deployed address to both the server and client upon execution.

### Manual Synchronization Command
If you ever edit `EvidenceChain.sol` and want to compile and sync without re-deploying:
```powershell
cd blockchain
npx hardhat compile
node -e "
const fs = require('fs');
const artifact = JSON.parse(fs.readFileSync('artifacts/contracts/EvidenceChain.sol/EvidenceChain.json'));
const payload = { address: process.env.CONTRACT_ADDRESS || '', abi: artifact.abi };
fs.writeFileSync('../server/src/config/contractAbi.json', JSON.stringify(payload, null, 2));
fs.writeFileSync('../client/src/contracts/contractAbi.json', JSON.stringify(payload, null, 2));
console.log('ABI synchronized successfully.');
"
```

---

## Section 14 — Server `.env` Specification

Create the file `server/.env` using this clean template:

```env
# Server Runtime
PORT=5000
NODE_ENV=development
MAX_UPLOAD_SIZE_MB=500

# Database Configuration
# Leave blank for automatic in-memory embedded MongoDB, or provide an Atlas URI
MONGODB_URI=

# Security Secrets (NEVER expose to frontend or git)
JWT_SECRET=replace_with_crypto_generated_secret_from_section_8
JWT_EXPIRES_IN=24h

# Blockchain Relayer (Polygon Amoy Testnet)
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
CONTRACT_ADDRESS=0xYourActualDeployedAmoyContractAddressHere
OPERATOR_PRIVATE_KEY=0xYourFundedOperatorPrivateKeyHere

# Off-Chain Storage (Optional: Pinata IPFS; blank = local storage fallback)
PINATA_JWT=
```

### Server Variable Reference Table

| Variable | Where To Get It | Secret? | Why It Is Needed |
| :--- | :--- | :--- | :--- |
| `PORT` | Local decision (default: `5000`) | No | Network port Express listens on. |
| `NODE_ENV` | `development` or `production` | No | Enables dev logging and error stack traces. |
| `MAX_UPLOAD_SIZE_MB` | System capacity (default: `500`) | No | Enforces file streaming upload thresholds. |
| `MONGODB_URI` | MongoDB Atlas dashboard | **YES** | Authenticates database queries and document storage. |
| `JWT_SECRET` | PowerShell `crypto.randomBytes` command | **CRITICAL** | Cryptographically signs session auth tokens. |
| `JWT_EXPIRES_IN` | Session policy (default: `24h`) | No | Sets expiration window for JWT session tokens. |
| `AMOY_RPC_URL` | Polygon docs or Alchemy/Infura | **YES** (if key in URL) | Connects backend ethers provider to Amoy testnet. |
| `CONTRACT_ADDRESS` | `scripts/deploy.js` console output | No | Identifies on-chain EvidenceChain contract instance. |
| `OPERATOR_PRIVATE_KEY`| MetaMask Operator Account details | **CRITICAL** | Signs on-chain evidence registration and custody transactions. |
| `PINATA_JWT` | Pinata.cloud API Keys dashboard | **YES** | Authenticates evidence file pinning to IPFS. |

---

## Section 15 — Client `.env` Specification

Create the file `client/.env` using this clean template:

```env
# Client Configuration (Exposed in public browser bundle)
VITE_API_URL=http://localhost:5000/api
VITE_CHAIN_ID=80002
VITE_CHAIN_NAME="Polygon Amoy Testnet"
VITE_RPC_URL=https://rpc-amoy.polygon.technology
VITE_BLOCK_EXPLORER_URL=https://amoy.polygonscan.com
VITE_CONTRACT_ADDRESS=0xYourActualDeployedAmoyContractAddressHere
```

### Critical Client Security Rules
- Every variable prefixed with `VITE_` is compiled into the public client-side JavaScript bundle and is visible to any website visitor via browser Developer Tools.
- **NO PRIVATE KEYS** (the client wallet uses MetaMask browser extension signing; it never requires the relayer key).
- **NO JWT_SECRET** (the client only receives and stores the user's signed session token).
- **NO MONGODB CREDENTIALS** (the client communicates exclusively via Express REST endpoints).
- **NO PINATA SECRETS** (file uploads are streamed through the backend).
- `VITE_CONTRACT_ADDRESS` is public knowledge and is safe to expose in the frontend.

---

## Section 16 — Git Security & Secret Management

### What Must Be Ignored
Ensure that all actual `.env` files are excluded from git version control in [.gitignore](file:///c:/Users/skuna/OneDrive/Desktop/Hackathon/.gitignore):

```gitignore
# Environment files
.env
.env.local
.env.*.local
server/.env
client/.env
blockchain/.env
```

### Verification Command
To verify that no `.env` files are tracked by git, run this command from the workspace root:
```powershell
git status --ignored
```
Confirm that `server/.env`, `client/.env`, and `blockchain/.env` are listed under **Ignored files** and **NEVER** under **Changes to be committed**.

### Rules for Example Files
- `.env.example` files contain template variable names with dummy placeholders and **SHOULD** be committed to GitHub.
- `.env` files contain actual passwords, private keys, and secrets and **MUST NEVER** be committed to GitHub.

---

## Section 17 — Pre-Deployment Checklist

Before launching the application or deploying to Polygon Amoy, verify each item:

- [ ] Node.js (v18+) and npm installed (`node -v`, `npm -v`).
- [ ] Dependencies installed across root, `blockchain/`, `server/`, and `client/`.
- [ ] Smart contracts compile with zero errors (`npm run blockchain:compile`).
- [ ] All 14 smart contract unit tests pass (`npm run blockchain:test`).
- [ ] MetaMask browser extension installed.
- [ ] Dedicated Operator / Relayer wallet created in MetaMask.
- [ ] Operator private key securely copied (never exposed to client or git).
- [ ] Operator wallet funded with at least 0.5 to 1.0 testnet POL.
- [ ] `AMOY_RPC_URL` configured in `blockchain/.env` and `server/.env`.
- [ ] `EvidenceChain.sol` deployed to Polygon Amoy (Chain ID 80002).
- [ ] Real deployed contract address recorded (starts with `0x...`).
- [ ] Deployment transaction hash recorded.
- [ ] Backend `server/.env` updated with `CONTRACT_ADDRESS` and `OPERATOR_PRIVATE_KEY`.
- [ ] Frontend `client/.env` updated with matching `VITE_CONTRACT_ADDRESS`.
- [ ] ABI synchronized to `server/src/config/contractAbi.json` and `client/src/contracts/contractAbi.json`.
- [ ] High-entropy `JWT_SECRET` generated and placed in `server/.env`.
- [ ] Database configured (`MONGODB_URI` set, or local fallback verified).
- [ ] Storage configured (`PINATA_JWT` set, or local fallback verified).
- [ ] Git status verified: no `.env` files or secret keys tracked.
- [ ] Backend API starts cleanly (`npm run dev:server`).
- [ ] Frontend client starts cleanly (`npm run dev:client`).

---

## Section 18 — Post-Deployment Verification

Perform these sequential verification steps to validate system integrity:

| Step | Verification Action | Expected Result | Actual Result Check |
| :--- | :--- | :--- | :--- |
| **1** | Start Backend (`npm run dev:server`) | Output shows `Server running on port 5000` | Terminal output |
| **2** | MongoDB Connection | Logs `MongoDB Connected` or `Embedded Memory Server active` | Database log |
| **3** | Amoy RPC Connectivity | Logs `Connected to network at https://rpc-amoy...` | Backend log |
| **4** | Operator Wallet Detection | Logs operator public address with valid balance | Backend startup log |
| **5** | Contract Address Resolution | Logs matching `CONTRACT_ADDRESS` | Backend startup log |
| **6** | Contract Read Call | Health check queries `contract.owner()` without error | API test (`/api/stats`) |
| **7** | Connect MetaMask | Frontend shows connected wallet address badge | Navbar Web3 badge |
| **8** | Network Validation | Web3 indicator displays `Polygon Amoy (80002)` in green | Navbar network badge |
| **9** | Evidence Upload | Officer registers evidence file (e.g. CCTV video) | Form submission 200 OK |
| **10** | Server-Side Hashing | Backend computes exact 64-char SHA-256 hex stream digest | API response `sha256` |
| **11** | Real Blockchain Tx | Relayer executes transaction on Polygon Amoy | Real `blockchainTx` hash returned |
| **12** | Polygonscan Explorer | Search `blockchainTx` hash on `https://amoy.polygonscan.com` | Tx shows `Success` on Amoy |
| **13** | Custody Event Logging | Officer transfers custody to Forensic Specialist | On-chain `TRANSFERRED` event logged |
| **14** | Original Verification | Drop identical file into Verification Studio | Badge displays: **`✓ VERIFIED / HASH MATCH`** |
| **15** | Tamper Detection | Drop 1-byte modified file into Verification Studio | Badge displays: **`✗ FAILED / HASH MISMATCH`** |

---

## Section 19 — Troubleshooting Guide

### 1. `insufficient funds for intrinsic transaction cost`
- **Symptom:** Deployment script or backend transaction reverts with `insufficient funds`.
- **Likely Cause:** The Operator / Relayer wallet has 0 POL or balance is below minimum gas requirement.
- **What to Check:** Check balance on `https://amoy.polygonscan.com/address/<OPERATOR_ADDRESS>`.
- **How to Fix:** Visit a Polygon Amoy faucet (Section 6) and send testnet POL to the operator address.

### 2. `getaddrinfo ENOTFOUND rpc-amoy.polygon.technology`
- **Symptom:** Network error during deployment or backend startup.
- **Likely Cause:** DNS failure, internet connection dropped, or public RPC endpoint is temporarily unreachable.
- **What to Check:** Try pinging `rpc-amoy.polygon.technology` or testing the URL in your browser.
- **How to Fix:** Switch to an alternative RPC endpoint (e.g., Alchemy or Infura Amoy URL in Section 4).

### 3. `wrong chain ID` / `MetaMask wrong network`
- **Symptom:** MetaMask prompts network error or transactions fail.
- **Likely Cause:** MetaMask is connected to Ethereum Mainnet, Sepolia, or Hardhat instead of Polygon Amoy (80002).
- **What to Check:** Check active network in MetaMask header.
- **How to Fix:** Click the network switcher in JusticeVault's navbar to trigger automatic network switching to Polygon Amoy.

### 4. `EvidenceChain: Caller is not an authorized operator`
- **Symptom:** Contract call reverts with operator error.
- **Likely Cause:** The transaction is being submitted by an account that is neither the contract owner nor an authorized operator.
- **What to Check:** Check `authorizedOperators[walletAddress]` on the contract.
- **How to Fix:** Ensure `OPERATOR_PRIVATE_KEY` in `server/.env` corresponds to the deployer account or call `setOperator(relayerAddress, true)` using the deployer wallet.

### 5. `CONTRACT_ADDRESS is not set in environment`
- **Symptom:** Backend logs warning `Running in unconfigured mode`.
- **Likely Cause:** `CONTRACT_ADDRESS` was left blank in `server/.env`.
- **What to Check:** Open `server/.env` and inspect `CONTRACT_ADDRESS`.
- **How to Fix:** Paste your real deployed Amoy contract address into `server/.env` and restart the backend.

### 6. `ABI mismatch` / `call revert exception`
- **Symptom:** Method calls fail with `missing revert data` or unknown method selector.
- **Likely Cause:** The contract was recompiled with changes, but the ABI in `server/src/config/contractAbi.json` or `client/src/contracts/contractAbi.json` was not synchronized.
- **What to Check:** Check timestamps and method definitions in the ABI files.
- **How to Fix:** Run `npm run blockchain:compile` and synchronize the ABI as described in Section 13.

### 7. `Pinata upload warning: unauthorized`
- **Symptom:** Backend console displays Pinata 401 Unauthorized warning.
- **Likely Cause:** Expired or malformed `PINATA_JWT` or incorrect API keys.
- **What to Check:** Check `PINATA_JWT` in `server/.env`.
- **How to Fix:** Regenerate a new API key on Pinata.cloud (Section 9) or leave blank to use local content-addressed storage.

### 8. `CORS error` in browser console
- **Symptom:** Frontend API calls fail with `Blocked by CORS policy`.
- **Likely Cause:** Backend server is running on a different port or `VITE_API_URL` in `client/.env` does not point to `http://localhost:5000/api`.
- **What to Check:** Inspect `VITE_API_URL` in `client/.env` and ensure backend is running.
- **How to Fix:** Update `client/.env` to `VITE_API_URL=http://localhost:5000/api` and restart the Vite dev server.

---

## Section 20 — Final "What I Actually Need to Replace"

Before running JusticeVault on Polygon Amoy, these are the **8 essential values** you personally need to obtain:

| # | Essential Value | Where to Get It | Where to Put It | Is It Secret? |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Polygon Amoy RPC URL** | Official docs or Alchemy dashboard | `server/.env` & `blockchain/.env` | **YES** if key in URL |
| **2** | **Operator Wallet Address** | Created in MetaMask (Section 5) | Used for funding / explorer checks | No (Public) |
| **3** | **Operator Private Key** | Exported from MetaMask (Section 5) | `server/.env` & `blockchain/.env` | **CRITICAL SECRET** |
| **4** | **Amoy Testnet POL** | Official Polygon Amoy Faucet (Section 6) | Sent directly to Operator Address | No |
| **5** | **MongoDB Connection String** | MongoDB Atlas (Section 7) or blank for local | `server/.env` (`MONGODB_URI`) | **YES** |
| **6** | **JWT Secret Key** | Generated via PowerShell command (Section 8) | `server/.env` (`JWT_SECRET`) | **CRITICAL SECRET** |
| **7** | **Pinata JWT Token** | Pinata.cloud dashboard (Section 9) or blank | `server/.env` (`PINATA_JWT`) | **YES** |
| **8** | **ACTUAL Deployed Contract Address**| Printed by `scripts/deploy.js` on Amoy | `server/.env` & `client/.env` | No (Public) |

> [!IMPORTANT]
> **Key Reminders:**
> - The EvidenceChain contract address is **NOT** something you manually invent. You receive it from the deployment command output after deploying `EvidenceChain.sol` to Polygon Amoy.
> - The **deployment transaction hash** and the **contract address** are different values. Put the contract address in `CONTRACT_ADDRESS` and `VITE_CONTRACT_ADDRESS`.

---

## Repository-Specific Values That Still Need Verification

Before initiating deployment, verify these environment-specific items in your setup:

1. **User Operator Private Key:** You must generate your own dedicated relayer account in MetaMask and export its private key. No private key is pre-configured in the repository.
2. **Amoy Faucet Availability:** Testnet faucets periodically adjust rate limits or require third-party sign-ins. Verify faucet availability before initiating deployment.
3. **MongoDB Hosting Decision:** Decide whether to use the built-in embedded in-memory database (suitable for single-session local testing) or provision a persistent MongoDB Atlas cluster.
4. **IPFS Pinning Option:** Decide whether you want to pin fictional demo assets to Pinata Cloud (requires free Pinata account) or use the built-in local content-addressed storage fallback.
