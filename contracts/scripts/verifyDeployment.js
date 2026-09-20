const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("==================================================");
  console.log("CrediFi - Deployment Verification");
  console.log("==================================================");
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Verifier: ${deployer.address}\n`);

  // Load deployment addresses from deployments file
  const deploymentsFile = path.join(__dirname, `../deployments/${network.name}.json`);
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployment file not found at ${deploymentsFile}. Run deploy first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentsFile, "utf8"));
  const { MockUSDC, CreditRegistry, LendingPool, LoanManager } = deployment.contracts;

  console.log("Verifying deployed addresses:");
  console.log(`- MockUSDC:       ${MockUSDC}`);
  console.log(`- CreditRegistry: ${CreditRegistry}`);
  console.log(`- LendingPool:    ${LendingPool}`);
  console.log(`- LoanManager:    ${LoanManager}\n`);

  // 1. Verify Bytecode exists
  console.log("[Check 1] Verifying contract bytecode onchain...");
  const contracts = [
    { name: "MockUSDC", address: MockUSDC },
    { name: "CreditRegistry", address: CreditRegistry },
    { name: "LendingPool", address: LendingPool },
    { name: "LoanManager", address: LoanManager },
  ];

  for (const c of contracts) {
    const code = await ethers.provider.getCode(c.address);
    if (!code || code === "0x") {
      throw new Error(`FAILED: No bytecode found at address ${c.address} for ${c.name}`);
    }
    console.log(`✓ ${c.name} bytecode verified (${code.length} bytes)`);
  }

  // 2. Verify Protocol Interlinkage
  console.log("\n[Check 2] Verifying protocol contract authorization links...");
  const creditRegistry = await ethers.getContractAt("CreditRegistry", CreditRegistry);
  const lendingPool = await ethers.getContractAt("LendingPool", LendingPool);
  const loanManager = await ethers.getContractAt("LoanManager", LoanManager);
  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC);

  const registeredLoanManagerInCredit = await creditRegistry.loanManager();
  if (registeredLoanManagerInCredit.toLowerCase() !== LoanManager.toLowerCase()) {
    throw new Error(`Mismatch: CreditRegistry.loanManager is ${registeredLoanManagerInCredit}, expected ${LoanManager}`);
  }
  console.log(`✓ CreditRegistry.loanManager correctly points to LoanManager`);

  const registeredLoanManagerInPool = await lendingPool.loanManager();
  if (registeredLoanManagerInPool.toLowerCase() !== LoanManager.toLowerCase()) {
    throw new Error(`Mismatch: LendingPool.loanManager is ${registeredLoanManagerInPool}, expected ${LoanManager}`);
  }
  console.log(`✓ LendingPool.loanManager correctly points to LoanManager`);

  const poolToken = await lendingPool.token();
  if (poolToken.toLowerCase() !== MockUSDC.toLowerCase()) {
    throw new Error(`Mismatch: LendingPool.token is ${poolToken}, expected ${MockUSDC}`);
  }
  console.log(`✓ LendingPool.token correctly points to MockUSDC`);

  // 3. Test Read Operations
  console.log("\n[Check 3] Testing important public read functions...");
  const tokenName = await mockUSDC.name();
  const tokenDecimals = await mockUSDC.decimals();
  console.log(`✓ MockUSDC metadata: ${tokenName} (${tokenDecimals} decimals)`);

  const initialScore = await creditRegistry.getCreditScore(deployer.address);
  const initialLimit = await creditRegistry.getBorrowingLimit(deployer.address);
  console.log(`✓ CreditRegistry read test: Score=${initialScore}, Limit=${ethers.formatUnits(initialLimit, 6)} USDC`);

  const loanCount = await loanManager.loanCounter();
  console.log(`✓ LoanManager read test: Total Loans Created=${loanCount}`);

  console.log("\n==================================================");
  console.log("✓ ALL DEPLOYMENT VERIFICATION CHECKS PASSED!");
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  });
