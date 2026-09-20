// Export deployed smart contract addresses configured from environment
export const CONTRACT_ADDRESSES = {
  mockUSDC: import.meta.env.VITE_MOCK_USDC_ADDRESS || '',
  creditRegistry: import.meta.env.VITE_CREDIT_REGISTRY_ADDRESS || '',
  loanManager: import.meta.env.VITE_LOAN_MANAGER_ADDRESS || '',
  lendingPool: import.meta.env.VITE_LENDING_POOL_ADDRESS || '',
};

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111);
