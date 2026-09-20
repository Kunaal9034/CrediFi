import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useCredit } from '../hooks/useCredit';
import { useLoan } from '../hooks/useLoan';
import { parseUSDC, formatUSDC } from '../utils/formatters';
import TransactionProgress from '../components/TransactionProgress';
import { ShieldCheck, Info, ArrowRight, AlertCircle, DollarSign, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Borrow() {
  const navigate = useNavigate();
  const { account, isConnecting, connectWallet } = useWallet();
  const { score, limit, tier, loading: creditLoading } = useCredit();
  const { requestLoan, status, txHash, error, reset, isPending, isSuccess } = useLoan();

  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [interestRateBps, setInterestRateBps] = useState(1000); // 10%

  const amountRaw = parseUSDC(amount);
  const isOverLimit = limit > 0n && amountRaw > limit;

  // Calculate estimated repayment: Principal + (Principal * APR * Days) / (365 * 10000)
  const durationSeconds = durationDays * 24 * 3600;
  const estimatedInterestRaw = (amountRaw * BigInt(interestRateBps) * BigInt(durationSeconds)) / (365n * 24n * 3600n * 10000n);
  const estimatedTotalDueRaw = amountRaw + estimatedInterestRaw;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (amountRaw <= 0n) return;
    if (isOverLimit) return;

    try {
      await requestLoan(amountRaw, durationSeconds, interestRateBps);
    } catch (err) {
      console.error('Failed to submit loan request:', err);
    }
  };

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-3xl glass-panel border border-slate-800">
          <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet to Borrow</h2>
          <p className="text-xs text-slate-400 mb-6">
            Undercollateralized loans require an onchain profile query on Ethereum Sepolia.
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
      <div className="mb-8">
        <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
          Undercollateralized Borrowing
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
          Request a Loan
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Borrow test stablecoins onchain without locking up 150%+ collateral.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-5">
            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Loan Amount (MockUSDC)
                </label>
                <span className="text-[11px] text-slate-400">
                  Limit: <strong className="text-cyan-400">${formatUSDC(limit)}</strong>
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
                  placeholder="e.g. 250"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full pl-9 pr-20 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setAmount(formatUSDC(limit).replace(/,/g, ''))}
                  className="absolute inset-y-1.5 right-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[11px] font-semibold transition-colors"
                >
                  MAX
                </button>
              </div>

              {isOverLimit && (
                <p className="mt-1.5 text-xs text-rose-400 flex items-center space-x-1">
                  <AlertCircle size={13} />
                  <span>Amount exceeds your current onchain borrowing limit (${formatUSDC(limit)})</span>
                </p>
              )}
            </div>

            {/* Duration Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Loan Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[7, 14, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
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
            </div>

            {/* Interest Rate Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Proposed Interest Rate (APR)
                </label>
                <span className="text-[11px] text-cyan-400 font-mono font-semibold">
                  {(interestRateBps / 100).toFixed(1)}% APR
                </span>
              </div>
              <input
                type="range"
                min="500"
                max="2500"
                step="50"
                value={interestRateBps}
                onChange={(e) => setInterestRateBps(Number(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>5% (Prime)</span>
                <span>10% (Recommended)</span>
                <span>25% (High Yield)</span>
              </div>
            </div>

            {/* Calculation Summary Box */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Requested Principal:</span>
                <span className="font-mono text-white">${formatUSDC(amountRaw)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Interest:</span>
                <span className="font-mono text-cyan-400">${formatUSDC(estimatedInterestRaw)}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800 font-semibold">
                <span>Total Repayment Due:</span>
                <span className="font-mono text-white text-sm">${formatUSDC(estimatedTotalDueRaw)}</span>
              </div>
            </div>

            {/* Mandatory 5-Step Transaction Lifecycle Display */}
            <TransactionProgress
              status={status}
              txHash={txHash}
              error={error}
              onReset={reset}
            />

            {/* Submit Button */}
            {isSuccess ? (
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                >
                  Create Another Loan
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/loans')}
                  className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-colors"
                >
                  View in My Loans →
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isPending || isOverLimit || amountRaw <= 0n}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/15"
              >
                {isPending ? 'Processing Onchain...' : 'Request Loan (Sign MetaMask)'}
              </button>
            )}
          </form>
        </div>

        {/* Info Column */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl glass-panel border border-slate-800">
            <div className="flex items-center space-x-2 text-cyan-400 mb-3">
              <ShieldCheck size={18} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Credit Rating
              </h3>
            </div>
            <div className="text-3xl font-black text-white font-mono mb-1">
              {creditLoading ? '---' : score}
            </div>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${tier.badge} mb-3`}>
              {tier.name}
            </span>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your borrowing limit scales dynamically with every on-time repayment recorded onchain.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold mb-1">
              <Info size={14} className="text-blue-400" />
              <span>Smart Contract Enforced</span>
            </div>
            <p>
              Your requested loan amount is checked onchain by <code className="text-cyan-300 font-mono text-[11px]">LoanManager.sol</code>. Requests exceeding your limit revert automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
