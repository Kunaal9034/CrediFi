const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("====================================================");
  console.log("JusticeVault: EvidenceChain Deployment Pipeline");
  console.log(`Target Network: ${hre.network.name}`);
  console.log("====================================================");

  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    console.error("DEPLOYMENT HALTED: No deployer/operator account configured.");
    console.error("Please ensure OPERATOR_PRIVATE_KEY or PRIVATE_KEY is defined in environment variables or blockchain/.env");
    process.exit(1);
  }

  const deployer = signers[0];
  console.log("Deployer / Operator Address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceEther = hre.ethers.formatEther(balance);
  console.log(`Account Balance: ${balanceEther} POL/ETH`);

  if (balance === 0n && hre.network.name !== "hardhat") {
    console.error(`DEPLOYMENT HALTED: Deployer account ${deployer.address} has 0 balance on ${hre.network.name}.`);
    console.error("Testnet POL is required to pay for contract deployment gas on Polygon Amoy.");
    process.exit(1);
  }

  const network = await hre.ethers.provider.getNetwork();
  console.log(`Connected Chain ID: ${network.chainId}`);

  console.log("\nInitiating contract deployment...");
  const EvidenceChainFactory = await hre.ethers.getContractFactory("EvidenceChain");
  const evidenceChain = await EvidenceChainFactory.deploy();

  const deployTx = evidenceChain.deploymentTransaction();
  const txHash = deployTx ? deployTx.hash : "N/A";
  console.log("Deployment Transaction Hash:", txHash);

  console.log("Waiting for block confirmation...");
  await evidenceChain.waitForDeployment();

  const contractAddress = await evidenceChain.getAddress();
  console.log("====================================================");
  console.log(">>> EvidenceChain Deployed Successfully!");
  console.log("Contract Address:    ", contractAddress);
  console.log("Deployer/Operator:   ", deployer.address);
  console.log("Network Name:        ", hre.network.name);
  console.log("Chain ID:            ", network.chainId.toString());
  console.log("Transaction Hash:    ", txHash);
  console.log("====================================================");

  // Verify that the deployed contract can be queried
  console.log("\nVerifying on-chain contract state query...");
  const contractOwner = await evidenceChain.owner();
  const isDeployerOperator = await evidenceChain.authorizedOperators(deployer.address);
  console.log("Query Verified: Contract Owner =", contractOwner);
  console.log("Query Verified: Deployer Operator Status =", isDeployerOperator);

  // Save deployment artifact
  const deploymentInfo = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    contractAddress: contractAddress,
    deployer: deployer.address,
    transactionHash: txHash,
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const deploymentFilePath = path.join(outputDir, `${hre.network.name}.json`);
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment record saved to: ${deploymentFilePath}`);

  // Synchronize ABI to server and client
  const artifactPath = path.join(__dirname, "../artifacts/contracts/EvidenceChain.sol/EvidenceChain.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const contractAbi = {
      address: contractAddress,
      network: hre.network.name,
      chainId: Number(network.chainId),
      abi: artifact.abi,
    };

    const serverAbiDir = path.join(__dirname, "../../server/src/config");
    if (fs.existsSync(serverAbiDir)) {
      fs.writeFileSync(path.join(serverAbiDir, "contractAbi.json"), JSON.stringify(contractAbi, null, 2));
      console.log("ABI synchronized to: server/src/config/contractAbi.json");
    }

    const clientAbiDir = path.join(__dirname, "../../client/src/contracts");
    if (!fs.existsSync(clientAbiDir)) {
      fs.mkdirSync(clientAbiDir, { recursive: true });
    }
    fs.writeFileSync(path.join(clientAbiDir, "contractAbi.json"), JSON.stringify(contractAbi, null, 2));
    console.log("ABI synchronized to: client/src/contracts/contractAbi.json");
  }

  console.log("Deployment and ABI synchronization complete.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
