const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("==================================================");
  console.log("CrediFi - Hackathon Demo State Seeder");
  console.log("Classification: 'Hackathon Demo Seed' (Testnet Activity)");
  console.log("==================================================\n");

  const [deployer, borrower, lender] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Borrower Demo Wallet: ${borrower ? borrower.address : deployer.address}`);
  console.log(`Lender Demo Wallet: ${lender ? lender.address : deployer.address}\n`);

  const deploymentsFile = path.join(__dirname, `../deployments/${network.name}.json`);
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployment file not found at ${deploymentsFile}. Run deploy first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentsFile, "utf8"));
  const { MockUSDC, CreditRegistry, LendingPool, LoanManager } = deployment.contracts;

  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC);
  const creditRegistry = await ethers.getContractAt("CreditRegistry", CreditRegistry);
  const lendingPool = await ethers.getContractAt("LendingPool", LendingPool);
  const loanManager = await ethers.getContractAt("LoanManager", LoanManager);

  const DECIMALS = 6n;
  const ONE_USDC = 10n ** DECIMALS;

  // 1. Fund Demo Wallets with Test Tokens
  console.log("[1/4] Minting test MockUSDC for demo participants...");
  const demoBorrower = borrower || deployer;
  const demoLender = lender || deployer;

  await (await mockUSDC.connect(demoBorrower).faucet(demoBorrower.address, 5_000n * ONE_USDC)).wait();
  await (await mockUSDC.connect(demoLender).faucet(demoLender.address, 10_000n * ONE_USDC)).wait();
  console.log(`✓ Funded borrower with 5,000 mUSDC`);
  console.log(`✓ Funded lender with 10,000 mUSDC`);

  // Approve LendingPool
  console.log("\n[2/4] Approving LendingPool allowances...");
  await (await mockUSDC.connect(demoBorrower).approve(LendingPool, ethers.MaxUint256)).wait();
  await (await mockUSDC.connect(demoLender).approve(LendingPool, ethers.MaxUint256)).wait();
  console.log("✓ Allowances granted to LendingPool");

  // 2. Create and Repay a Historical Loan (Establish Onchain Credit History)
  console.log("\n[3/4] Creating onchain repayment history for borrower...");
  const historicalLoanAmount = 250n * ONE_USDC;
  const historicalDuration = 7 * 24 * 3600;
  const interestRate = 1000; // 10%

  const tx1 = await loanManager.connect(demoBorrower).createLoan(historicalLoanAmount, historicalDuration, interestRate);
  await tx1.wait();
  console.log("✓ Historical loan requested onchain");

  const loanId1 = await loanManager.loanCounter();
  const tx2 = await loanManager.connect(demoLender).fundLoan(loanId1);
  await tx2.wait();
  console.log(`✓ Historical loan #${loanId1} funded onchain by lender`);

  const tx3 = await loanManager.connect(demoBorrower).repayLoan(loanId1);
  await tx3.wait();
  console.log(`✓ Historical loan #${loanId1} repaid onchain!`);

  const borrowerScore = await creditRegistry.getCreditScore(demoBorrower.address);
  const borrowingLimit = await creditRegistry.getBorrowingLimit(demoBorrower.address);
  console.log(`✓ Borrower's Onchain Credit Score updated to: ${borrowerScore} (+70 points early repayment)`);
  console.log(`✓ Borrower's Borrowing Power expanded to: ${ethers.formatUnits(borrowingLimit, 6)} USDC`);

  // 3. Create an Open Marketplace Loan Ready for Live Funding
  console.log("\n[4/4] Creating an open loan request for live presentation demo...");
  const openLoanAmount = 300n * ONE_USDC;
  const openDuration = 14 * 24 * 3600; // 14 days
  const openInterest = 1200; // 12% APR

  const tx4 = await loanManager.connect(demoBorrower).createLoan(openLoanAmount, openDuration, openInterest);
  await tx4.wait();
  const loanId2 = await loanManager.loanCounter();
  console.log(`✓ Open marketplace loan #${loanId2} created (Amount: 300 USDC, APR: 12%, Duration: 14 days)`);
  console.log(`  State: REQUESTED (Ready to be funded live by judges/demo)`);

  console.log("\n==================================================");
  console.log("✓ HACKATHON DEMO SEEDING COMPLETE!");
  console.log("All demo activity has been executed through real onchain transactions.");
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo seeding failed:", error);
    process.exit(1);
  });
