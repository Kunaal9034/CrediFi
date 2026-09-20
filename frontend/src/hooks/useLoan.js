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

  const [fundedLoan, setFundedLoan] = useState(null);

  const resetAll = () => {
    tx.reset();
    setCreatedLoan(null);
    setFundedLoan(null);
  };

  // 2. Approve LendingPool to spend MockUSDC
  const approveLendingPool = async (amount = ethers.MaxUint256) => {
    if (!account) throw new Error('Please connect your MetaMask wallet');
    if (!signer) throw new Error('Signer not available. Please unlock MetaMask');
    if (!isCorrectNetwork) throw new Error('Please switch to Ethereum Sepolia (Chain ID 11155111)');

    const mockUSDC = getContract('mockUSDC', signer);
    const lendingPoolAddress = CONTRACT_ADDRESSES.lendingPool;

    if (!mockUSDC) throw new Error('MockUSDC contract not initialized');

    return await tx.executeTransaction(async () => {
      const transaction = await mockUSDC.approve(lendingPoolAddress, amount);
      return transaction;
    });
  };

  // 3. Fund Loan (Lender provides principal to borrower)
  const fundLoan = async (loanId, onStateRefresh) => {
    if (!account) throw new Error('Please connect your MetaMask wallet');
    if (!signer) throw new Error('Signer not available. Please unlock MetaMask');
    if (!isCorrectNetwork) throw new Error('Please switch to Ethereum Sepolia (Chain ID 11155111)');

    const loanManager = getContract('loanManager', signer);
    const mockUSDC = getContract('mockUSDC', signer);
    const lendingPoolAddress = CONTRACT_ADDRESSES.lendingPool;

    if (!loanManager || !mockUSDC) throw new Error('Contracts not initialized');

    // Fresh onchain check of loan terms and status before broadcast
    const onchainLoan = await loanManager.getLoan(loanId);
    if (!onchainLoan || onchainLoan.loanId === 0n) {
      throw new Error('Loan does not exist onchain');
    }
    if (Number(onchainLoan.status) !== 0) {
      throw new Error('This loan is no longer open for funding (status is not REQUESTED)');
    }
    if (onchainLoan.borrower.toLowerCase() === account.toLowerCase()) {
      throw new Error('You cannot fund your own loan request');
    }

    // Check lender balance
    const lenderBalance = await mockUSDC.balanceOf(account);
    if (lenderBalance < onchainLoan.principal) {
      throw new Error('Insufficient MockUSDC balance to fund this loan');
    }

    // Check allowance
    const allowance = await mockUSDC.allowance(account, lendingPoolAddress);
    if (allowance < onchainLoan.principal) {
      throw new Error('Insufficient MockUSDC allowance. Please approve LendingPool first');
    }

    setFundedLoan(null);

    const receipt = await tx.executeTransaction(
      async () => {
        const transaction = await loanManager.fundLoan(loanId);
        return transaction;
      },
      async () => {
        await refreshBalances();
        if (onStateRefresh && typeof onStateRefresh === 'function') {
          await onStateRefresh();
        }
      }
    );

    // Parse LoanFunded event from receipt logs
    let extractedLoanId = null;
    let extractedLender = null;
    let extractedBorrower = null;
    let extractedPrincipal = null;
    let extractedDueDate = null;

    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = loanManager.interface.parseLog(log);
          if (parsed && parsed.name === 'LoanFunded') {
            extractedLoanId = Number(parsed.args.loanId);
            extractedLender = parsed.args.lender;
            extractedBorrower = parsed.args.borrower;
            extractedPrincipal = parsed.args.principal;
            extractedDueDate = Number(parsed.args.dueDate);
            break;
          }
        } catch {
          // Skip non-matching event
        }
      }
    }

    let updatedLoan = null;
    try {
      updatedLoan = await fetchLoanDetails(loanId, signer);
    } catch (e) {
      console.warn('[useLoan] Failed to fetch updated funded loan details:', e);
    }

    const fundedInfo = {
      loanId: extractedLoanId || Number(loanId),
      txHash: receipt ? receipt.hash : null,
      lender: extractedLender || account,
      borrower: extractedBorrower || onchainLoan.borrower,
      principal: extractedPrincipal || onchainLoan.principal,
      dueDate: extractedDueDate || Number(onchainLoan.dueDate),
      loan: updatedLoan,
    };

    setFundedLoan(fundedInfo);
    return { receipt, fundedLoan: fundedInfo };
  };

  // 4. Repay Loan (Handles approval if necessary)
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

  // 5. Claim Demo Faucet Tokens
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
    fundedLoan,
    reset: resetAll,
    requestLoan,
    approveLendingPool,
    fundLoan,
    repayLoan,
    claimFaucet,
  };
}
