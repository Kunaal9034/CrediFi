# Deployment Guide

## 1. Smart Contracts Deployment (Ethereum Sepolia)
1. Configure `contracts/.env`:
   ```env
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
   DEPLOYER_PRIVATE_KEY=...
   ```
2. Execute deployment script:
   ```bash
   npm --prefix contracts run deploy:sepolia
   ```
3. Record deployed addresses and update `backend/.env` and `frontend/.env`.

## 2. Backend Deployment (Render / Railway)
1. Provide environment variables in service dashboard:
   - `PORT=5000`
   - `MONGO_URI=...`
   - `ALCHEMY_API_KEY=...`
   - `ALCHEMY_WEBHOOK_SIGNING_KEY=...`
   - `CREDIT_REGISTRY_ADDRESS=...`
   - `LOAN_MANAGER_ADDRESS=...`
   - `LENDING_POOL_ADDRESS=...`
   - `MOCK_USDC_ADDRESS=...`
   - `CHAIN_ID=11155111`
2. Configure webhook URL in Alchemy Notify dashboard to point to `https://<backend-url>/api/webhooks/alchemy`.

## 3. Frontend Deployment (Vercel)
1. Set root directory to `frontend/`.
2. Configure build command: `npm run build`.
3. Provide `VITE_*` environment variables matching deployed contracts.
