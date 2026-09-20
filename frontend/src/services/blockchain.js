import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CHAIN_ID, EXPLORER_URL, SEPOLIA_RPC_DEFAULT } from '../contracts/addresses';
import MockUSDCAbi from '../contracts/abis/MockUSDC.json';
import CreditRegistryAbi from '../contracts/abis/CreditRegistry.json';
import LoanManagerAbi from '../contracts/abis/LoanManager.json';
import LendingPoolAbi from '../contracts/abis/LendingPool.json';

const SEPOLIA_RPC_FALLBACK = import.meta.env.VITE_RPC_URL || SEPOLIA_RPC_DEFAULT;

// Cached fallback read-only provider for Sepolia
let fallbackProvider = null;
export function getFallbackProvider() {
  if (!fallbackProvider) {
    fallbackProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_FALLBACK);
  }
  return fallbackProvider;
}

/**
 * Creates a read-only or signer-connected contract instance
 */
export function getContract(contractName, runner) {
  const address = CONTRACT_ADDRESSES[contractName];
  if (!address) {
    console.warn(`[blockchain.js] Address not found for contract: ${contractName}`);
    return null;
  }

  let abi;
  switch (contractName) {
    case 'mockUSDC':
      abi = MockUSDCAbi;
      break;
    case 'creditRegistry':
      abi = CreditRegistryAbi;
      break;
    case 'loanManager':
      abi = LoanManagerAbi;
      break;
    case 'lendingPool':
      abi = LendingPoolAbi;
      break;
    default:
      throw new Error(`Unknown contract: ${contractName}`);
  }

  const providerOrSigner = runner || getFallbackProvider();
  return new ethers.Contract(address, abi, providerOrSigner);
}

/**
 * Fetch onchain credit score and borrowing power for an account directly from Sepolia
 */
export async function fetchOnchainCreditProfile(account, runner) {
  const defaultLimit = 500n * 10n ** 6n; // 500 mUSDC base
  const defaultState = {
    score: 500,
    limit: defaultLimit,
    availableBorrowingPower: defaultLimit,
    outstandingPrincipal: 0n,
    profile: {
      score: 500,
      totalLoans: 0,
      loansTaken: 0,
      repaidLoans: 0,
      loansRepaid: 0,
      defaultedLoans: 0,
      defaults: 0,
      totalBorrowed: 0n,
      totalRepaid: 0n,
      lastUpdated: 0,
      initialized: false,
    },
  };

  if (!account) return defaultState;

  try {
    const registry = getContract('creditRegistry', runner);
    const loanManager = getContract('loanManager', runner);

    if (!registry) return defaultState;

    const [score, limit, profile, availablePower, outstanding] = await Promise.all([
      registry.getCreditScore(account),
      registry.getBorrowingLimit(account),
      registry.getCreditProfile(account),
      loanManager ? loanManager.getAvailableBorrowingPower(account).catch(() => null) : null,
      loanManager ? loanManager.getOutstandingPrincipal(account).catch(() => null) : null,
    ]);

    const numScore = Number(score);
    const resolvedLimit = typeof limit === 'bigint' ? limit : BigInt(limit);
    const resolvedAvailable = availablePower !== null ? (typeof availablePower === 'bigint' ? availablePower : BigInt(availablePower)) : resolvedLimit;
    const resolvedOutstanding = outstanding !== null ? (typeof outstanding === 'bigint' ? outstanding : BigInt(outstanding)) : 0n;

    return {
      score: numScore,
      limit: resolvedLimit,
      availableBorrowingPower: resolvedAvailable,
      outstandingPrincipal: resolvedOutstanding,
      profile: {
        score: numScore,
        totalLoans: Number(profile.totalLoans || 0),
        loansTaken: Number(profile.totalLoans || 0),
        repaidLoans: Number(profile.repaidLoans || 0),
        loansRepaid: Number(profile.repaidLoans || 0),
        defaultedLoans: Number(profile.defaultedLoans || 0),
        defaults: Number(profile.defaultedLoans || 0),
        totalBorrowed: profile.totalBorrowed || 0n,
        totalRepaid: profile.totalRepaid || 0n,
        lastUpdated: Number(profile.lastUpdated || 0),
        initialized: Boolean(profile.initialized),
      },
    };
  } catch (err) {
    console.error('[blockchain.js] Failed to fetch onchain credit profile:', err);
    throw err;
  }
}

/**
 * Fetch onchain MockUSDC balance for an account
 */
export async function fetchTokenBalance(account, runner) {
  if (!account) return 0n;
  try {
    const token = getContract('mockUSDC', runner);
    if (!token) return 0n;
    return await token.balanceOf(account);
  } catch (err) {
    console.error('[blockchain.js] Failed to fetch token balance:', err);
    return 0n;
  }
}

/**
 * Switch or add network in MetaMask for Sepolia
 */
export async function switchNetwork(targetChainId = CHAIN_ID) {
  if (!window.ethereum) throw new Error('MetaMask is not detected. Please install MetaMask.');
  const hexChainId = '0x' + targetChainId.toString(16);

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
  } catch (switchError) {
    // 4902: Chain has not been added to MetaMask
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hexChainId,
            chainName: 'Ethereum Sepolia',
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [SEPOLIA_RPC_FALLBACK],
            blockExplorerUrls: [EXPLORER_URL],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

export function getExplorerAddressUrl(address) {
  return `${EXPLORER_URL}/address/${address}`;
}

export function getExplorerTxUrl(txHash) {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

/**
 * Normalizes onchain Loan struct into a consistent JS object
 */
export function normalizeLoan(loan) {
  if (!loan) return null;
  const loanId = Number(loan.loanId ?? 0);
  const principal = typeof loan.principal === 'bigint' ? loan.principal : BigInt(loan.principal || 0);
  const interestRateBps = Number(loan.interestRateBps ?? loan.interestRate ?? 0);
  const duration = Number(loan.duration ?? 0);
  const totalDue = typeof loan.totalDue === 'bigint' ? loan.totalDue : BigInt(loan.totalDue || 0);
  const createdAt = Number(loan.createdAt ?? loan.startTime ?? 0);
  const dueDate = Number(loan.dueDate ?? 0);
  const status = Number(loan.status ?? 0);

  return {
    loanId,
    borrower: loan.borrower,
    lender: loan.lender,
    principal,
    interestRateBps,
    interestRate: interestRateBps, // alias for backwards compatibility
    duration,
    totalDue,
    createdAt,
    startTime: createdAt, // alias for backwards compatibility
    dueDate,
    status,
  };
}

/**
 * Fetch full onchain details for a specific loan
 */
export async function fetchLoanDetails(loanId, runner) {
  if (!loanId) return null;
  try {
    const loanManager = getContract('loanManager', runner);
    if (!loanManager) return null;
    const loan = await loanManager.getLoan(loanId);
    return normalizeLoan(loan);
  } catch (err) {
    console.error(`[blockchain.js] Failed to fetch loan #${loanId}:`, err);
    return null;
  }
}

/**
 * Scan onchain loans directly from LoanManager on Sepolia
 */
export async function fetchUserLoansOnchain(account, runner) {
  if (!account) return [];
  try {
    const loanManager = getContract('loanManager', runner);
    if (!loanManager) return [];
    const count = await loanManager.loanCounter();
    const totalCount = Number(count);
    const userLoans = [];
    const target = account.toLowerCase();

    for (let i = 1; i <= totalCount; i++) {
      try {
        const loan = await loanManager.getLoan(i);
        if (
          (loan.borrower && loan.borrower.toLowerCase() === target) ||
          (loan.lender && loan.lender.toLowerCase() === target)
        ) {
          userLoans.push(normalizeLoan(loan));
        }
      } catch (innerErr) {
        console.warn(`[blockchain.js] Skipping loan #${i}:`, innerErr.message);
      }
    }
    return userLoans.reverse();
  } catch (err) {
    console.error('[blockchain.js] Failed to fetch user loans onchain:', err);
    return [];
  }
}

/**
 * Scan all open REQUESTED loans directly from LoanManager on Sepolia
 */
export async function fetchMarketplaceLoansOnchain(runner) {
  try {
    const loanManager = getContract('loanManager', runner);
    if (!loanManager) return [];
    const count = await loanManager.loanCounter();
    const totalCount = Number(count);
    const marketplaceLoans = [];

    for (let i = 1; i <= totalCount; i++) {
      try {
        const loan = await loanManager.getLoan(i);
        if (Number(loan.status) === 0) {
          marketplaceLoans.push(normalizeLoan(loan));
        }
      } catch (innerErr) {
        console.warn(`[blockchain.js] Skipping marketplace loan #${i}:`, innerErr.message);
      }
    }
    return marketplaceLoans.reverse();
  } catch (err) {
    console.error('[blockchain.js] Failed to fetch marketplace loans onchain:', err);
    return [];
  }
}

/**
 * Check ERC20 token allowance
 */
export async function checkAllowance(tokenName, owner, spender, runner) {
  if (!owner || !spender) return 0n;
  try {
    const token = getContract(tokenName, runner);
    if (!token) return 0n;
    return await token.allowance(owner, spender);
  } catch (err) {
    console.error(`[blockchain.js] Failed to check allowance for ${tokenName}:`, err);
    return 0n;
  }
}

