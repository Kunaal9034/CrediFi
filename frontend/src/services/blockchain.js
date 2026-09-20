import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CHAIN_ID } from '../contracts/addresses';
import MockUSDCAbi from '../contracts/abis/MockUSDC.json';
import CreditRegistryAbi from '../contracts/abis/CreditRegistry.json';
import LoanManagerAbi from '../contracts/abis/LoanManager.json';
import LendingPoolAbi from '../contracts/abis/LendingPool.json';

const SEPOLIA_RPC_FALLBACK = import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org';

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

  // Fallback provider if runner not passed
  const providerOrSigner = runner || new ethers.JsonRpcProvider(SEPOLIA_RPC_FALLBACK);
  return new ethers.Contract(address, abi, providerOrSigner);
}

/**
 * Fetch onchain credit score and borrowing power for an account
 */
export async function fetchOnchainCreditProfile(account, runner) {
  try {
    const registry = getContract('creditRegistry', runner);
    if (!registry || !account) {
      return { score: 500, limit: 500n * 10n ** 6n, profile: null };
    }

    const [score, limit, profile] = await Promise.all([
      registry.getCreditScore(account),
      registry.getBorrowingLimit(account),
      registry.getCreditProfile(account),
    ]);

    return {
      score: Number(score),
      limit: limit,
      profile: {
        score: Number(profile.score),
        loansTaken: Number(profile.loansTaken),
        loansRepaid: Number(profile.loansRepaid),
        defaults: Number(profile.defaults),
        totalBorrowed: profile.totalBorrowed,
        totalRepaid: profile.totalRepaid,
      },
    };
  } catch (err) {
    console.error('[blockchain.js] Failed to fetch credit profile:', err);
    return { score: 500, limit: 500n * 10n ** 6n, profile: null };
  }
}

/**
 * Fetch onchain MockUSDC balance for an account
 */
export async function fetchTokenBalance(account, runner) {
  try {
    const token = getContract('mockUSDC', runner);
    if (!token || !account) return 0n;
    return await token.balanceOf(account);
  } catch (err) {
    console.error('[blockchain.js] Failed to fetch token balance:', err);
    return 0n;
  }
}

/**
 * Switch or add network in MetaMask
 */
export async function switchNetwork(targetChainId = CHAIN_ID) {
  if (!window.ethereum) throw new Error('MetaMask is not installed');
  const hexChainId = '0x' + targetChainId.toString(16);

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
  } catch (switchError) {
    // 4902 means the chain has not been added to MetaMask
    if (switchError.code === 4902 && targetChainId === 11155111) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hexChainId,
            chainName: 'Sepolia Testnet',
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [SEPOLIA_RPC_FALLBACK],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}
