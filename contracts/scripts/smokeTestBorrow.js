const hre = require("hardhat");
const deployments = require("../deployments/sepolia.json");

async function main() {
  console.log("==================================================");
  console.log("CREDIFI PHASE 9 — SEPOLIA BORROW SMOKE TEST");
  console.log("==================================================");

  const [signer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Borrower Wallet: ${signer.address}`);

  const mockUSDCAddress = deployments.contracts.MockUSDC.address;
  const creditRegistryAddress = deployments.contracts.CreditRegistry.address;
  const loanManagerAddress = deployments.contracts.LoanManager.address;

  const mockUSDC = await hre.ethers.getContractAt("MockUSDC", mockUSDCAddress, signer);
  const creditRegistry = await hre.ethers.getContractAt("CreditRegistry", creditRegistryAddress, signer);
  const loanManager = await hre.ethers.getContractAt("LoanManager", loanManagerAddress, signer);

  // 1. Initial State
  const initialBalance = await mockUSDC.balanceOf(signer.address);
  const initialScore = await creditRegistry.getCreditScore(signer.address);
  const initialLimit = await creditRegistry.getBorrowingLimit(signer.address);
  const initialOutstanding = await loanManager.getOutstandingPrincipal(signer.address);
  const initialAvailablePower = await loanManager.getAvailableBorrowingPower(signer.address);

  console.log("\n--- Initial Onchain State ---");
  console.log(`MockUSDC Balance: ${hre.ethers.formatUnits(initialBalance, 6)} mUSDC`);
  console.log(`Credit Score: ${initialScore}`);
  console.log(`Borrowing Limit: ${hre.ethers.formatUnits(initialLimit, 6)} USDC`);
  console.log(`Outstanding Exposure: ${hre.ethers.formatUnits(initialOutstanding, 6)} USDC`);
  console.log(`Available Borrowing Power: ${hre.ethers.formatUnits(initialAvailablePower, 6)} USDC`);

  // 2. TEST 2: Over-limit loan attempt
  console.log("\n--- TEST 2: Over-Limit Borrowing Enforcement Test ---");
  const overLimitAmount = initialAvailablePower + hre.ethers.parseUnits("1000", 6);
  console.log(`Attempting createLoan for: ${hre.ethers.formatUnits(overLimitAmount, 6)} USDC (Available: ${hre.ethers.formatUnits(initialAvailablePower, 6)} USDC)`);

  let overLimitRejected = false;
  let revertReason = "";
  try {
    await loanManager.createLoan.staticCall(overLimitAmount, 1000, 14 * 86400);
  } catch (err) {
    overLimitRejected = true;
    revertReason = err.reason || err.shortMessage || err.message;
    console.log(`✓ Over-limit loan strictly rejected onchain by LoanManager!`);
    console.log(`  Revert reason: "${revertReason}"`);
  }

  if (!overLimitRejected) {
    throw new Error("CRITICAL SECURITY INVARIANT FAILED: Over-limit loan was NOT rejected!");
  }

  // 3. TEST 1: Valid Small Loan Request
  console.log("\n--- TEST 1: Valid Loan Request Creation on Sepolia ---");
  const loanPrincipal = hre.ethers.parseUnits("50", 6); // 50.00 mUSDC
  const loanRateBps = 500; // 5.00% APR
  const loanDurationDays = 7;
  const loanDurationSeconds = loanDurationDays * 86400; // 604,800 seconds

  console.log(`Creating loan request:`);
  console.log(`  Principal: 50.00 mUSDC`);
  console.log(`  Interest Rate: 5.00% (${loanRateBps} bps)`);
  console.log(`  Duration: ${loanDurationDays} days (${loanDurationSeconds} seconds)`);

  console.log("Broadcasting createLoan transaction to Sepolia...");
  const tx = await loanManager.createLoan(loanPrincipal, loanRateBps, loanDurationSeconds);
  console.log(`Transaction submitted! Hash: ${tx.hash}`);
  console.log(`Waiting for Sepolia block confirmation...`);

  const receipt = await tx.wait(1);
  console.log(`✓ Transaction confirmed in block #${receipt.blockNumber}! Gas used: ${receipt.gasUsed}`);

  // 4. Parse LoanCreated event from receipt
  let createdLoanId = null;
  let createdTotalDue = null;
  for (const log of receipt.logs) {
    try {
      const parsed = loanManager.interface.parseLog(log);
      if (parsed && parsed.name === "LoanCreated") {
        createdLoanId = parsed.args.loanId;
        createdTotalDue = parsed.args.totalDue;
        break;
      }
    } catch {
      // Non-matching log
    }
  }

  if (!createdLoanId) {
    throw new Error("Failed to parse LoanCreated event from transaction receipt!");
  }

  console.log(`✓ Parsed LoanCreated event! Assigned Loan ID: #${createdLoanId}`);
  console.log(`  Total Due: ${hre.ethers.formatUnits(createdTotalDue, 6)} USDC`);

  // 5. TEST 3: Verify Onchain State After Creation
  console.log("\n--- TEST 3: Verification of Onchain State ---");
  const onchainLoan = await loanManager.getLoan(createdLoanId);
  const postBalance = await mockUSDC.balanceOf(signer.address);
  const postScore = await creditRegistry.getCreditScore(signer.address);
  const postOutstanding = await loanManager.getOutstandingPrincipal(signer.address);
  const postAvailablePower = await loanManager.getAvailableBorrowingPower(signer.address);

  console.log(`Stored Loan Details:`);
  console.log(`  Loan ID: ${onchainLoan.loanId}`);
  console.log(`  Borrower: ${onchainLoan.borrower}`);
  console.log(`  Lender: ${onchainLoan.lender} (address(0) for un-funded)`);
  console.log(`  Principal: ${hre.ethers.formatUnits(onchainLoan.principal, 6)} mUSDC`);
  console.log(`  Interest Rate: ${Number(onchainLoan.interestRateBps) / 100}% (${onchainLoan.interestRateBps} bps)`);
  console.log(`  Duration: ${Number(onchainLoan.duration) / 86400} days`);
  console.log(`  Total Due: ${hre.ethers.formatUnits(onchainLoan.totalDue, 6)} mUSDC`);
  console.log(`  Status: ${onchainLoan.status} (0 = REQUESTED)`);

  // Assertions
  if (onchainLoan.borrower.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Borrower mismatch! Expected ${signer.address}, got ${onchainLoan.borrower}`);
  }
  if (Number(onchainLoan.status) !== 0) {
    throw new Error(`Status mismatch! Expected 0 (REQUESTED), got ${onchainLoan.status}`);
  }
  if (onchainLoan.principal !== loanPrincipal) {
    throw new Error("Principal mismatch!");
  }
  if (postBalance !== initialBalance) {
    throw new Error("CRITICAL INVARIANT VIOLATION: Token balance changed during loan request creation!");
  }
  console.log(`✓ Confirmed zero token movement: balance unchanged at ${hre.ethers.formatUnits(postBalance, 6)} mUSDC`);

  if (postScore !== initialScore) {
    throw new Error("Credit score should not change upon loan creation!");
  }
  console.log(`✓ Confirmed credit score unchanged at ${postScore}`);

  if (postOutstanding !== initialOutstanding + loanPrincipal) {
    throw new Error("Outstanding principal did not increase by loan principal!");
  }
  console.log(`✓ Confirmed outstanding principal increased to: ${hre.ethers.formatUnits(postOutstanding, 6)} USDC`);

  if (postAvailablePower !== initialAvailablePower - loanPrincipal) {
    throw new Error("Available borrowing power did not decrease by loan principal!");
  }
  console.log(`✓ Confirmed available borrowing power decreased to: ${hre.ethers.formatUnits(postAvailablePower, 6)} USDC`);

  console.log("\n==================================================");
  console.log("PHASE 9 SMOKE TEST RESULT: ALL TESTS PASSED!");
  console.log(`Transaction Hash: ${tx.hash}`);
  console.log(`Etherscan Link: https://sepolia.etherscan.io/tx/${tx.hash}`);
  console.log(`Loan ID: ${createdLoanId}`);
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Smoke test failed:", err);
    process.exit(1);
  });
