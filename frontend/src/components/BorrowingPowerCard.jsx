import React from 'react';
import { Wallet, ArrowRight, Lock, TrendingDown, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatUSDC } from '../utils/formatters';

export default function BorrowingPowerCard({
  limit,
  availableBorrowingPower,
  outstandingPrincipal,
  loading = false,
  initialLoading,
  hasLoaded,
}) {
  const hasValidLimit = limit !== undefined && limit !== null;
  const hasValidAvailable = availableBorrowingPower !== undefined && availableBorrowingPower !== null;
  const hasValidData = hasValidLimit || hasValidAvailable;

  // CRITICAL UX RULE:
  // If previous value exists (hasValidData is true):
  // NEVER render "---" just because loading=true.
  // Only show the initial loading UI when there is no previously loaded value.
  const showPlaceholder = !hasValidData;

  const available = hasValidAvailable ? availableBorrowingPower : (hasValidLimit ? limit : 0n);
  const resolvedLimit = hasValidLimit ? limit : 0n;
  const resolvedOutstanding = (outstandingPrincipal !== undefined && outstandingPrincipal !== null) ? outstandingPrincipal : 0n;

  // Calculate percentage of borrowing power used
  const limitNum = Number(resolvedLimit) / 1e6;
  const outstandingNum = Number(resolvedOutstanding) / 1e6;
  const usedPercent = limitNum > 0 ? Math.min(Math.round((outstandingNum / limitNum) * 100), 100) : 0;

  return (
    <div className="p-6 rounded-2xl glass-panel relative overflow-hidden flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Available Borrowing Power</h3>
              <p className="text-xs text-slate-400">Unsecured onchain credit line</p>
            </div>
          </div>
          <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-medium">
            <Lock size={12} />
            <span>0% Collateral</span>
          </span>
        </div>

        {/* Hero Value: Available Borrowing Power */}
        <div className="flex items-baseline space-x-2 my-2">
          <span className="text-4xl font-extrabold tracking-tight text-white font-mono">
            ${showPlaceholder ? '---' : formatUSDC(available)}
          </span>
          <span className="text-xs text-cyan-400 font-semibold uppercase font-mono">mUSDC</span>
        </div>

        {/* Capacity Breakdown Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-2 my-3 overflow-hidden border border-slate-700/50">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
            style={{ width: `${Math.max(100 - usedPercent, 0)}%` }}
          />
        </div>

        {/* Key Metrics Breakdown */}
        <div className="grid grid-cols-2 gap-2 my-3 text-xs bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/60 font-mono">
          <div>
            <span className="text-slate-400 block text-[11px]">Total Credit Limit</span>
            <span className="font-semibold text-slate-200">
              ${showPlaceholder ? '---' : formatUSDC(resolvedLimit)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block text-[11px]">Current Exposure</span>
            <span className="font-semibold text-rose-400">
              ${showPlaceholder ? '---' : formatUSDC(resolvedOutstanding)}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Enforced strictly onchain by <span className="text-slate-300 font-mono">CreditRegistry</span> and{' '}
          <span className="text-slate-300 font-mono">LoanManager</span> on Ethereum Sepolia.
        </p>
      </div>

      <Link
        to="/borrow"
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/15"
      >
        <span>Request Credit-Based Loan</span>
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
