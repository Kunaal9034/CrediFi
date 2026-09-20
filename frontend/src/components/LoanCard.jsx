import React from 'react';
import { formatAddress, formatUSDC, formatAPR, formatDurationDays, formatTimestamp } from '../utils/formatters';
import LoanStatus from './LoanStatus';
import { Clock, Percent, DollarSign, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LoanCard({
  loan,
  currentAccount,
  onFund,
  onRepay,
  isProcessing = false,
}) {
  if (!loan) return null;

  const isBorrower = currentAccount && loan.borrower.toLowerCase() === currentAccount.toLowerCase();
  const isLender = currentAccount && loan.lender && loan.lender.toLowerCase() === currentAccount.toLowerCase();

  return (
    <div className="p-5 rounded-2xl glass-panel border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-bold text-cyan-400">
            Loan #{loan.loanId.toString()}
          </span>
          <LoanStatus status={Number(loan.status)} />
        </div>

        <div className="my-3">
          <span className="text-xs text-slate-400 block mb-1">Principal Requested</span>
          <div className="text-2xl font-bold font-mono text-white">
            ${formatUSDC(loan.principal)} <span className="text-xs text-slate-400 font-normal">mUSDC</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 my-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Percent size={13} className="text-cyan-400" />
            <span>APR: <strong className="text-slate-200">{formatAPR(loan.interestRateBps || loan.interestRate)}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Clock size={13} className="text-blue-400" />
            <span>Term: <strong className="text-slate-200">{formatDurationDays(loan.duration)}</strong></span>
          </div>
          {loan.totalDue && (
            <div className="col-span-2 flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/60">
              <span>Total Return:</span>
              <span className="font-mono text-emerald-400 font-semibold">${formatUSDC(loan.totalDue)} mUSDC</span>
            </div>
          )}
          <div className="col-span-2 flex items-center space-x-1.5 text-slate-400 truncate pt-1 border-t border-slate-800/60">
            <User size={13} className="text-slate-500" />
            <span>Borrower: <strong className="text-slate-300 font-mono">{formatAddress(loan.borrower)}</strong></span>
          </div>
        </div>
      </div>

      {/* Action Area */}
      <div className="mt-2 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <Link
          to={`/loan/${loan.loanId}`}
          className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
        >
          Details →
        </Link>

        {Number(loan.status) === 0 && (
          <button
            onClick={() => onFund && onFund(loan.loanId, loan.principal)}
            disabled={isProcessing || isBorrower}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
          >
            {isBorrower ? 'Your Loan' : 'Fund Loan'}
          </button>
        )}

        {Number(loan.status) === 1 && isBorrower && (
          <button
            onClick={() => onRepay && onRepay(loan.loanId, loan.principal)}
            disabled={isProcessing}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-md shadow-emerald-600/20"
          >
            Repay Loan
          </button>
        )}
      </div>
    </div>
  );
}
