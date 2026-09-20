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
    return defaultState;
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
