const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("==================================================");
  console.log("CrediFi — Smart Contract Deployment");
  console.log("==================================================");
  console.log(`Network:      ${network.name}`);
  console.log(`Chain ID:     ${chainId}`);
  console.log(`Deployer:     ${ethers.getAddress(deployer.address)}`);

  // Guard against unexpected networks if running sepolia deploy
  if (process.env.HARDHAT_NETWORK === "sepolia" || network.name === "sepolia") {
    if (chainId !== 11155111) {
      throw new Error(`ABORT: Target is Sepolia but RPC returned chain ID ${chainId}. Expected 11155111.`);
    }
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceEth = ethers.formatEther(balance);
  console.log(`ETH Balance:  ${balanceEth} ETH\n`);

  if (balance === 0n) {
    throw new Error(
      `ABORT: Deployer wallet ${deployer.address} has 0 ETH. Please fund with Sepolia testnet ETH before deploying.`
    );
  }

  const isLiveNetwork = chainId === 11155111;
  const confirmations = isLiveNetwork ? 2 : 1;

  // ----------------------------------------------------
  // 1. Deploy MockUSDC
  // ----------------------------------------------------
  console.log("[1/4] Deploying MockUSDC...");
  const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDCFactory.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = ethers.getAddress(await mockUSDC.getAddress());
  const mockUSDCDepTx = mockUSDC.deploymentTransaction();
  const mockUSDCTxHash = mockUSDCDepTx ? mockUSDCDepTx.hash : "0x";
  if (isLiveNetwork && mockUSDCDepTx) {
    console.log(`  Waiting for ${confirmations} confirmations...`);
    await mockUSDCDepTx.wait(confirmations);
  }
  console.log(`✓ MockUSDC deployed:    ${mockUSDCAddress} (tx: ${mockUSDCTxHash})`);

  // ----------------------------------------------------
  // 2. Deploy CreditRegistry
  // ----------------------------------------------------
  console.log("\n[2/4] Deploying CreditRegistry...");
  const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistry");
  const creditRegistry = await CreditRegistryFactory.deploy(deployer.address);
  await creditRegistry.waitForDeployment();
  const creditRegistryAddress = ethers.getAddress(await creditRegistry.getAddress());
  const creditRegistryDepTx = creditRegistry.deploymentTransaction();
  const creditRegistryTxHash = creditRegistryDepTx ? creditRegistryDepTx.hash : "0x";
  if (isLiveNetwork && creditRegistryDepTx) {
    console.log(`  Waiting for ${confirmations} confirmations...`);
    await creditRegistryDepTx.wait(confirmations);
  }
  console.log(`✓ CreditRegistry deployed: ${creditRegistryAddress} (tx: ${creditRegistryTxHash})`);

  // ----------------------------------------------------
  // 3. Deploy LendingPool
  // ----------------------------------------------------
  console.log("\n[3/4] Deploying LendingPool...");
  const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
  // Initial deploy passes mockUSDC and deployer as temporary LoanManager placeholder
  const lendingPool = await LendingPoolFactory.deploy(mockUSDCAddress, deployer.address);
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = ethers.getAddress(await lendingPool.getAddress());
  const lendingPoolDepTx = lendingPool.deploymentTransaction();
  const lendingPoolTxHash = lendingPoolDepTx ? lendingPoolDepTx.hash : "0x";
  if (isLiveNetwork && lendingPoolDepTx) {
    console.log(`  Waiting for ${confirmations} confirmations...`);
    await lendingPoolDepTx.wait(confirmations);
  }
  console.log(`✓ LendingPool deployed:    ${lendingPoolAddress} (tx: ${lendingPoolTxHash})`);

  // ----------------------------------------------------
  // 4. Deploy LoanManager
  // ----------------------------------------------------
  console.log("\n[4/4] Deploying LoanManager...");
  const LoanManagerFactory = await ethers.getContractFactory("LoanManager");
  const loanManager = await LoanManagerFactory.deploy(
    creditRegistryAddress,
    lendingPoolAddress,
    deployer.address
  );
  await loanManager.waitForDeployment();
  const loanManagerAddress = ethers.getAddress(await loanManager.getAddress());
  const loanManagerDepTx = loanManager.deploymentTransaction();
  const loanManagerTxHash = loanManagerDepTx ? loanManagerDepTx.hash : "0x";
  if (isLiveNetwork && loanManagerDepTx) {
    console.log(`  Waiting for ${confirmations} confirmations...`);
    await loanManagerDepTx.wait(confirmations);
  }
  console.log(`✓ LoanManager deployed:    ${loanManagerAddress} (tx: ${loanManagerTxHash})`);

  // ----------------------------------------------------
  // 5. Link Protocol Authorizations
  // ----------------------------------------------------
  console.log("\n[Protocol Configuration] Setting authorized LoanManager...");
  console.log("  1. Configuring CreditRegistry.setLoanManager...");
  const tx1 = await creditRegistry.setLoanManager(loanManagerAddress);
  const rc1 = await tx1.wait(confirmations);
  console.log(`  ✓ CreditRegistry linked (tx: ${rc1.hash})`);

  console.log("  2. Configuring LendingPool.setLoanManager...");
  const tx2 = await lendingPool.setLoanManager(loanManagerAddress);
  const rc2 = await tx2.wait(confirmations);
  console.log(`  ✓ LendingPool linked (tx: ${rc2.hash})`);

  // ----------------------------------------------------
  // 6. Write Deployment Manifest
  // ----------------------------------------------------
  const deploymentManifest = {
    network: network.name,
    chainId: chainId,
    deployedAt: new Date().toISOString(),
    deployer: ethers.getAddress(deployer.address),
    contracts: {
      MockUSDC: {
        address: mockUSDCAddress,
        txHash: mockUSDCTxHash,
      },
      CreditRegistry: {
        address: creditRegistryAddress,
        txHash: creditRegistryTxHash,
      },
      LendingPool: {
        address: lendingPoolAddress,
        txHash: lendingPoolTxHash,
      },
      LoanManager: {
        address: loanManagerAddress,
        txHash: loanManagerTxHash,
      },
    },
    configurations: {
      CreditRegistry_setLoanManager: {
        txHash: rc1.hash,
        target: loanManagerAddress,
      },
      LendingPool_setLoanManager: {
        txHash: rc2.hash,
        target: loanManagerAddress,
      },
    },
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const manifestPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(deploymentManifest, null, 2) + "\n");
  console.log("\n==================================================");
  console.log(`✓ Deployment manifest successfully written to:`);
  console.log(`  ${manifestPath}`);
  console.log("==================================================");

  return deploymentManifest;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n[FATAL] Deployment failed:", error.message || error);
      process.exit(1);
    });
}

module.exports = main;
