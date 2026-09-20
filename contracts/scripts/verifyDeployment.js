const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("==================================================");
  console.log("CrediFi — Live Deployment & Onchain State Validation");
  console.log("==================================================");
  console.log(`Network:   ${network.name}`);
  console.log(`Chain ID:  ${chainId}`);
  console.log(`Caller:    ${signer.address}\n`);

  // Load deployment manifest
  const deploymentsFile = path.join(__dirname, `../deployments/${network.name}.json`);
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployment file not found at ${deploymentsFile}. Run deploy first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentsFile, "utf8"));
  
  // Extract addresses supporting either object { address, txHash } or string
  const getAddr = (entry) => (typeof entry === "object" && entry !== null ? entry.address : entry);
  const mockUSDCAddress = ethers.getAddress(getAddr(deployment.contracts.MockUSDC));
  const creditRegistryAddress = ethers.getAddress(getAddr(deployment.contracts.CreditRegistry));
  const lendingPoolAddress = ethers.getAddress(getAddr(deployment.contracts.LendingPool));
  const loanManagerAddress = ethers.getAddress(getAddr(deployment.contracts.LoanManager));

  console.log("Deployed Contract Addresses:");
  console.log(`- MockUSDC:       ${mockUSDCAddress}`);
  console.log(`- CreditRegistry: ${creditRegistryAddress}`);
  console.log(`- LendingPool:    ${lendingPoolAddress}`);
  console.log(`- LoanManager:    ${loanManagerAddress}\n`);

  // 1. Verify Chain ID
  console.log("[Validation 1/5] Verifying Chain ID...");
  if (network.name === "sepolia" && chainId !== 11155111) {
    throw new Error(`Chain ID mismatch! Expected 11155111 for Sepolia, got ${chainId}`);
  }
  console.log(`✓ Chain ID verified: ${chainId}`);

  // 2. Verify Bytecode exists onchain
  console.log("\n[Validation 2/5] Verifying onchain bytecode...");
  const contractList = [
    { name: "MockUSDC", address: mockUSDCAddress },
    { name: "CreditRegistry", address: creditRegistryAddress },
    { name: "LendingPool", address: lendingPoolAddress },
    { name: "LoanManager", address: loanManagerAddress },
  ];

  for (const c of contractList) {
    const code = await ethers.provider.getCode(c.address);
    if (!code || code === "0x") {
      throw new Error(`CRITICAL: No bytecode found at ${c.address} for ${c.name}`);
    }
    console.log(`✓ ${c.name.padEnd(16)}: ${code.length / 2 - 1} bytes of bytecode present`);
  }

  // 3. Verify Contract Instances & Interlinkage
  console.log("\n[Validation 3/5] Verifying protocol interlinkage & access control...");
  const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddress);
  const creditRegistry = await ethers.getContractAt("CreditRegistry", creditRegistryAddress);
  const lendingPool = await ethers.getContractAt("LendingPool", lendingPoolAddress);
  const loanManager = await ethers.getContractAt("LoanManager", loanManagerAddress);

  const regLoanManager = await creditRegistry.loanManager();
  if (regLoanManager.toLowerCase() !== loanManagerAddress.toLowerCase()) {
    throw new Error(`CreditRegistry.loanManager mismatch: got ${regLoanManager}, expected ${loanManagerAddress}`);
  }
  console.log(`✓ CreditRegistry.loanManager()  == ${regLoanManager}`);

  const poolLoanManager = await lendingPool.loanManager();
  if (poolLoanManager.toLowerCase() !== loanManagerAddress.toLowerCase()) {
    throw new Error(`LendingPool.loanManager mismatch: got ${poolLoanManager}, expected ${loanManagerAddress}`);
  }
  console.log(`✓ LendingPool.loanManager()     == ${poolLoanManager}`);

  const poolToken = await lendingPool.token();
  if (poolToken.toLowerCase() !== mockUSDCAddress.toLowerCase()) {
    throw new Error(`LendingPool.token mismatch: got ${poolToken}, expected ${mockUSDCAddress}`);
  }
  console.log(`✓ LendingPool.token()           == ${poolToken}`);

  const lmCreditRegistry = await loanManager.creditRegistry();
  if (lmCreditRegistry.toLowerCase() !== creditRegistryAddress.toLowerCase()) {
    throw new Error(`LoanManager.creditRegistry mismatch: got ${lmCreditRegistry}, expected ${creditRegistryAddress}`);
  }
  console.log(`✓ LoanManager.creditRegistry()  == ${lmCreditRegistry}`);

  const lmLendingPool = await loanManager.lendingPool();
  if (lmLendingPool.toLowerCase() !== lendingPoolAddress.toLowerCase()) {
    throw new Error(`LoanManager.lendingPool mismatch: got ${lmLendingPool}, expected ${lendingPoolAddress}`);
  }
  console.log(`✓ LoanManager.lendingPool()     == ${lmLendingPool}`);

  // 4. Verify Protocol Constants & Read Operations
  console.log("\n[Validation 4/5] Verifying contract metadata and protocol constants...");
  const tokenName = await mockUSDC.name();
  const tokenSymbol = await mockUSDC.symbol();
  const tokenDecimals = await mockUSDC.decimals();
  const tokenSupply = await mockUSDC.totalSupply();

  if (tokenName !== "Mock USD Coin") throw new Error(`Unexpected token name: ${tokenName}`);
  if (tokenSymbol !== "mUSDC") throw new Error(`Unexpected token symbol: ${tokenSymbol}`);
  if (Number(tokenDecimals) !== 6) throw new Error(`Unexpected token decimals: ${tokenDecimals}`);

  console.log(`✓ MockUSDC Metadata: ${tokenName} (${tokenSymbol}), Decimals: ${tokenDecimals}, Total Supply: ${tokenSupply}`);

  const baseScore = await creditRegistry.BASE_SCORE();
  const minScore = await creditRegistry.MIN_SCORE();
  const maxScore = await creditRegistry.MAX_SCORE();
  if (Number(baseScore) !== 500) throw new Error(`CreditRegistry.BASE_SCORE unexpected: ${baseScore}`);
  if (Number(minScore) !== 300) throw new Error(`CreditRegistry.MIN_SCORE unexpected: ${minScore}`);
  if (Number(maxScore) !== 850) throw new Error(`CreditRegistry.MAX_SCORE unexpected: ${maxScore}`);

  const sampleScore = await creditRegistry.getCreditScore(signer.address);
  const sampleLimit = await creditRegistry.getBorrowingLimit(signer.address);
  console.log(`✓ CreditRegistry Constants: Base=${baseScore}, Min=${minScore}, Max=${maxScore}`);
  console.log(`✓ Caller Credit Profile: Score=${sampleScore}, Limit=${ethers.formatUnits(sampleLimit, 6)} mUSDC`);

  const loanCounter = await loanManager.loanCounter();
  console.log(`✓ LoanManager loanCounter: ${loanCounter}`);

  // 5. Optional Smoke Test: Faucet claim
  const runSmokeTest = process.argv.includes("--smoke-test") || process.env.SMOKE_TEST === "true";
  if (runSmokeTest) {
    console.log("\n[Validation 5/5] Performing optional MockUSDC faucet smoke test...");
    const testAmount = ethers.parseUnits("100", 6); // 100 mUSDC
    const prevBalance = await mockUSDC.balanceOf(signer.address);

    console.log(`  Calling MockUSDC.faucet(100 mUSDC) to ${signer.address}...`);
    const faucetTx = await mockUSDC.faucet(signer.address, testAmount);
    const receipt = await faucetTx.wait(network.name === "sepolia" ? 2 : 1);
    console.log(`  ✓ Faucet tx confirmed: ${receipt.hash}`);

    const newBalance = await mockUSDC.balanceOf(signer.address);
    if (newBalance - prevBalance !== testAmount) {
      throw new Error(`Smoke test failed! Balance did not increase by 100 mUSDC`);
    }
    console.log(`  ✓ Smoke test passed: Balance increased from ${ethers.formatUnits(prevBalance, 6)} to ${ethers.formatUnits(newBalance, 6)} mUSDC`);
  } else {
    console.log("\n[Validation 5/5] Smoke test skipped (run with --smoke-test if needed).");
  }

  console.log("\n==================================================");
  console.log("✓ ALL ONCHAIN READ-ONLY VALIDATION CHECKS PASSED!");
  console.log("==================================================");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n[FATAL] Validation failed:", error.message || error);
      process.exit(1);
    });
}

module.exports = main;
