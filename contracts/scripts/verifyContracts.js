const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  console.log("==================================================");
  console.log("CrediFi — Etherscan Contract Verification");
  console.log("==================================================");
  console.log(`Network:  ${network.name}`);
  console.log(`Chain ID: ${network.chainId}\n`);

  const deploymentsFile = path.join(__dirname, `../deployments/${network.name}.json`);
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployment file not found at ${deploymentsFile}. Please run deploy first.`);
  }

  const manifest = JSON.parse(fs.readFileSync(deploymentsFile, "utf8"));
  const { MockUSDC, CreditRegistry, LendingPool, LoanManager } = manifest.contracts;
  const deployer = manifest.deployer;

  const results = {};

  const contractsToVerify = [
    {
      name: "MockUSDC",
      address: MockUSDC.address,
      constructorArguments: [],
    },
    {
      name: "CreditRegistry",
      address: CreditRegistry.address,
      constructorArguments: [deployer],
    },
    {
      name: "LendingPool",
      address: LendingPool.address,
      constructorArguments: [MockUSDC.address, deployer],
    },
    {
      name: "LoanManager",
      address: LoanManager.address,
      constructorArguments: [CreditRegistry.address, LendingPool.address, deployer],
    },
  ];

  for (const item of contractsToVerify) {
    console.log(`[Verifying] ${item.name} at ${item.address}...`);
    try {
      await hre.run("verify:verify", {
        address: item.address,
        constructorArguments: item.constructorArguments,
      });
      console.log(`✓ ${item.name} successfully verified!`);
      results[item.name] = "VERIFIED";
    } catch (err) {
      const msg = err.message || String(err);
      if (
        msg.toLowerCase().includes("already verified") ||
        msg.toLowerCase().includes("contract source code already verified")
      ) {
        console.log(`✓ ${item.name} is already verified on Etherscan.`);
        results[item.name] = "VERIFIED";
      } else {
        console.error(`✗ ${item.name} verification failed:`, msg);
        results[item.name] = `FAILED: ${msg}`;
      }
    }
  }

  console.log("\n==================================================");
  console.log("Verification Summary:");
  console.log("==================================================");
  for (const [name, status] of Object.entries(results)) {
    console.log(`${name.padEnd(16)}: ${status}`);
  }

  return results;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n[FATAL] Verification process failed:", error.message || error);
      process.exit(1);
    });
}

module.exports = main;
