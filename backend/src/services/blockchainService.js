const { ethers } = require('ethers');
require('dotenv').config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);

// Contract Addresses
const ADDRESSES = {
  creditRegistry: process.env.CREDIT_REGISTRY_ADDRESS || '',
  loanManager: process.env.LOAN_MANAGER_ADDRESS || '',
  lendingPool: process.env.LENDING_POOL_ADDRESS || '',
  mockUSDC: process.env.MOCK_USDC_ADDRESS || '',
};

// Minimal ABIs for backend reading & event verification
const ABIS = {
  creditRegistry: [
    'function getCreditScore(address) view returns (uint256)',
    'function getBorrowingLimit(address) view returns (uint256)',
    'function getCreditProfile(address) view returns (tuple(uint256 score, uint256 loansTaken, uint256 loansRepaid, uint256 defaults, uint256 totalBorrowed, uint256 totalRepaid, bool initialized))',
  ],
  loanManager: [
    'function getLoan(uint256) view returns (tuple(uint256 loanId, address borrower, address lender, uint256 principal, uint256 interestRate, uint256 duration, uint256 startTime, uint256 dueDate, uint8 status))',
    'function loanCounter() view returns (uint256)',
    'function calculateTotalDue(uint256) view returns (uint256)',
  ],
  mockUSDC: [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ],
};

function getContract(name) {
  const address = ADDRESSES[name];
  const abi = ABIS[name];
  if (!address || !abi) return null;
  return new ethers.Contract(address, abi, provider);
}

async function getOnchainCreditProfile(wallet) {
  try {
    const registry = getContract('creditRegistry');
    if (!registry) return null;
    const [score, limit, profile] = await Promise.all([
      registry.getCreditScore(wallet),
      registry.getBorrowingLimit(wallet),
      registry.getCreditProfile(wallet),
    ]);
    return {
      score: Number(score),
      limit: limit.toString(),
      loansTaken: Number(profile.loansTaken),
      loansRepaid: Number(profile.loansRepaid),
      defaults: Number(profile.defaults),
      totalBorrowed: profile.totalBorrowed.toString(),
      totalRepaid: profile.totalRepaid.toString(),
    };
  } catch (err) {
    console.error(`[blockchainService] Error reading credit profile for ${wallet}:`, err.message);
    return null;
  }
}

async function getOnchainLoan(loanId) {
  try {
    const manager = getContract('loanManager');
    if (!manager) return null;
    const loan = await manager.getLoan(loanId);
    return {
      loanId: Number(loan.loanId),
      borrower: loan.borrower,
      lender: loan.lender,
      principal: loan.principal.toString(),
      interestRate: Number(loan.interestRate),
      duration: Number(loan.duration),
      startTime: Number(loan.startTime),
      dueDate: Number(loan.dueDate),
      status: Number(loan.status),
    };
  } catch (err) {
    console.error(`[blockchainService] Error reading loan #${loanId}:`, err.message);
    return null;
  }
}

module.exports = {
  provider,
  ADDRESSES,
  getContract,
  getOnchainCreditProfile,
  getOnchainLoan,
};
