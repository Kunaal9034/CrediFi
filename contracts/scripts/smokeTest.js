const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("==================================================");
  console.log("CrediFi — MockUSDC Faucet Controlled Smoke Test");
  console.log("==================================================");
  console.log(`Network:   ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Caller:    ${signer.address}\n`);

  const manifestPath = path.join(__dirname, `../deployments/${network.name}.json`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Deployment manifest not found at ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const mockUSDCAddress = ethers.getAddress(manifest.contracts.MockUSDC.address);

  const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddress);

  const testAmount = ethers.parseUnits("100", 6); // 100 mUSDC
  const initialBalance = await mockUSDC.balanceOf(signer.address);
  console.log(`Initial mUSDC Balance: ${ethers.formatUnits(initialBalance, 6)} mUSDC`);

  console.log(`Submitting MockUSDC.faucet(${signer.address}, 100 mUSDC)...`);
  const tx = await mockUSDC.faucet(signer.address, testAmount);
  console.log(`Transaction submitted: ${tx.hash}`);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait(network.name === "sepolia" ? 2 : 1);
  console.log(`✓ Confirmed in block ${receipt.blockNumber} (tx: ${receipt.hash})`);

  const finalBalance = await mockUSDC.balanceOf(signer.address);
  console.log(`Final mUSDC Balance:   ${ethers.formatUnits(finalBalance, 6)} mUSDC`);

  if (finalBalance - initialBalance !== testAmount) {
    throw new Error("Balance did not increment by exactly 100 mUSDC");
  }

  console.log("\n==================================================");
  console.log("✓ MockUSDC Faucet Smoke Test PASSED!");
  console.log("==================================================");

  return {
    txHash: receipt.hash,
    recipient: signer.address,
    amountMinted: "100.0 mUSDC",
    initialBalance: ethers.formatUnits(initialBalance, 6),
    finalBalance: ethers.formatUnits(finalBalance, 6),
  };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n[SMOKE TEST FAILED]", err);
      process.exit(1);
    });
}

module.exports = main;
