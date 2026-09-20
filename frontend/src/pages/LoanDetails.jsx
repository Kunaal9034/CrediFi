import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useLoan } from '../hooks/useLoan';
import { useCredit } from '../hooks/useCredit';
import {
  getContract,
  fetchLoanDetails as fetchOnchainLoan,
  checkAllowance,
} from '../services/blockchain';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import { api } from '../services/api';
import {
  formatAddress,
  formatUSDC,
  formatAPR,
  formatDurationDays,
  formatTimestamp,
} from '../utils/formatters';
import LoanStatus from '../components/LoanStatus';
import TransactionProgress from '../components/TransactionProgress';
import ExplorerLink from '../components/ExplorerLink';
import {
  ArrowLeft,
  User,
  DollarSign,
  Calendar,
  Percent,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function LoanDetails() {
  const { id } = useParams();
  const { account, provider, isCorrectNetwork, tokenBalance } = useWallet();
  const {
    fundLoan,
    repayLoan,
    approveLendingPool,
    repaidLoan,
    status,
    txHash,
    error,
    reset,
    isPending,
  } = useLoan();
  const { refresh: refreshCredit } = useCredit();

  const [loan, setLoan] = useState(null);
  const [totalDue, setTotalDue] = useState(0n);
  const [allowance, setAllowance] = useState(0n);
  const [isApproving, setIsApproving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      // 1. Direct onchain query via LoanManager
      const onchainLoan = await fetchOnchainLoan(id, provider);
      if (onchainLoan) {
        setLoan(onchainLoan);
        setTotalDue(onchainLoan.totalDue);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Onchain loan fetch failed, checking backend:', err.message);
    }

    try {
      const res = await api.getLoanById(id);
      if (res && res.loan) {
        setLoan(res.loan);
        setTotalDue(res.loan.totalDue ? BigInt(res.loan.totalDue) : 0n);
      }
    } catch (apiErr) {
      console.error('Failed to load loan details from both sources:', apiErr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id, provider]);

  useEffect(() => {
    if (account && provider) {
      checkAllowance('mockUSDC', account, CONTRACT_ADDRESSES.lendingPool, provider)
        .then(setAllowance)
        .catch(() => setAllowance(0n));
    }
  }, [account, provider, status]);

  const handleApprove = async () => {
    if (!loan) return;
    setIsApproving(true);
    try {
      const requiredAmount = totalDue > 0n ? totalDue : loan.principal;
      await approveLendingPool(requiredAmount);
      const updatedAllowance = await checkAllowance(
        'mockUSDC',
        account,
        CONTRACT_ADDRESSES.lendingPool,
        provider
      );
      setAllowance(updatedAllowance);
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRepay = async () => {
    if (!loan) return;
    try {
      await repayLoan(loan.loanId, async () => {
        await refreshCredit();
        await fetchDetails();
      });
    } catch (err) {
      console.error('Repayment failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-xs">
        Loading onchain loan #{id} details...
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Loan #{id} Not Found</h2>
        <p className="text-xs text-slate-400 mb-4">This loan ID may not have been created yet onchain.</p>
        <Link to="/loans" className="text-cyan-400 text-xs hover:underline">
          ← Back to My Loans
        </Link>
      </div>
    );
  }

  const isBorrower = account && loan.borrower.toLowerCase() === account.toLowerCase();
  const isLender = account && loan.lender && loan.lender.toLowerCase() === account.toLowerCase();
  const requiredAmount = totalDue > 0n ? totalDue : loan.principal;
  const needsApproval = allowance < requiredAmount;
  const hasInsufficientBalance = tokenBalance < requiredAmount;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link
        to="/loans"
        className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Loans</span>
      </Link>

      <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-800 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              Onchain Loan State
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-0.5">
              Loan #{loan.loanId.toString()}
            </h1>
          </div>
          <LoanStatus status={loan.status} />
        </div>

        {/* Transaction Progress Tracker */}
        <TransactionProgress
          status={status}
          txHash={txHash}
          error={error}
          onReset={() => {
            reset();
            fetchDetails();
            refreshCredit();
          }}
        />

        {/* Repayment Success Celebration Receipt */}
        {repaidLoan && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-cyan-950/40 border border-emerald-800/60 space-y-3 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 size={20} />
              <h3 className="font-bold text-white text-base">Loan Settle Confirmed!</h3>
            </div>
            <p className="text-xs text-emerald-300">
              Debt successfully settled on Ethereum Sepolia. Your onchain credit profile has been updated:
            </p>

            <div className="flex items-baseline space-x-3 pt-2">
              <span className="text-xl font-extrabold font-mono text-slate-400 line-through">
                {repaidLoan.scoreBefore}
              </span>
              <ArrowRight size={16} className="text-cyan-400" />
              <span className="text-2xl font-extrabold font-mono text-cyan-300">
                {repaidLoan.scoreAfter}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                +{repaidLoan.scoreAfter - repaidLoan.scoreBefore} Points
              </span>
            </div>

            <div className="pt-2 border-t border-emerald-800/40 text-xs flex justify-between">
              <span className="text-slate-300">New Borrowing Limit:</span>
              <span className="font-mono text-white font-bold">
                ${formatUSDC(repaidLoan.limitAfter)} USDC
              </span>
            </div>
          </div>
        )}

        {/* Principal & Total Due Highlight */}
        <div className="grid sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Principal Amount</span>
            <span className="text-2xl font-bold font-mono text-white">
              ${formatUSDC(loan.principal)} <span className="text-xs text-slate-400 font-normal">mUSDC</span>
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">Total Due (Principal + Yield)</span>
            <span className="text-2xl font-bold font-mono text-cyan-400">
              ${formatUSDC(totalDue > 0n ? totalDue : loan.principal)} <span className="text-xs text-slate-400 font-normal">mUSDC</span>
            </span>
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-500 block mb-1">Annual Interest Rate</span>
            <span className="text-slate-200 font-semibold text-sm">
              {formatAPR(loan.interestRateBps || loan.interestRate)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-500 block mb-1">Duration</span>
            <span className="text-slate-200 font-semibold text-sm">{formatDurationDays(loan.duration)}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-500 block mb-1">Creation Date</span>
            <span className="text-slate-200 font-medium">
              {loan.createdAt > 0 ? formatTimestamp(loan.createdAt) : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-500 block mb-1">Due Date</span>
            <span className="text-slate-200 font-medium">
              {loan.dueDate > 0 ? formatTimestamp(loan.dueDate) : 'Pending funding'}
            </span>
          </div>
        </div>

        {/* Participants */}
        <div className="pt-2 border-t border-slate-800/80 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Borrower:</span>
            <ExplorerLink hash={loan.borrower} type="address" label={formatAddress(loan.borrower)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Lender:</span>
            {loan.lender && loan.lender !== '0x0000000000000000000000000000000000000000' ? (
              <ExplorerLink hash={loan.lender} type="address" label={formatAddress(loan.lender)} />
            ) : (
              <span className="text-slate-500 italic">Open for funding</span>
            )}
          </div>
        </div>

        {/* Action Button: Lending or Repaying */}
        {Number(loan.status) === 0 && !isBorrower && (
          <button
            onClick={() => fundLoan(loan.loanId)}
            disabled={isPending || !isCorrectNetwork}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
          >
            Fund Loan (Deposit ${formatUSDC(loan.principal)} mUSDC)
          </button>
        )}

        {Number(loan.status) === 1 && isBorrower && !repaidLoan && (
          <div className="space-y-2 pt-2">
            {needsApproval ? (
              <button
                type="button"
                onClick={handleApprove}
                disabled={isPending || isApproving || hasInsufficientBalance || !isCorrectNetwork}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {isApproving
                  ? 'Approving mUSDC onchain...'
                  : `1. Approve MockUSDC ($${formatUSDC(requiredAmount)} mUSDC)`}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRepay}
                disabled={isPending || hasInsufficientBalance || !isCorrectNetwork}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-500/15 disabled:opacity-50"
              >
                {isPending
                  ? 'Settling Loan on Sepolia...'
                  : `2. Repay Total Due ($${formatUSDC(requiredAmount)} mUSDC)`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
