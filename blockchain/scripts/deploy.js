const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("----------------------------------------------------");
  console.log("JusticeVault: Deploying EvidenceChain Smart Contract");
  console.log(`Network: ${hre.network.name} (Chain ID: ${hre.network.config.chainId || "unknown"})`);
  console.log("----------------------------------------------------");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer account:", deployer ? deployer.address : "No signer");

  if (deployer) {
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", hre.ethers.formatEther(balance), "POL/ETH");
  }

  const EvidenceChain = await hre.ethers.getContractFactory("EvidenceChain");
  const evidenceChain = await EvidenceChain.deploy();
  await evidenceChain.waitForDeployment();

  const contractAddress = await evidenceChain.getAddress();
  console.log(">>> EvidenceChain deployed successfully to:", contractAddress);

  // Export deployment info for backend and frontend
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId || 31337,
    contractAddress: contractAddress,
    deployer: deployer ? deployer.address : "",
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, `${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment details saved to deployments/${hre.network.name}.json`);

  // Copy ABI to server and client if directories exist
  const artifactPath = path.join(__dirname, "../artifacts/contracts/EvidenceChain.sol/EvidenceChain.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const contractAbi = {
      address: contractAddress,
      abi: artifact.abi,
    };

    const serverAbiDir = path.join(__dirname, "../../server/src/config");
    if (fs.existsSync(serverAbiDir)) {
      fs.writeFileSync(path.join(serverAbiDir, "contractAbi.json"), JSON.stringify(contractAbi, null, 2));
      console.log("ABI synced to server/src/config/contractAbi.json");
    }

    const clientAbiDir = path.join(__dirname, "../../client/src/contracts");
    if (!fs.existsSync(clientAbiDir)) {
      fs.mkdirSync(clientAbiDir, { recursive: true });
    }
    fs.writeFileSync(path.join(clientAbiDir, "contractAbi.json"), JSON.stringify(contractAbi, null, 2));
    console.log("ABI synced to client/src/contracts/contractAbi.json");
  }

  console.log("----------------------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
