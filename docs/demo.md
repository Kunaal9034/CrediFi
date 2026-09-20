# Hackathon Demo Runbook (Hack in Hills '26)

## Step-by-Step Demonstration

1. **MetaMask Setup**:
   - Ensure MetaMask is configured for Sepolia Testnet.
   - Prepare two demo accounts: **Borrower** and **Lender**.

2. **Step 1: Onchain Credit Onboarding**:
   - Borrower connects MetaMask.
   - Dashboard shows default score `500`, Tier `Fair`, and borrowing power `$500.00`.

3. **Step 2: Faucet Minting**:
   - Navigate to Faucet modal / component.
   - Mint 1,000 MockUSDC to Lender wallet for liquidity.

4. **Step 3: Loan Request**:
   - Borrower opens `/borrow`.
   - Requests loan: `250 USDC`, `10% APR`, `7 Days Duration`.
   - Signs MetaMask transaction -> `LoanCreated` event emitted on Sepolia.
   - Transaction progress displays submitted -> confirmed -> link on Etherscan.

5. **Step 4: Peer-to-Peer Funding**:
   - Lender connects MetaMask, navigates to `/lend`.
   - Sees the open loan requested by Borrower.
   - Approves MockUSDC transfer and executes `fundLoan`.
   - Borrower receives 250 MockUSDC; Loan status updates to `ACTIVE`.

6. **Step 5: Repayment & Dynamic Credit Score Boost**:
   - Borrower navigates to `/loans`.
   - Clicks "Repay Loan".
   - Approves MockUSDC and signs repayment.
   - Funds transfer to Lender; `CreditRegistry` raises credit score to `550`.
   - Borrower's borrowing power immediately increases.

7. **Step 6: Protocol Analytics**:
   - Navigate to `/analytics` to see Recharts visual graphs of real volume, loans funded, repayment rates, and indexed events.
