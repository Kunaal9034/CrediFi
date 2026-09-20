import { useState } from 'react';
import { useWallet } from './useWallet';
import { useTransaction } from './useTransaction';
import { getContract, fetchLoanDetails } from '../services/blockchain';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import { ethers } from 'ethers';

export function useLoan() {
  const { account, signer, refreshBalances, isCorrectNetwork } = useWallet();
  const tx = useTransaction();
  const [createdLoan, setCreatedLoan] = useState(null);

  // 1. Request Loan
  // Contract signature: createLoan(uint256 principal, uint256 interestRateBps, uint256 duration)
  const requestLoan = async (amountRaw, interestRateBps, durationSeconds, onStateRefresh) => {
    if (!account) throw new Error('Please connect your MetaMask wallet');
    if (!signer) throw new Error('Signer not available. Please unlock MetaMask');
    if (!isCorrectNetwork) throw new Error('Please switch to Ethereum Sepolia (Chain ID 11155111)');

    const loanManager = getContract('loanManager', signer);
    if (!loanManager) throw new Error('LoanManager contract not initialized');

    setCreatedLoan(null);

    const receipt = await tx.executeTransaction(
      async () => {
        // Contract order: principal, interestRateBps, duration
        const transaction = await loanManager.createLoan(amountRaw, interestRateBps, durationSeconds);
        return transaction;
      },
      async () => {
        await refreshBalances();
        if (onStateRefresh && typeof onStateRefresh === 'function') {
          await onStateRefresh();
        }
      }
    );

    // Parse LoanCreated event from receipt logs
    let extractedLoanId = null;
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = loanManager.interface.parseLog(log);
          if (parsed && parsed.name === 'LoanCreated') {
            extractedLoanId = Number(parsed.args.loanId);
            break;
          }
        } catch {
          // Log not from LoanManager or non-matching event
        }
      }
    }

    let loanData = null;
    if (extractedLoanId) {
      try {
        loanData = await fetchLoanDetails(extractedLoanId, signer);
      } catch (e) {
        console.warn('[useLoan] Failed to fetch newly created loan details:', e);
      }
    }

    const createdInfo = {
      loanId: extractedLoanId,
      txHash: receipt ? receipt.hash : null,
      principal: amountRaw,
      interestRateBps,
      duration: durationSeconds,
      loan: loanData,
    };

    setCreatedLoan(createdInfo);
    return { receipt, loanId: extractedLoanId, createdLoan: createdInfo };
  };

  const resetAll = () => {
    tx.reset();
    setCreatedLoan(null);
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
    createdLoan,
    reset: resetAll,
    requestLoan,
    fundLoan,
    repayLoan,
    claimFaucet,
  };
}
