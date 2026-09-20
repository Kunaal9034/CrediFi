import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useLoan } from '../hooks/useLoan';
import { useCredit } from '../hooks/useCredit';
import { api } from '../services/api';
import { fetchUserLoansOnchain, checkAllowance } from '../services/blockchain';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import LoanTable from '../components/LoanTable';
import TransactionProgress from '../components/TransactionProgress';
import ExplorerLink from '../components/ExplorerLink';
import {
  formatAddress,
  formatUSDC,
  formatAPR,
  formatDurationDays,
  formatTimestamp,
} from '../utils/formatters';
import {
  RefreshCw,
  Filter,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Sparkles,
  X,
  ArrowRight,
  Wallet,
  Coins,
} from 'lucide-react';

export default function MyLoans() {
  const { account, provider, isCorrectNetwork, tokenBalance, refreshBalances } = useWallet();
  const {
    repayLoan,
    approveLendingPool,
    claimFaucet,
    status,
    txHash,
    error,
    reset,
    isPending,
    repaidLoan,
  } = useLoan();
  const {
    score,
    limit,
    availableBorrowingPower,
    outstandingPrincipal,
    refresh: refreshCredit,
  } = useCredit();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all | active | requested | completed

  // Repayment Modal state
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [allowance, setAllowance] = useState(0n);
  const [isApproving, setIsApproving] = useState(false);
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);

  const fetchMyLoans = async () => {
    if (!account) return;
    setLoading(true);

    try {
      // 1. Direct onchain scan from LoanManager on Sepolia
      const onchainLoans = await fetchUserLoansOnchain(account, provider);
      if (onchainLoans && onchainLoans.length > 0) {
        setLoans(onchainLoans);
        setLoading(false);
        return;
      }
    } catch (onchainErr) {
      console.warn('Onchain direct scan error, checking fallback:', onchainErr.message);
    }

    // 2. Fallback to backend API if available
    try {
      const res = await api.getUserLoans(account);
      if (res && res.loans) {
        setLoans(res.loans);
      } else {
        setLoans([]);
      }
    } catch (err) {
      console.warn('Backend query skipped:', err.message);
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLoans();
  }, [account, provider]);

  // Refresh allowance when selected loan changes
  useEffect(() => {
    if (selectedLoan && account && provider) {
      checkAllowance('mockUSDC', account, CONTRACT_ADDRESSES.lendingPool, provider)
        .then((val) => setAllowance(val))
        .catch(() => setAllowance(0n));
    }
  }, [selectedLoan, account, provider]);

  const handleOpenRepayModal = async (loanId, loan) => {
    reset();
    setSelectedLoan(loan);
    try {
      const curAllowance = await checkAllowance(
        'mockUSDC',
        account,
        CONTRACT_ADDRESSES.lendingPool,
        provider
      );
      setAllowance(curAllowance);
    } catch {
      setAllowance(0n);
    }
  };

  const handleCloseModal = () => {
    if (isPending) return;
    setSelectedLoan(null);
    reset();
    fetchMyLoans();
    refreshCredit();
  };

  const handleApprove = async () => {
    if (!selectedLoan) return;
    setIsApproving(true);
    try {
      const requiredAmount = selectedLoan.totalDue || selectedLoan.principal;
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
    if (!selectedLoan) return;
    try {
      await repayLoan(selectedLoan.loanId, async () => {
        await refreshCredit();
        await fetchMyLoans();
      });
    } catch (err) {
      console.error('Repayment failed:', err);
    }
  };

  const handleClaimFaucet = async () => {
    setIsClaimingFaucet(true);
    try {
      await claimFaucet();
      await refreshBalances();
    } catch (err) {
      console.error('Faucet claim failed:', err);
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  // Filter loans
  const filteredLoans = loans.filter((l) => {
    if (activeTab === 'requested') return Number(l.status) === 0;
    if (activeTab === 'active') return Number(l.status) === 1;
    if (activeTab === 'completed') return Number(l.status) === 2 || Number(l.status) === 3;
    return true;
  });

  const totalDueAmount = selectedLoan
    ? selectedLoan.totalDue || selectedLoan.principal
    : 0n;
  const principalAmount = selectedLoan ? selectedLoan.principal : 0n;
  const interestAmount =
    totalDueAmount > principalAmount ? totalDueAmount - principalAmount : 0n;
  const hasInsufficientBalance = tokenBalance < totalDueAmount;
  const needsApproval = allowance < totalDueAmount;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Top Portfolio Summary */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Borrower Portfolio
              </span>
              {isCorrectNetwork && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Sepolia Connected
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1.5">
              My Borrowings & Repayments
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Track active borrowings, view repayment schedules, and settle debts to boost your credit score.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Credit Score</span>
              <span className="text-base font-bold font-mono text-cyan-400">{score}</span>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Outstanding Debt</span>
              <span className="text-base font-bold font-mono text-white">
                ${formatUSDC(outstandingPrincipal)} USDC
              </span>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">mUSDC Balance</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                ${formatUSDC(tokenBalance)}
              </span>
            </div>

            <button
              onClick={handleClaimFaucet}
              disabled={isClaimingFaucet || isPending}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              title="Claim 1,000 test mUSDC from public faucet"
            >
              <Coins size={13} className="text-cyan-400" />
              <span>+1,000 mUSDC Faucet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 sm:pb-0 sm:border-0">
          {[
            { key: 'all', label: 'All Loans' },
            { key: 'active', label: 'Active (To Repay)' },
            { key: 'requested', label: 'Requested' },
            { key: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchMyLoans}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 flex items-center space-x-2 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Loans</span>
        </button>
      </div>

      {/* Loans Table */}
      <LoanTable
        loans={filteredLoans}
        currentAccount={account}
        onRepay={handleOpenRepayModal}
        isProcessing={isPending}
        emptyMessage="No loans match the selected filter."
      />

      {/* Interactive Repayment Modal */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-3xl glass-panel border border-slate-700 shadow-2xl space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                  Loan Settle Settlement
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight mt-0.5">
                  Repay Loan #{selectedLoan.loanId.toString()}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isPending}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* If Loan Was Just Repaid Successfully: Show Celebration Receipt */}
            {repaidLoan ? (
              <div className="space-y-5 animate-in zoom-in-95 duration-200">
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-lg font-bold text-white">Loan Repaid Successfully!</h4>
                  <p className="text-xs text-emerald-300">
                    Your debt has been fully settled on Ethereum Sepolia.
                  </p>
                </div>

                {/* Credit Score Boost Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border border-cyan-800/50 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyan-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                      <Sparkles size={14} />
                      <span>Credit Score Updated</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      +{repaidLoan.scoreAfter - repaidLoan.scoreBefore} Points
                    </span>
                  </div>

                  <div className="flex items-baseline space-x-3">
                    <span className="text-2xl font-extrabold font-mono text-slate-400 line-through">
                      {repaidLoan.scoreBefore}
                    </span>
                    <ArrowRight size={16} className="text-cyan-400" />
                    <span className="text-3xl font-extrabold font-mono text-cyan-300">
                      {repaidLoan.scoreAfter}
                    </span>
                    <span className="text-xs text-slate-300">/ 850 Max</span>
                  </div>

                  <div className="pt-2 border-t border-cyan-800/40 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">New Borrowing Limit:</span>
                      <span className="font-mono text-white font-semibold">
                        ${formatUSDC(repaidLoan.limitAfter)} USDC
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Outstanding Debt:</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        ${formatUSDC(repaidLoan.outstandingAfter)} USDC
                      </span>
                    </div>
                  </div>
                </div>

                {/* Settle Summary */}
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Principal Settled:</span>
                    <span className="font-mono text-slate-200">
                      ${formatUSDC(repaidLoan.principal)} mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Interest Paid:</span>
                    <span className="font-mono text-slate-200">
                      ${formatUSDC(repaidLoan.interest)} mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Total Paid to Lender:</span>
                    <span className="font-mono text-white font-bold">
                      ${formatUSDC(repaidLoan.totalDue)} mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Lender Address:</span>
                    <span className="font-mono text-slate-300">
                      {formatAddress(repaidLoan.lender)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                    <span>Transaction Hash:</span>
                    {repaidLoan.txHash && (
                      <ExplorerLink hash={repaidLoan.txHash} type="tx" />
                    )}
                  </div>
                </div>

                {/* Done Button */}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Repayment Breakdown */}
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs space-y-2.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Principal Owed:</span>
                    <span className="font-mono text-white font-semibold">
                      ${formatUSDC(principalAmount)} mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Accumulated Interest:</span>
                    <span className="font-mono text-cyan-400 font-semibold">
                      ${formatUSDC(interestAmount)} mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Lender (Recipient):</span>
                    <span className="font-mono text-slate-200 font-semibold">
                      {formatAddress(selectedLoan.lender)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Due Date:</span>
                    <span className="font-mono text-slate-200">
                      {selectedLoan.dueDate ? formatTimestamp(selectedLoan.dueDate) : 'N/A'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-slate-200 font-bold text-sm">
                    <span>Total Due to Settle:</span>
                    <span className="font-mono text-emerald-400">
                      ${formatUSDC(totalDueAmount)} mUSDC
                    </span>
                  </div>
                </div>

                {/* Borrower Balance Check */}
                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <Wallet size={15} className="text-cyan-400" />
                    <span>Your mUSDC Balance:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-mono font-bold ${
                        hasInsufficientBalance ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      ${formatUSDC(tokenBalance)} mUSDC
                    </span>
                    {hasInsufficientBalance && (
                      <button
                        onClick={handleClaimFaucet}
                        disabled={isClaimingFaucet || isPending}
                        className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 text-[10px] font-semibold border border-blue-500/30"
                      >
                        Claim Faucet
                      </button>
                    )}
                  </div>
                </div>

                {/* Insufficient Balance Alert */}
                {hasInsufficientBalance && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start space-x-2">
                    <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Insufficient MockUSDC Balance</span>
                      <p className="text-[11px] text-rose-400/90 mt-0.5">
                        You need ${formatUSDC(totalDueAmount)} to settle this loan. Use the faucet button to claim demo tokens.
                      </p>
                    </div>
                  </div>
                )}

                {/* Transaction Progress Tracker */}
                <TransactionProgress
                  status={status}
                  txHash={txHash}
                  error={error}
                  onReset={reset}
                />

                {/* Action Buttons: 2-Step Allowance -> Repay */}
                <div className="space-y-2 pt-2">
                  {needsApproval ? (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isPending || isApproving || hasInsufficientBalance || !isCorrectNetwork}
                      className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
                    >
                      {isApproving || (isPending && status !== 'confirmed')
                        ? 'Approving mUSDC onchain...'
                        : '1. Approve MockUSDC Spending'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRepay}
                      disabled={isPending || hasInsufficientBalance || !isCorrectNetwork}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white font-semibold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/15"
                    >
                      {isPending
                        ? 'Settling Loan on Sepolia...'
                        : '2. Confirm & Repay Loan'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isPending}
                    className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
