require("@nomicfoundation/hardhat-toolbox");
const path = require("path");

// Load .env from contracts directory or monorepo root
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo";

// Support DEPLOYER_PRIVATE_KEY or PRIVATE_KEY, with or without '0x' prefix
function getDeployerKey() {
  const rawKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!rawKey) {
    return "0x0000000000000000000000000000000000000000000000000000000000000001";
  }
  const cleanKey = rawKey.startsWith("0x") ? rawKey.slice(2).trim() : rawKey.trim();
  if (cleanKey.length === 64) {
    return `0x${cleanKey}`;
  }
  return `0x${cleanKey}`;
}

const DEPLOYER_PRIVATE_KEY = getDeployerKey();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 11155111,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};
