// Export deployed smart contract addresses for Ethereum Sepolia (Chain ID 11155111)
// Sourced directly from contracts/deployments/sepolia.json

export const CHAIN_ID = 11155111;

export const CONTRACT_ADDRESSES = {
  mockUSDC: import.meta.env.VITE_MOCK_USDC_ADDRESS || "0xfaaF91778853F35FB7Db545dc3586aFc354103d0",
  creditRegistry: import.meta.env.VITE_CREDIT_REGISTRY_ADDRESS || "0x9b117D9528c43Fb2938e43172b1935f38F2C6f90",
  lendingPool: import.meta.env.VITE_LENDING_POOL_ADDRESS || "0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5",
  loanManager: import.meta.env.VITE_LOAN_MANAGER_ADDRESS || "0x21b39401646D783690E3902C90963c711Ff7cC1C",
};

export const EXPLORER_URL = "https://sepolia.etherscan.io";
export const SEPOLIA_RPC_DEFAULT = "https://ethereum-sepolia-rpc.publicnode.com";
