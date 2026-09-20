const hre = require("hardhat");
const deployments = require("../deployments/sepolia.json");

async function main() {
  console.log("==================================================");
  console.log("CREDIFI PHASE 11 — SEPOLIA BORROWER REPAYMENT SMOKE TEST");
  console.log("==================================================");

  const [borrowerSigner] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Borrower Wallet: ${borrowerSigner.address}`);

  const mockUSDCAddress = deployments.contracts.MockUSDC.address;
  const creditRegistryAddress = deployments.contracts.CreditRegistry.address;
  const lendingPoolAddress = deployments.contracts.LendingPool.address;
  const loanManagerAddress = deployments.contracts.LoanManager.address;

  const mockUSDC = await hre.ethers.getContractAt("MockUSDC", mockUSDCAddress, borrowerSigner);
  const creditRegistry = await hre.ethers.getContractAt("CreditRegistry", creditRegistryAddress, borrowerSigner);
  const lendingPool = await hre.ethers.getContractAt("LendingPool", lendingPoolAddress, borrowerSigner);
  const loanManager = await hre.ethers.getContractAt("LoanManager", loanManagerAddress, borrowerSigner);

  // 1. Target Loan #1 Pre-Repayment State Verification
  const loanId = 1;
  const loanBefore = await loanManager.getLoan(loanId);

  console.log("\n--- Target Loan #1 State Before Repayment ---");
  console.log(`Loan ID: #${loanBefore.loanId}`);
  console.log(`Borrower: ${loanBefore.borrower}`);
  console.log(`Lender: ${loanBefore.lender}`);
  console.log(`Principal: ${hre.ethers.formatUnits(loanBefore.principal, 6)} mUSDC`);
  console.log(`Interest Rate: ${Number(loanBefore.interestRateBps) / 100}% (${loanBefore.interestRateBps} bps)`);
  console.log(`Total Due: ${hre.ethers.formatUnits(loanBefore.totalDue, 6)} mUSDC`);
  console.log(`Due Date: ${new Date(Number(loanBefore.dueDate) * 1000).toISOString()}`);
  console.log(`Status: ${loanBefore.status} (1 = ACTIVE)`);

  if (Number(loanBefore.status) !== 1) {
    throw new Error(`Expected Loan #${loanId} to be ACTIVE (1), but status is ${loanBefore.status}`);
  }
  if (loanBefore.borrower.toLowerCase() !== borrowerSigner.address.toLowerCase()) {
    throw new Error(`Expected borrower ${borrowerSigner.address}, got ${loanBefore.borrower}`);
  }

  // Record Financial & Credit Metrics Before Repayment
  const borrowerUSDCBefore = await mockUSDC.balanceOf(borrowerSigner.address);
  const lenderUSDCBefore = await mockUSDC.balanceOf(loanBefore.lender);
  const borrowerScoreBefore = await creditRegistry.getCreditScore(borrowerSigner.address);
  const borrowerLimitBefore = await creditRegistry.getBorrowingLimit(borrowerSigner.address);
  const borrowerOutstandingBefore = await loanManager.getOutstandingPrincipal(borrowerSigner.address);
  const borrowerAvailableBefore = await loanManager.getAvailableBorrowingPower(borrowerSigner.address);

  console.log("\n--- Initial Financial & Credit Profile ---");
  console.log(`Borrower mUSDC Balance: ${hre.ethers.formatUnits(borrowerUSDCBefore, 6)} mUSDC`);
  console.log(`Lender mUSDC Balance:   ${hre.ethers.formatUnits(lenderUSDCBefore, 6)} mUSDC`);
  console.log(`Borrower Credit Score:  ${borrowerScoreBefore}`);
  console.log(`Borrower Borrow Limit:  ${hre.ethers.formatUnits(borrowerLimitBefore, 6)} USDC`);
  console.log(`Outstanding Exposure:   ${hre.ethers.formatUnits(borrowerOutstandingBefore, 6)} USDC`);
  console.log(`Available Borrow Power: ${hre.ethers.formatUnits(borrowerAvailableBefore, 6)} USDC`);

  // Ensure borrower has enough mUSDC to pay totalDue
  if (borrowerUSDCBefore < loanBefore.totalDue) {
    console.log("Borrower balance below totalDue, claiming from faucet...");
    const faucetTx = await mockUSDC.faucet(borrowerSigner.address, hre.ethers.parseUnits("1000", 6));
    await faucetTx.wait(1);
    console.log("✓ Faucet funded borrower!");
  }

  // 2. NEGATIVE TEST 2: Lender (or third-party) attempts to repay the loan
  console.log("\n--- NEGATIVE TEST 2: Unauthorized Account Repayment Prevention Test ---");
  const randomThirdParty = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  let unauthorizedRepayBlocked = false;
  let unauthorizedRevertReason = "";
  try {
    await loanManager.connect(randomThirdParty).repayLoan.staticCall(loanId);
  } catch (err) {
    unauthorizedRepayBlocked = true;
    unauthorizedRevertReason = err.reason || err.shortMessage || err.message;
    console.log(`✓ Unauthorized repayment strictly blocked onchain by LoanManager!`);
    console.log(`  Revert reason: "${unauthorizedRevertReason}"`);
  }
  if (!unauthorizedRepayBlocked) {
    throw new Error("SECURITY VIOLATION: Non-borrower was able to call repayLoan!");
  }

  // 3. NEGATIVE TEST 4: Repayment with zero allowance
  console.log("\n--- NEGATIVE TEST 4: Zero Allowance Repayment Prevention Test ---");
  // Temporarily reset allowance to 0
  const resetAllowanceTx = await mockUSDC.approve(lendingPoolAddress, 0);
  await resetAllowanceTx.wait(1);
  console.log("Borrower allowance reset to 0 for invariant testing.");

  let zeroAllowanceBlocked = false;
  try {
    await loanManager.connect(borrowerSigner).repayLoan.staticCall(loanId);
  } catch (err) {
    zeroAllowanceBlocked = true;
    console.log(`✓ Zero-allowance repayment strictly blocked onchain!`);
    console.log(`  Revert reason: "${err.reason || err.shortMessage || err.message}"`);
  }
  if (!zeroAllowanceBlocked) {
    throw new Error("SECURITY VIOLATION: Zero-allowance repayment was not blocked!");
  }

  // 4. Step 1: Approve LendingPool for exact totalDue
  console.log("\n--- Step 1: Approving LendingPool for Total Debt Settlement ---");
  const repaymentAmount = loanBefore.totalDue;
  console.log(`Approving LendingPool (${lendingPoolAddress}) for ${hre.ethers.formatUnits(repaymentAmount, 6)} mUSDC...`);
  const approveTx = await mockUSDC.approve(lendingPoolAddress, repaymentAmount);
  const approveReceipt = await approveTx.wait(1);
  console.log(`✓ Approval confirmed in block #${approveReceipt.blockNumber}! (Tx: ${approveTx.hash})`);

  const allowance = await mockUSDC.allowance(borrowerSigner.address, lendingPoolAddress);
  console.log(`Verified Onchain Allowance: ${hre.ethers.formatUnits(allowance, 6)} mUSDC`);

  // Record exact balances right before repay transaction
  const borrowerBalancePreRepay = await mockUSDC.balanceOf(borrowerSigner.address);
  const lenderBalancePreRepay = await mockUSDC.balanceOf(loanBefore.lender);

  // 5. POSITIVE TEST 1: Broadcasting repayLoan(1) to Sepolia
  console.log("\n--- Step 2 / TEST 1: Broadcasting repayLoan(1) to Sepolia ---");
  const repayTx = await loanManager.repayLoan(loanId);
  console.log(`Repay transaction submitted! Hash: ${repayTx.hash}`);
  console.log("Waiting for Sepolia block confirmation...");
  const repayReceipt = await repayTx.wait(1);
  console.log(`✓ Loan repaid and confirmed in block #${repayReceipt.blockNumber}! Gas used: ${repayReceipt.gasUsed}`);

  // 6. Parse LoanRepaid Event from receipt logs
  let repaidEvent = null;
  for (const log of repayReceipt.logs) {
    try {
      const parsed = loanManager.interface.parseLog(log);
      if (parsed && parsed.name === "LoanRepaid") {
        repaidEvent = parsed;
        break;
      }
    } catch {
      // Ignore other logs (Transfer, RepaymentExecuted, RepaymentRecorded, etc.)
    }
  }

  if (!repaidEvent) {
    throw new Error("Failed to parse LoanRepaid event from transaction receipt!");
  }

  console.log("\n--- LoanRepaid Event Emitted ---");
  console.log(`Loan ID: #${repaidEvent.args.loanId}`);
  console.log(`Borrower: ${repaidEvent.args.borrower}`);
  console.log(`Lender: ${repaidEvent.args.lender}`);
  console.log(`Principal: ${hre.ethers.formatUnits(repaidEvent.args.principal, 6)} mUSDC`);
  console.log(`Total Due: ${hre.ethers.formatUnits(repaidEvent.args.totalDue, 6)} mUSDC`);
  console.log(`Repayment Classification: ${repaidEvent.args.repaymentType} (0 = EARLY, 1 = ON_TIME, 2 = LATE)`);

  // 7. Comprehensive State Verification After Repayment
  console.log("\n--- Comprehensive State Verification After Repayment ---");
  const loanAfter = await loanManager.getLoan(loanId);
  const borrowerUSDCAfter = await mockUSDC.balanceOf(borrowerSigner.address);
  const lenderUSDCAfter = await mockUSDC.balanceOf(loanBefore.lender);
  const borrowerScoreAfter = await creditRegistry.getCreditScore(borrowerSigner.address);
  const borrowerLimitAfter = await creditRegistry.getBorrowingLimit(borrowerSigner.address);
  const borrowerOutstandingAfter = await loanManager.getOutstandingPrincipal(borrowerSigner.address);
  const borrowerAvailableAfter = await loanManager.getAvailableBorrowingPower(borrowerSigner.address);

  console.log(`Loan Final State:`);
  console.log(`  Status: ${loanAfter.status} (2 = REPAID)`);
  console.log(`  Borrower: ${loanAfter.borrower}`);
  console.log(`  Lender: ${loanAfter.lender}`);
  console.log(`  Principal: ${hre.ethers.formatUnits(loanAfter.principal, 6)} mUSDC`);
  console.log(`  Total Due: ${hre.ethers.formatUnits(loanAfter.totalDue, 6)} mUSDC`);

  console.log(`\nFinancial Balance Delta:`);
  console.log(`  Borrower USDC: ${hre.ethers.formatUnits(borrowerBalancePreRepay, 6)} -> ${hre.ethers.formatUnits(borrowerUSDCAfter, 6)} mUSDC`);
  console.log(`  Lender USDC:   ${hre.ethers.formatUnits(lenderBalancePreRepay, 6)} -> ${hre.ethers.formatUnits(lenderUSDCAfter, 6)} mUSDC`);

  console.log(`\nCredit Profile Updates:`);
  console.log(`  Credit Score:  ${borrowerScoreBefore} -> ${borrowerScoreAfter} (+${borrowerScoreAfter - borrowerScoreBefore} Points)`);
  console.log(`  Borrow Limit:  ${hre.ethers.formatUnits(borrowerLimitBefore, 6)} -> ${hre.ethers.formatUnits(borrowerLimitAfter, 6)} USDC`);
  console.log(`  Outstanding:   ${hre.ethers.formatUnits(borrowerOutstandingBefore, 6)} -> ${hre.ethers.formatUnits(borrowerOutstandingAfter, 6)} USDC`);
  console.log(`  Avail Power:   ${hre.ethers.formatUnits(borrowerAvailableBefore, 6)} -> ${hre.ethers.formatUnits(borrowerAvailableAfter, 6)} USDC`);

  // Assertions
  if (Number(loanAfter.status) !== 2) {
    throw new Error(`Status mismatch! Expected 2 (REPAID), got ${loanAfter.status}`);
  }
  if (borrowerUSDCAfter !== borrowerBalancePreRepay - loanBefore.totalDue) {
    throw new Error("Borrower token balance did not decrease by exact totalDue!");
  }
  console.log(`✓ Confirmed borrower paid exact totalDue (${hre.ethers.formatUnits(loanBefore.totalDue, 6)} mUSDC)`);

  if (lenderUSDCAfter !== lenderBalancePreRepay + loanBefore.totalDue) {
    throw new Error("Lender token balance did not increase by exact totalDue!");
  }
  console.log(`✓ Confirmed lender received exact totalDue (${hre.ethers.formatUnits(loanBefore.totalDue, 6)} mUSDC)`);

  if (borrowerOutstandingAfter !== 0n) {
    throw new Error("CRITICAL INVARIANT VIOLATION: Outstanding exposure not reduced to 0!");
  }
  console.log(`✓ Confirmed outstanding exposure fully released to 0 USDC`);

  if (borrowerScoreAfter !== 570n) {
    throw new Error(`Expected score 570 (+70 early bonus), got ${borrowerScoreAfter}`);
  }
  console.log(`✓ Confirmed credit score increased from 500 -> 570 (+70 early repayment bonus)`);

  if (borrowerLimitAfter !== hre.ethers.parseUnits("570", 6)) {
    throw new Error(`Expected borrowing limit 570 USDC, got ${hre.ethers.formatUnits(borrowerLimitAfter, 6)}`);
  }
  console.log(`✓ Confirmed borrowing limit scaled proportionally to 570 USDC`);

  if (borrowerAvailableAfter !== borrowerLimitAfter) {
    throw new Error("Available borrowing power does not equal new borrowing limit!");
  }
  console.log(`✓ Confirmed available borrowing power equals new borrowing limit (570 USDC)`);

  // 8. NEGATIVE TEST 3: Attempt to repay already REPAID loan
  console.log("\n--- NEGATIVE TEST 3: Duplicate Repayment Prevention Test ---");
  let duplicateRepayBlocked = false;
  let duplicateRepayError = "";
  try {
    await loanManager.repayLoan.staticCall(loanId);
  } catch (err) {
    duplicateRepayBlocked = true;
    duplicateRepayError = err.reason || err.shortMessage || err.message;
    console.log(`✓ Duplicate repayment strictly blocked onchain!`);
    console.log(`  Revert reason: "${duplicateRepayError}"`);
  }
  if (!duplicateRepayBlocked) {
    throw new Error("SECURITY VIOLATION: Duplicate repayment was not blocked!");
  }

  console.log("\n==================================================");
  console.log("PHASE 11 SMOKE TEST RESULT: ALL TESTS PASSED!");
  console.log(`Approval Tx: ${approveTx.hash}`);
  console.log(`Repay Tx:    ${repayTx.hash}`);
  console.log(`Etherscan:   https://sepolia.etherscan.io/tx/${repayTx.hash}`);
  console.log(`Loan ID:     #${loanId}`);
  console.log(`Borrower:    ${borrowerSigner.address}`);
  console.log(`Lender:      ${loanBefore.lender}`);
  console.log(`Status:      REPAID (2)`);
  console.log(`New Score:   ${borrowerScoreAfter}`);
  console.log(`New Limit:   ${hre.ethers.formatUnits(borrowerLimitAfter, 6)} USDC`);
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Phase 11 smoke test failed:", err);
    process.exit(1);
  });
