import React from 'react';
import { formatAddress, formatUSDC, formatAPR, formatDurationDays, formatTimestamp } from '../utils/formatters';
import LoanStatus from './LoanStatus';
import { Link } from 'react-router-dom';

export default function LoanTable({
  loans = [],
  currentAccount,
  onFund,
  onRepay,
  isProcessing = false,
  emptyMessage = 'No loans found.',
}) {
  if (loans.length === 0) {
    return (
      <div className="p-8 text-center glass-panel rounded-2xl border border-slate-800 my-4 text-slate-400 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
          <tr>
            <th className="py-3.5 px-4">Loan ID</th>
            <th className="py-3.5 px-4">Borrower</th>
            <th className="py-3.5 px-4">Principal</th>
            <th className="py-3.5 px-4">APR</th>
            <th className="py-3.5 px-4">Duration</th>
            <th className="py-3.5 px-4">Status</th>
            <th className="py-3.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {loans.map((loan) => {
            const isBorrower =
              currentAccount &&
              loan.borrower.toLowerCase() === currentAccount.toLowerCase();

            return (
              <tr key={loan.loanId.toString()} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                  <Link to={`/loan/${loan.loanId}`} className="hover:underline">
                    #{loan.loanId.toString()}
                  </Link>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-300">
                  {formatAddress(loan.borrower)}
                  {isBorrower && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300">
                      You
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-mono font-semibold text-white">
                  ${formatUSDC(loan.principal)}
                </td>
                <td className="py-3.5 px-4 text-slate-300">{formatAPR(loan.interestRate)}</td>
                <td className="py-3.5 px-4 text-slate-300">{formatDurationDays(loan.duration)}</td>
                <td className="py-3.5 px-4">
                  <LoanStatus status={Number(loan.status)} />
                </td>
                <td className="py-3.5 px-4 text-right space-x-2">
                  <Link
                    to={`/loan/${loan.loanId}`}
                    className="px-2.5 py-1 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    View
                  </Link>

                  {Number(loan.status) === 0 && !isBorrower && onFund && (
                    <button
                      onClick={() => onFund(loan.loanId, loan.principal)}
                      disabled={isProcessing}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all disabled:opacity-50"
                    >
                      Fund
                    </button>
                  )}

                  {Number(loan.status) === 1 && isBorrower && onRepay && (
                    <button
                      onClick={() => onRepay(loan.loanId, loan.totalDue || loan.principal)}
                      disabled={isProcessing}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all disabled:opacity-50"
                    >
                      Repay
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
