const hre = require("hardhat");
const deployments = require("../deployments/sepolia.json");

async function main() {
  console.log("==================================================");
  console.log("CREDIFI PHASE 10 — SEPOLIA LENDER FUNDING SMOKE TEST");
  console.log("==================================================");

  const [borrowerSigner] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Borrower Wallet: ${borrowerSigner.address}`);

  const mockUSDCAddress = deployments.contracts.MockUSDC.address;
  const creditRegistryAddress = deployments.contracts.CreditRegistry.address;
  const lendingPoolAddress = deployments.contracts.LendingPool.address;
  const loanManagerAddress = deployments.contracts.LoanManager.address;

  const mockUSDC = await hre.ethers.getContractAt("MockUSDC", mockUSDCAddress);
  const creditRegistry = await hre.ethers.getContractAt("CreditRegistry", creditRegistryAddress);
  const lendingPool = await hre.ethers.getContractAt("LendingPool", lendingPoolAddress);
  const loanManager = await hre.ethers.getContractAt("LoanManager", loanManagerAddress);

  // 1. Verify Target Loan #1 Initial State
  const loanId = 1;
  const loanBefore = await loanManager.getLoan(loanId);
  console.log("\n--- Target Loan #1 State Before Funding ---");
  console.log(`Loan ID: #${loanBefore.loanId}`);
  console.log(`Borrower: ${loanBefore.borrower}`);
  console.log(`Lender: ${loanBefore.lender}`);
  console.log(`Principal: ${hre.ethers.formatUnits(loanBefore.principal, 6)} mUSDC`);
  console.log(`Interest Rate: ${Number(loanBefore.interestRateBps) / 100}% (${loanBefore.interestRateBps} bps)`);
  console.log(`Duration: ${Number(loanBefore.duration) / 86400} days`);
  console.log(`Total Due: ${hre.ethers.formatUnits(loanBefore.totalDue, 6)} mUSDC`);
  console.log(`Status: ${loanBefore.status} (0 = REQUESTED)`);

  if (Number(loanBefore.status) !== 0) {
    throw new Error(`Expected Loan #${loanId} to be REQUESTED (0), but status is ${loanBefore.status}`);
  }
  if (loanBefore.borrower.toLowerCase() !== borrowerSigner.address.toLowerCase()) {
    throw new Error(`Expected borrower to be ${borrowerSigner.address}, got ${loanBefore.borrower}`);
  }

  // Record Borrower Initial Financial State
  const borrowerUSDCBefore = await mockUSDC.balanceOf(borrowerSigner.address);
  const borrowerScoreBefore = await creditRegistry.getCreditScore(borrowerSigner.address);
  const borrowerOutstandingBefore = await loanManager.getOutstandingPrincipal(borrowerSigner.address);
  console.log(`Borrower USDC Balance: ${hre.ethers.formatUnits(borrowerUSDCBefore, 6)} mUSDC`);
  console.log(`Borrower Credit Score: ${borrowerScoreBefore}`);
  console.log(`Borrower Outstanding Exposure: ${hre.ethers.formatUnits(borrowerOutstandingBefore, 6)} USDC`);

  // 2. NEGATIVE TEST 2: Borrower attempts to fund their own loan
  console.log("\n--- NEGATIVE TEST 2: Self-Funding Prevention Test ---");
  let selfFundBlocked = false;
  let selfFundError = "";
  try {
    await loanManager.connect(borrowerSigner).fundLoan.staticCall(loanId);
  } catch (err) {
    selfFundBlocked = true;
    selfFundError = err.reason || err.shortMessage || err.message;
    console.log(`✓ Self-funding strictly blocked onchain by LoanManager!`);
    console.log(`  Revert reason: "${selfFundError}"`);
  }
  if (!selfFundBlocked) {
    throw new Error("SECURITY VIOLATION: Borrower was able to fund their own loan!");
  }

  // 3. Setup Separate Lender Wallet
  console.log("\n--- Setup Separate Lender Wallet ---");
  const lenderWallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log(`Separate Lender Address: ${lenderWallet.address}`);

  const borrowerEthBalance = await hre.ethers.provider.getBalance(borrowerSigner.address);
  console.log(`Borrower ETH balance: ${hre.ethers.formatEther(borrowerEthBalance)} ETH`);

  console.log("Funding lender with 0.005 Sepolia ETH for transaction gas...");
  const ethFundingTx = await borrowerSigner.sendTransaction({
    to: lenderWallet.address,
    value: hre.ethers.parseEther("0.005")
  });
  await ethFundingTx.wait(1);
  console.log(`✓ Lender funded with 0.005 ETH! (Tx: ${ethFundingTx.hash})`);

  // 4. NEGATIVE TEST 4: Lender attempts funding with insufficient balance / allowance
  console.log("\n--- NEGATIVE TEST 4: Insufficient Balance / Allowance Test ---");
  let zeroBalanceBlocked = false;
  try {
    await loanManager.connect(lenderWallet).fundLoan.staticCall(loanId);
  } catch (err) {
    zeroBalanceBlocked = true;
    console.log(`✓ Unfunded lender strictly blocked onchain!`);
    console.log(`  Revert reason: "${err.reason || err.shortMessage || err.message}"`);
  }
  if (!zeroBalanceBlocked) {
    throw new Error("SECURITY VIOLATION: Unfunded lender was not blocked!");
  }

  // 5. Mint MockUSDC to Lender via Public Faucet
  console.log("\n--- Claiming Test mUSDC for Lender via Faucet ---");
  const faucetAmount = hre.ethers.parseUnits("1000", 6); // 1,000 mUSDC
  const faucetTx = await mockUSDC.connect(lenderWallet).faucet(lenderWallet.address, faucetAmount);
  await faucetTx.wait(1);
  console.log(`✓ Lender claimed 1,000 mUSDC from Faucet! (Tx: ${faucetTx.hash})`);

  const lenderUSDCBefore = await mockUSDC.balanceOf(lenderWallet.address);
  console.log(`Lender mUSDC Balance: ${hre.ethers.formatUnits(lenderUSDCBefore, 6)} mUSDC`);

  // 6. Test Insufficient Allowance with funded balance
  console.log("Testing zero allowance revert with funded balance...");
  let zeroAllowanceBlocked = false;
  try {
    await loanManager.connect(lenderWallet).fundLoan.staticCall(loanId);
  } catch (err) {
    zeroAllowanceBlocked = true;
    console.log(`✓ Zero-allowance funding strictly blocked onchain!`);
    console.log(`  Revert reason: "${err.reason || err.shortMessage || err.message}"`);
  }
  if (!zeroAllowanceBlocked) {
    throw new Error("SECURITY VIOLATION: Zero-allowance funding was not blocked!");
  }

  // 7. Approve LendingPool for Principal
  console.log("\n--- Step 1: Approving LendingPool to Transfer Principal ---");
  const approvalAmount = loanBefore.principal; // 50.00 mUSDC
  console.log(`Approving LendingPool (${lendingPoolAddress}) for ${hre.ethers.formatUnits(approvalAmount, 6)} mUSDC...`);
  const approveTx = await mockUSDC.connect(lenderWallet).approve(lendingPoolAddress, approvalAmount);
  const approveReceipt = await approveTx.wait(1);
  console.log(`✓ Approval confirmed in block #${approveReceipt.blockNumber}! (Tx: ${approveTx.hash})`);

  const allowance = await mockUSDC.allowance(lenderWallet.address, lendingPoolAddress);
  console.log(`Verified Onchain Allowance: ${hre.ethers.formatUnits(allowance, 6)} mUSDC`);

  // 8. TEST 1: POSITIVE TEST — Valid Lender Funds REQUESTED Loan
  console.log("\n--- Step 2 / TEST 1: Broadcasting fundLoan(1) to Sepolia ---");
  const fundTx = await loanManager.connect(lenderWallet).fundLoan(loanId);
  console.log(`Fund transaction submitted! Hash: ${fundTx.hash}`);
  console.log("Waiting for Sepolia block confirmation...");
  const fundReceipt = await fundTx.wait(1);
  console.log(`✓ Loan funded and confirmed in block #${fundReceipt.blockNumber}! Gas used: ${fundReceipt.gasUsed}`);

  // 9. Parse LoanFunded Event
  let fundedEvent = null;
  for (const log of fundReceipt.logs) {
    try {
      const parsed = loanManager.interface.parseLog(log);
      if (parsed && parsed.name === "LoanFunded") {
        fundedEvent = parsed;
        break;
      }
    } catch {
      // Ignore logs from other contracts (e.g. Transfer, FundsTransferred)
    }
  }

  if (!fundedEvent) {
    throw new Error("Failed to parse LoanFunded event from transaction receipt!");
  }

  console.log("\n--- LoanFunded Event Emitted ---");
  console.log(`Loan ID: #${fundedEvent.args.loanId}`);
  console.log(`Lender: ${fundedEvent.args.lender}`);
  console.log(`Borrower: ${fundedEvent.args.borrower}`);
  console.log(`Principal: ${hre.ethers.formatUnits(fundedEvent.args.principal, 6)} mUSDC`);
  console.log(`Due Date: ${new Date(Number(fundedEvent.args.dueDate) * 1000).toISOString()} (Unix: ${fundedEvent.args.dueDate})`);

  // 10. Comprehensive Verification of Onchain State After Funding
  console.log("\n--- Comprehensive State Verification After Funding ---");
  const loanAfter = await loanManager.getLoan(loanId);
  const borrowerUSDCAfter = await mockUSDC.balanceOf(borrowerSigner.address);
  const lenderUSDCAfter = await mockUSDC.balanceOf(lenderWallet.address);
  const borrowerScoreAfter = await creditRegistry.getCreditScore(borrowerSigner.address);
  const borrowerOutstandingAfter = await loanManager.getOutstandingPrincipal(borrowerSigner.address);

  console.log(`Updated Loan Details:`);
  console.log(`  Status: ${loanAfter.status} (1 = ACTIVE)`);
  console.log(`  Lender: ${loanAfter.lender}`);
  console.log(`  Borrower: ${loanAfter.borrower}`);
  console.log(`  Principal: ${hre.ethers.formatUnits(loanAfter.principal, 6)} mUSDC`);
  console.log(`  Total Due: ${hre.ethers.formatUnits(loanAfter.totalDue, 6)} mUSDC`);
  console.log(`  Due Date: ${new Date(Number(loanAfter.dueDate) * 1000).toISOString()}`);

  console.log(`Financial Balances:`);
  console.log(`  Lender USDC Before: ${hre.ethers.formatUnits(lenderUSDCBefore, 6)} -> After: ${hre.ethers.formatUnits(lenderUSDCAfter, 6)} mUSDC`);
  console.log(`  Borrower USDC Before: ${hre.ethers.formatUnits(borrowerUSDCBefore, 6)} -> After: ${hre.ethers.formatUnits(borrowerUSDCAfter, 6)} mUSDC`);
  console.log(`  Borrower Credit Score: Before: ${borrowerScoreBefore} -> After: ${borrowerScoreAfter}`);
  console.log(`  Borrower Outstanding Exposure: Before: ${hre.ethers.formatUnits(borrowerOutstandingBefore, 6)} -> After: ${hre.ethers.formatUnits(borrowerOutstandingAfter, 6)} USDC`);

  // Assertions
  if (Number(loanAfter.status) !== 1) {
    throw new Error(`Status mismatch! Expected 1 (ACTIVE), got ${loanAfter.status}`);
  }
  if (loanAfter.lender.toLowerCase() !== lenderWallet.address.toLowerCase()) {
    throw new Error(`Lender mismatch! Expected ${lenderWallet.address}, got ${loanAfter.lender}`);
  }
  if (loanAfter.borrower.toLowerCase() !== borrowerSigner.address.toLowerCase()) {
    throw new Error(`Borrower mismatch! Expected ${borrowerSigner.address}, got ${loanAfter.borrower}`);
  }
  if (lenderUSDCAfter !== lenderUSDCBefore - loanBefore.principal) {
    throw new Error("Lender token balance did not decrease by exact principal!");
  }
  console.log(`✓ Confirmed lender sent exactly 50.00 mUSDC (${hre.ethers.formatUnits(lenderUSDCBefore, 6)} -> ${hre.ethers.formatUnits(lenderUSDCAfter, 6)})`);

  if (borrowerUSDCAfter !== borrowerUSDCBefore + loanBefore.principal) {
    throw new Error("Borrower token balance did not increase by exact principal!");
  }
  console.log(`✓ Confirmed borrower received exactly 50.00 mUSDC (${hre.ethers.formatUnits(borrowerUSDCBefore, 6)} -> ${hre.ethers.formatUnits(borrowerUSDCAfter, 6)})`);

  if (borrowerScoreAfter !== borrowerScoreBefore) {
    throw new Error("CRITICAL INVARIANT VIOLATION: Credit score mutated upon funding!");
  }
  console.log(`✓ Confirmed borrower credit score unchanged at ${borrowerScoreAfter}`);

  if (borrowerOutstandingAfter !== borrowerOutstandingBefore) {
    throw new Error("CRITICAL INVARIANT VIOLATION: Outstanding exposure changed upon funding (double-counted)!");
  }
  console.log(`✓ Confirmed outstanding exposure remains accurately accounted without double-counting (${hre.ethers.formatUnits(borrowerOutstandingAfter, 6)} USDC)`);

  // 11. NEGATIVE TEST 3: Second lender attempts to fund already ACTIVE loan
  console.log("\n--- NEGATIVE TEST 3: Duplicate Funding Prevention Test ---");
  const secondLender = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  let duplicateFundBlocked = false;
  let duplicateFundError = "";
  try {
    await loanManager.connect(secondLender).fundLoan.staticCall(loanId);
  } catch (err) {
    duplicateFundBlocked = true;
    duplicateFundError = err.reason || err.shortMessage || err.message;
    console.log(`✓ Second lender strictly blocked onchain from funding ACTIVE loan!`);
    console.log(`  Revert reason: "${duplicateFundError}"`);
  }
  if (!duplicateFundBlocked) {
    throw new Error("SECURITY VIOLATION: Second lender was able to fund already ACTIVE loan!");
  }

  console.log("\n==================================================");
  console.log("PHASE 10 SMOKE TEST RESULT: ALL TESTS PASSED!");
  console.log(`Approval Tx: ${approveTx.hash}`);
  console.log(`Funding Tx:  ${fundTx.hash}`);
  console.log(`Etherscan Link: https://sepolia.etherscan.io/tx/${fundTx.hash}`);
  console.log(`Loan ID: #${loanId}`);
  console.log(`Lender: ${lenderWallet.address}`);
  console.log(`Borrower: ${borrowerSigner.address}`);
  console.log(`Status: ACTIVE`);
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Phase 10 smoke test failed:", err);
    process.exit(1);
  });
