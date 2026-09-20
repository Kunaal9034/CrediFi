import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useCredit } from '../hooks/useCredit';
import { useLoan } from '../hooks/useLoan';
import { parseUSDC, formatUSDC, formatAddress } from '../utils/formatters';
import TransactionProgress from '../components/TransactionProgress';
import ExplorerLink from '../components/ExplorerLink';
import {
  ShieldCheck,
  Info,
  ArrowRight,
  AlertCircle,
  DollarSign,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Clock,
  Sparkles,
  Percent,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export default function Borrow() {
  const navigate = useNavigate();
  const { account, isConnecting, connectWallet, isCorrectNetwork } = useWallet();
  const {
    score,
    limit,
    availableBorrowingPower,
    outstandingPrincipal,
    tier,
    loading: creditLoading,
    refresh: refreshCredit,
  } = useCredit();

  const {
    requestLoan,
    createdLoan,
    status,
    txHash,
    error,
    reset,
    isPending,
    isSuccess,
  } = useLoan();

  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState(14);
  const [interestRateBps, setInterestRateBps] = useState(1000); // 10.00% APR

  // Safe 6-decimal integer representation
  const amountRaw = parseUSDC(amount);

  // Validation flags against onchain power
  const isOverPower = amountRaw > 0n && amountRaw > availableBorrowingPower;
  const isZeroOrNegative = amountRaw <= 0n;
  const isExceedingTotalLimit = amountRaw > limit;

  // Exact protocol integer arithmetic matching LoanManager.sol:
  // interest = (principal * interestRateBps * duration) / (365 days * 10000)
  // totalDue = principal + interest
  const durationSeconds = BigInt(Math.max(1, Math.min(365, durationDays))) * 86400n;
  const interestRaw =
    amountRaw > 0n
      ? (amountRaw * BigInt(interestRateBps) * durationSeconds) / (365n * 86400n * 10000n)
      : 0n;
  const totalDueRaw = amountRaw + interestRaw;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isZeroOrNegative) return;
    if (isOverPower) return;

    try {
      await requestLoan(
        amountRaw,
        interestRateBps,
        Number(durationSeconds),
        refreshCredit
      );
    } catch (err) {
      console.error('[Borrow] Loan creation failed:', err);
    }
  };

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-3xl glass-panel border border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4">
            <DollarSign size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet to Borrow</h2>
          <p className="text-xs text-slate-400 mb-6 max-w-md mx-auto">
            CrediFi provides unsecured loans powered by onchain credit reputation on Ethereum Sepolia. Connect MetaMask to view your available borrowing power.
          </p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20"
          >
            Connect MetaMask
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header Banner */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-cyan-400 mb-1">
          <Sparkles size={14} />
          <span>Undercollateralized Lending Protocol</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Request an Unsecured Loan
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Borrow test stablecoins on Ethereum Sepolia directly against your decentralized credit score.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Main Form Column */}
        <div className="md:col-span-2">
          {/* If successfully created, display detailed onchain receipt card */}
          {isSuccess && createdLoan ? (
            <div className="p-6 rounded-2xl glass-panel border border-emerald-500/40 bg-emerald-950/10 space-y-5">
              <div className="flex items-center space-x-3 text-emerald-400 pb-3 border-b border-slate-800">
                <CheckCircle2 size={24} className="shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Loan Request Created Onchain!
                  </h3>
                  <p className="text-[11px] text-emerald-400/90">
                    Your loan is now in <strong className="font-mono">REQUESTED</strong> state and ready for lender funding.
                  </p>
                </div>
              </div>

              {/* Loan Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block font-semibold">
                    Assigned Loan ID
                  </span>
                  <span className="text-lg font-mono font-bold text-cyan-400">
                    #{createdLoan.loanId ?? '---'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block font-semibold">
                    Requested Principal
                  </span>
                  <span className="text-lg font-mono font-bold text-white">
                    ${formatUSDC(createdLoan.principal)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block font-semibold">
                    Interest Rate (APR)
                  </span>
                  <span className="text-sm font-mono font-semibold text-slate-200">
                    {(createdLoan.interestRateBps / 100).toFixed(2)}% ({createdLoan.interestRateBps} bps)
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block font-semibold">
                    Duration
                  </span>
                  <span className="text-sm font-mono font-semibold text-slate-200">
                    {Math.round(createdLoan.duration / 86400)} Days
                  </span>
                </div>
              </div>

              {/* Transaction Hash & Explorer Link */}
              {txHash && (
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Sepolia Transaction:</span>
                  <ExplorerLink hash={txHash} type="tx" />
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setAmount('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                >
                  Create Another Request
                </button>
                <Link
                  to="/loans"
                  className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs text-center transition-colors flex items-center justify-center space-x-1"
                >
                  <span>View in My Loans</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-5">
              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Loan Principal (MockUSDC)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Available: <strong className="text-cyan-400 font-mono">${formatUSDC(availableBorrowingPower)}</strong>
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <DollarSign size={16} />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 100.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    disabled={isPending}
                    className="w-full pl-9 pr-20 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-400 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(formatUSDC(availableBorrowingPower).replace(/,/g, ''))}
                    disabled={isPending || availableBorrowingPower <= 0n}
                    className="absolute inset-y-1.5 right-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[11px] font-semibold transition-colors disabled:opacity-40"
                  >
                    MAX
                  </button>
                </div>

                {isOverPower && (
                  <div className="mt-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start space-x-2">
                    <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Exceeds Available Borrowing Power</span>
                      <p className="text-[11px] text-rose-400/90 mt-0.5">
                        Your onchain available limit is ${formatUSDC(availableBorrowingPower)}. Outstanding loans reserve your limit until repaid or cancelled.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Duration Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Loan Duration
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {durationDays} Day{durationDays === 1 ? '' : 's'} ({Math.round(Number(durationSeconds) / 86400)} days onchain)
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[7, 14, 30, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      disabled={isPending}
                      onClick={() => setDurationDays(days)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        durationDays === days
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                          : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-[11px] text-slate-500">Custom (1-365 days):</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                    disabled={isPending}
                    className="w-20 px-2 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-[11px] text-slate-400">days</span>
                </div>
              </div>

              {/* Interest Rate Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Proposed Interest Rate (Annual APR)
                  </label>
                  <span className="text-[11px] text-cyan-400 font-mono font-semibold">
                    {(interestRateBps / 100).toFixed(2)}% APR ({interestRateBps} bps)
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="2000"
                  step="25"
                  value={interestRateBps}
                  onChange={(e) => setInterestRateBps(Number(e.target.value))}
                  disabled={isPending}
                  className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-2 disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>0.50% (Prime)</span>
                  <span>10.00% (Market)</span>
                  <span>20.00% (Protocol Max)</span>
                </div>
              </div>

              {/* Onchain Calculation Summary Box */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Requested Principal:</span>
                  <span className="font-mono text-white">${formatUSDC(amountRaw)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Calculated Simple Interest:</span>
                  <span className="font-mono text-cyan-400">${formatUSDC(interestRaw)}</span>
                </div>
                <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800 font-semibold">
                  <span>Total Repayment Due at Maturity:</span>
                  <span className="font-mono text-white text-sm">${formatUSDC(totalDueRaw)}</span>
                </div>
              </div>

              {/* Transaction Progress Tracker */}
              <TransactionProgress
                status={status}
                txHash={txHash}
                error={error}
                onReset={reset}
              />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending || isOverPower || isZeroOrNegative || !isCorrectNetwork}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/15"
              >
                {isPending
                  ? 'Submitting to Sepolia...'
                  : !isCorrectNetwork
                  ? 'Switch to Sepolia to Borrow'
                  : isOverPower
                  ? 'Amount Exceeds Borrowing Power'
                  : 'Submit Loan Request (MetaMask)'}
              </button>
            </form>
          )}
        </div>

        {/* Sidebar Info Column */}
        <div className="space-y-4">
          {/* Credit Rating Card */}
          <div className="p-5 rounded-2xl glass-panel border border-slate-800">
            <div className="flex items-center space-x-2 text-cyan-400 mb-3">
              <ShieldCheck size={18} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Borrower Profile
              </h3>
            </div>
            <div className="text-3xl font-black text-white font-mono mb-1">
              {creditLoading ? '---' : score}
            </div>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${tier.badge} mb-4`}>
              {tier.name}
            </span>

            <div className="space-y-2.5 pt-3 border-t border-slate-800 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Credit Limit:</span>
                <span className="font-mono text-slate-200">${formatUSDC(limit)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Outstanding Exposure:</span>
                <span className="font-mono text-amber-400">${formatUSDC(outstandingPrincipal)}</span>
              </div>
              <div className="flex justify-between text-slate-300 font-semibold pt-1 border-t border-slate-800/60">
                <span>Available Power:</span>
                <span className="font-mono text-cyan-400">${formatUSDC(availableBorrowingPower)}</span>
              </div>
            </div>
          </div>

          {/* Smart Contract Enforced Details */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold mb-1">
              <Info size={14} className="text-blue-400" />
              <span>Smart Contract Enforced</span>
            </div>
            <p className="leading-relaxed">
              Loans are created directly in <code className="text-cyan-300 font-mono text-[11px]">LoanManager.sol</code> on Sepolia.
            </p>
            <p className="leading-relaxed text-[11px] text-slate-500">
              No collateral is transferred during request creation. Tokens move only when a lender subsequently funds the request.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
