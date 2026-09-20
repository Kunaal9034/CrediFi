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
  const [repaidLoan, setRepaidLoan] = useState(null);

  const resetAll = () => {
    tx.reset();
    setCreatedLoan(null);
    setFundedLoan(null);
    setRepaidLoan(null);
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

  // 4. Repay Loan (Borrower settles active loan)
  const repayLoan = async (loanId, onStateRefresh) => {
    if (!account) throw new Error('Please connect your MetaMask wallet');
    if (!signer) throw new Error('Signer not available. Please unlock MetaMask');
    if (!isCorrectNetwork) throw new Error('Please switch to Ethereum Sepolia (Chain ID 11155111)');

    const loanManager = getContract('loanManager', signer);
    const mockUSDC = getContract('mockUSDC', signer);
    const creditRegistry = getContract('creditRegistry', signer);
    const lendingPoolAddress = CONTRACT_ADDRESSES.lendingPool;

    if (!loanManager || !mockUSDC || !creditRegistry) throw new Error('Contracts not initialized');

    // Fresh onchain check of loan terms and status before broadcast
    const onchainLoan = await loanManager.getLoan(loanId);
    if (!onchainLoan || onchainLoan.loanId === 0n) {
      throw new Error('Loan does not exist onchain');
    }
    if (Number(onchainLoan.status) !== 1) {
      throw new Error('This loan is no longer active (status is not ACTIVE)');
    }
    if (onchainLoan.borrower.toLowerCase() !== account.toLowerCase()) {
      throw new Error('Only the borrower can repay this loan');
    }

    // Check borrower balance
    const borrowerBalance = await mockUSDC.balanceOf(account);
    if (borrowerBalance < onchainLoan.totalDue) {
      throw new Error('Insufficient MockUSDC balance to repay this loan');
    }

    // Check allowance
    const allowance = await mockUSDC.allowance(account, lendingPoolAddress);
    if (allowance < onchainLoan.totalDue) {
      throw new Error('Insufficient MockUSDC allowance. Please approve LendingPool first');
    }

    // Record pre-repayment state
    let scoreBefore = 500;
    let limitBefore = 0n;
    let outstandingBefore = 0n;
    try {
      scoreBefore = await creditRegistry.getCreditScore(account);
      limitBefore = await creditRegistry.getBorrowingLimit(account);
      outstandingBefore = await loanManager.getOutstandingPrincipal(account);
    } catch (err) {
      console.warn('[useLoan] Could not read pre-repayment credit metrics:', err);
    }

    setRepaidLoan(null);

    const receipt = await tx.executeTransaction(
      async () => {
        return await loanManager.repayLoan(loanId);
      },
      async () => {
        await refreshBalances();
        if (onStateRefresh) await onStateRefresh();
      }
    );

    // Parse LoanRepaid event from logs
    let extractedLoanId = null;
    let extractedBorrower = null;
    let extractedLender = null;
    let extractedPrincipal = null;
    let extractedTotalDue = null;
    let extractedRepType = null;

    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = loanManager.interface.parseLog(log);
          if (parsed && parsed.name === 'LoanRepaid') {
            extractedLoanId = Number(parsed.args.loanId);
            extractedBorrower = parsed.args.borrower;
            extractedLender = parsed.args.lender;
            extractedPrincipal = parsed.args.principal;
            extractedTotalDue = parsed.args.totalDue;
            extractedRepType = Number(parsed.args.repaymentType);
            break;
          }
        } catch {
          // Skip non-matching event
        }
      }
    }

    let updatedLoan = null;
    let scoreAfter = scoreBefore;
    let limitAfter = limitBefore;
    let outstandingAfter = outstandingBefore;
    let borrowerBalanceAfter = 0n;

    try {
      updatedLoan = await fetchLoanDetails(loanId, signer);
      scoreAfter = await creditRegistry.getCreditScore(account);
      limitAfter = await creditRegistry.getBorrowingLimit(account);
      outstandingAfter = await loanManager.getOutstandingPrincipal(account);
      borrowerBalanceAfter = await mockUSDC.balanceOf(account);
    } catch (e) {
      console.warn('[useLoan] Failed to fetch updated repaid loan details:', e);
    }

    const repaidInfo = {
      loanId: extractedLoanId || Number(loanId),
      txHash: receipt ? receipt.hash : null,
      borrower: extractedBorrower || onchainLoan.borrower,
      lender: extractedLender || onchainLoan.lender,
      principal: extractedPrincipal || onchainLoan.principal,
      totalDue: extractedTotalDue || onchainLoan.totalDue,
      interest: (extractedTotalDue || onchainLoan.totalDue) - (extractedPrincipal || onchainLoan.principal),
      repType: extractedRepType,
      scoreBefore: Number(scoreBefore),
      scoreAfter: Number(scoreAfter),
      limitBefore,
      limitAfter,
      outstandingBefore,
      outstandingAfter,
      borrowerBalanceAfter,
      loan: updatedLoan,
    };

    setRepaidLoan(repaidInfo);
    return { receipt, repaidLoan: repaidInfo };
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
    repaidLoan,
    reset: resetAll,
    requestLoan,
    approveLendingPool,
    fundLoan,
    repayLoan,
    claimFaucet,
  };
}
