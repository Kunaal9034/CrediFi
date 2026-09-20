import { useWallet } from './useWallet';
import { useTransaction } from './useTransaction';
import { getContract } from '../services/blockchain';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import { ethers } from 'ethers';

export function useLoan() {
  const { account, signer, refreshBalances } = useWallet();
  const tx = useTransaction();

  // 1. Request Loan
  const requestLoan = async (amountRaw, durationSeconds, interestRateBps) => {
    if (!signer) throw new Error('Please connect your MetaMask wallet');
    const loanManager = getContract('loanManager', signer);
    if (!loanManager) throw new Error('LoanManager contract not initialized');

    return await tx.executeTransaction(async () => {
      const transaction = await loanManager.createLoan(amountRaw, durationSeconds, interestRateBps);
      return transaction;
    });
  };

  // 2. Fund Loan (Handles approval if necessary)
  const fundLoan = async (loanId, principalAmount) => {
    if (!signer) throw new Error('Please connect your MetaMask wallet');
    const loanManager = getContract('loanManager', signer);
    const mockUSDC = getContract('mockUSDC', signer);
    const lendingPoolAddress = CONTRACT_ADDRESSES.lendingPool;

    if (!loanManager || !mockUSDC) throw new Error('Contracts not initialized');

    return await tx.executeTransaction(async () => {
      // Check allowance
      const currentAllowance = await mockUSDC.allowance(account, lendingPoolAddress);
      if (currentAllowance < principalAmount) {
        // Approve
        const approveTx = await mockUSDC.approve(lendingPoolAddress, ethers.MaxUint256);
        await approveTx.wait();
      }

      // Fund
      const transaction = await loanManager.fundLoan(loanId);
      return transaction;
    });
  };

  // 3. Repay Loan (Handles approval if necessary)
  const repayLoan = async (loanId, totalDue) => {
    if (!signer) throw new Error('Please connect your MetaMask wallet');
    const loanManager = getContract('loanManager', signer);
    const mockUSDC = getContract('mockUSDC', signer);
    const lendingPoolAddress = CONTRACT_ADDRESSES.lendingPool;

    if (!loanManager || !mockUSDC) throw new Error('Contracts not initialized');

    return await tx.executeTransaction(async () => {
      // Check allowance
      const currentAllowance = await mockUSDC.allowance(account, lendingPoolAddress);
      if (currentAllowance < totalDue) {
        const approveTx = await mockUSDC.approve(lendingPoolAddress, ethers.MaxUint256);
        await approveTx.wait();
      }

      // Repay
      const transaction = await loanManager.repayLoan(loanId);
      return transaction;
    });
  };

  // 4. Claim Demo Faucet Tokens
  const claimFaucet = async (amountRaw = 1000n * 10n ** 6n) => {
    if (!signer) throw new Error('Please connect your MetaMask wallet');
    const mockUSDC = getContract('mockUSDC', signer);

    const receipt = await tx.executeTransaction(async () => {
      const transaction = await mockUSDC.faucet(account, amountRaw);
      return transaction;
    });

    await refreshBalances();
    return receipt;
  };

  return {
    ...tx,
    requestLoan,
    fundLoan,
    repayLoan,
    claimFaucet,
  };
}
