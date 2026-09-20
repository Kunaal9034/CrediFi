# CrediFi — Deployment Guide & Onchain Manifest

This document records the official deployment, configuration, verification, and live onchain validation of the **CrediFi** smart contract protocol on **Ethereum Sepolia**.

---

## 1. Network & Target Specifications

| Parameter | Value |
|---|---|
| **Network Name** | Ethereum Sepolia Testnet |
| **Chain ID** | `11155111` |
| **RPC Provider** | Alchemy (`https://eth-sepolia.g.alchemy.com/v2/...`) |
| **Explorer** | [Sepolia Etherscan](https://sepolia.etherscan.io) |
| **Deployer Public Address** | `0x5f2a6B32228A1B911128cB11Dd8E0ce94dd6b565` |
| **Deployment Timestamp** | `2026-09-20T10:11:25.010Z` |
| **Solidity Compiler** | `0.8.20` (Optimizer: Enabled, 200 runs) |

---

## 2. Deployed Contract Addresses & Etherscan Verification

All four contracts were deployed in strict topological order and verified on Sepolia Etherscan:

| Contract | Deployed Address | Deployment Tx Hash | Etherscan Status | Explorer Link |
|---|---|---|:---:|---|
| **MockUSDC** | `0xfaaF91778853F35FB7Db545dc3586aFc354103d0` | `0x4787d9cc9c8dc9e4061addd9b38f9c80f3d0e57e8f14e4c35e8978b472392d9a` | **VERIFIED** | [View on Etherscan](https://sepolia.etherscan.io/address/0xfaaF91778853F35FB7Db545dc3586aFc354103d0#code) |
| **CreditRegistry** | `0x9b117D9528c43Fb2938e43172b1935f38F2C6f90` | `0xe4aed1f3aabc7c59a5487bf7f02c5d735eb0ad06d60c41b017a769a4e44cf1f7` | **VERIFIED** | [View on Etherscan](https://sepolia.etherscan.io/address/0x9b117D9528c43Fb2938e43172b1935f38F2C6f90#code) |
| **LendingPool** | `0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5` | `0x44affe46fa17f59bc4319e7d14cbb61bc283a238003d5db36d89ca53fa31358a` | **VERIFIED** | [View on Etherscan](https://sepolia.etherscan.io/address/0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5#code) |
| **LoanManager** | `0x21b39401646D783690E3902C90963c711Ff7cC1C` | `0x0bd69fb3dc113d22394dd21c861d86b946ab46a9b1938b4bc1af627bd2761d20` | **VERIFIED** | [View on Etherscan](https://sepolia.etherscan.io/address/0x21b39401646D783690E3902C90963c711Ff7cC1C#code) |

---

## 3. Protocol Authorization & Interlinkage Transactions

Following contract deployment, inter-contract authorizations were established onchain with 2 block confirmations:

| Action | Function Call | Transaction Hash | Target Address |
|---|---|---|---|
| **Authorize LoanManager in CreditRegistry** | `CreditRegistry.setLoanManager(0x21b3...)` | `0x1951fe587120f76455d880138e1e38989935f329b6ef4b704af2622fc968b8be` | `0x21b39401646D783690E3902C90963c711Ff7cC1C` |
| **Authorize LoanManager in LendingPool** | `LendingPool.setLoanManager(0x21b3...)` | `0x1fe8b29b0a0033399a14307f23f4515b66770310f1ce0a0ec8012abe0a72311a` | `0x21b39401646D783690E3902C90963c711Ff7cC1C` |

Public Etherscan Transaction Links:
- [CreditRegistry Authorization Tx](https://sepolia.etherscan.io/tx/0x1951fe587120f76455d880138e1e38989935f329b6ef4b704af2622fc968b8be)
- [LendingPool Authorization Tx](https://sepolia.etherscan.io/tx/0x1fe8b29b0a0033399a14307f23f4515b66770310f1ce0a0ec8012abe0a72311a)

---

## 4. Controlled Smoke Test Transaction

To validate live transaction execution, event indexing, and gas mechanics without triggering financial loans prematurely, a controlled faucet test was executed:

- **Contract**: `MockUSDC` (`0xfaaF91778853F35FB7Db545dc3586aFc354103d0`)
- **Action**: `faucet(0x5f2a6B32228A1B911128cB11Dd8E0ce94dd6b565, 100000000)` (100 mUSDC)
- **Transaction Hash**: `0xbfb49ec3d7237ad959d78795ecccc32c48a9037534a2058c1a4e51d685217afc`
- **Block**: `11743679`
- **Result**: Recipient balance confirmed at `100.0 mUSDC`.
- **Etherscan Link**: [View Faucet Smoke Test Tx](https://sepolia.etherscan.io/tx/0xbfb49ec3d7237ad959d78795ecccc32c48a9037534a2058c1a4e51d685217afc)

---

## 5. Live Onchain Validation Summary

Live read-only calls directly against Sepolia RPC confirmed:

1. **Chain ID**: `11155111` (matches Sepolia strictly).
2. **Bytecode Verification**:
   - `MockUSDC`: 2,599 bytes
   - `CreditRegistry`: 3,487 bytes
   - `LendingPool`: 2,740 bytes
   - `LoanManager`: 6,604 bytes
3. **Protocol Interlinkage Graph**:
   - `CreditRegistry.loanManager()` == `0x21b39401646D783690E3902C90963c711Ff7cC1C`
   - `LendingPool.loanManager()` == `0x21b39401646D783690E3902C90963c711Ff7cC1C`
   - `LendingPool.token()` == `0xfaaF91778853F35FB7Db545dc3586aFc354103d0`
   - `LoanManager.creditRegistry()` == `0x9b117D9528c43Fb2938e43172b1935f38F2C6f90`
   - `LoanManager.lendingPool()` == `0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5`
4. **Metadata & Constants**:
   - `MockUSDC`: Name = "Mock USD Coin", Symbol = "mUSDC", Decimals = 6.
   - `CreditRegistry`: `BASE_SCORE` = 500, `MIN_SCORE` = 300, `MAX_SCORE` = 850.
   - `LoanManager`: Initial `loanCounter` = 0.

---

## 6. Deployment Command & Reproducibility

### Environment Variables
Environment variables must be configured in `contracts/.env` (which is strictly ignored by git):
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x_prefix
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Commands
- **Deploy to Sepolia**:
  ```bash
  npm --prefix contracts run deploy:sepolia
  ```
- **Verify Contracts on Etherscan**:
  ```bash
  npm --prefix contracts run verify:sepolia
  ```
- **Run Live Onchain Validation**:
  ```bash
  npm --prefix contracts run validate:sepolia
  ```
- **Run Controlled Faucet Smoke Test**:
  ```bash
  npx --prefix contracts hardhat run scripts/smokeTest.js --network sepolia
  ```

---

## 7. Security Precautions
- **No private keys or API keys** are stored in any source code, documentation, git history, or deployment manifests.
- `.env` files are tracked in `.gitignore` across the entire monorepo.
- The deployer wallet remaining balance is `0.0456 ETH` (no mainnet funds were ever used or requested).
- Contract code has been verified and matches the local audited repository byte-for-byte.
