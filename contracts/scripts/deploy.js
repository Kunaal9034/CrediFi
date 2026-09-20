const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("==================================================");
  console.log("CrediFi - Smart Contract Deployment");
  console.log("==================================================");
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer ETH Balance: ${ethers.formatEther(balance)} ETH\n`);

  // 1. Deploy MockUSDC
  console.log("[1/4] Deploying MockUSDC...");
  const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDCFactory.deploy(deployer.address);
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log(`✓ MockUSDC deployed at: ${mockUSDCAddress}`);

  // 2. Deploy CreditRegistry
  console.log("\n[2/4] Deploying CreditRegistry...");
  const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistry");
  const creditRegistry = await CreditRegistryFactory.deploy(deployer.address);
  await creditRegistry.waitForDeployment();
  const creditRegistryAddress = await creditRegistry.getAddress();
  console.log(`✓ CreditRegistry deployed at: ${creditRegistryAddress}`);

  // 3. Deploy LendingPool
  console.log("\n[3/4] Deploying LendingPool...");
  const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPoolFactory.deploy(mockUSDCAddress, deployer.address);
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();
  console.log(`✓ LendingPool deployed at: ${lendingPoolAddress}`);

  // 4. Deploy LoanManager
  console.log("\n[4/4] Deploying LoanManager...");
  const LoanManagerFactory = await ethers.getContractFactory("LoanManager");
  const loanManager = await LoanManagerFactory.deploy(
    creditRegistryAddress,
    lendingPoolAddress,
    deployer.address
  );
  await loanManager.waitForDeployment();
  const loanManagerAddress = await loanManager.getAddress();
  console.log(`✓ LoanManager deployed at: ${loanManagerAddress}`);

  // 5. Grant Protocol Authorizations
  console.log("\n[5/5] Linking Protocol Authorizations...");
  const tx1 = await creditRegistry.setLoanManager(loanManagerAddress);
  await tx1.wait();
  console.log("✓ CreditRegistry.loanManager set to LoanManager");

  const tx2 = await lendingPool.setLoanManager(loanManagerAddress);
  await tx2.wait();
  console.log("✓ LendingPool.loanManager set to LoanManager");

  console.log("\n==================================================");
  console.log("Deployment Summary:");
  console.log("==================================================");
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MockUSDC: mockUSDCAddress,
      CreditRegistry: creditRegistryAddress,
      LendingPool: lendingPoolAddress,
      LoanManager: loanManagerAddress,
    },
  };
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to deployments.json
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment saved to: ${deploymentFile}`);

  // Copy compiled ABIs to frontend/src/contracts/abis/
  const artifactsDir = path.join(__dirname, "../artifacts/contracts");
  const frontendAbisDir = path.join(__dirname, "../../frontend/src/contracts/abis");
  if (fs.existsSync(frontendAbisDir)) {
    const contractsList = ["MockUSDC", "CreditRegistry", "LoanManager", "LendingPool"];
    for (const name of contractsList) {
      const artifactPath = path.join(artifactsDir, `${name}.sol`, `${name}.json`);
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        fs.writeFileSync(
          path.join(frontendAbisDir, `${name}.json`),
          JSON.stringify(artifact.abi, null, 2)
        );
        console.log(`✓ Copied ${name} ABI to frontend`);
      }
    }
  }

  // Update frontend/src/contracts/addresses.js
  const frontendAddressesFile = path.join(__dirname, "../../frontend/src/contracts/addresses.js");
  if (fs.existsSync(frontendAddressesFile)) {
    const addressFileContent = `// Export deployed smart contract addresses
export const CONTRACT_ADDRESSES = {
  mockUSDC: "${mockUSDCAddress}",
  creditRegistry: "${creditRegistryAddress}",
  loanManager: "${loanManagerAddress}",
  lendingPool: "${lendingPoolAddress}",
};

export const CHAIN_ID = ${Number(network.chainId)};
`;
    fs.writeFileSync(frontendAddressesFile, addressFileContent);
    console.log(`✓ Updated frontend addresses.js with deployed addresses`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
