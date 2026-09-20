import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useLoan } from '../hooks/useLoan';
import { getContract, fetchLoanDetails as fetchOnchainLoan } from '../services/blockchain';
import { api } from '../services/api';
import { formatAddress, formatUSDC, formatAPR, formatDurationDays, formatTimestamp } from '../utils/formatters';
import LoanStatus from '../components/LoanStatus';
import TransactionProgress from '../components/TransactionProgress';
import ExplorerLink from '../components/ExplorerLink';
import { ArrowLeft, User, DollarSign, Calendar, Percent, ShieldCheck } from 'lucide-react';

export default function LoanDetails() {
  const { id } = useParams();
  const { account, provider } = useWallet();
  const { fundLoan, repayLoan, status, txHash, error, reset, isPending } = useLoan();

  const [loan, setLoan] = useState(null);
  const [totalDue, setTotalDue] = useState(0n);
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
            fetchLoanDetails();
          }}
        />

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
            <span className="text-slate-200 font-semibold text-sm">{formatAPR(loan.interestRate)}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-500 block mb-1">Duration</span>
            <span className="text-slate-200 font-semibold text-sm">{formatDurationDays(loan.duration)}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-500 block mb-1">Start Time</span>
            <span className="text-slate-200 font-medium">
              {loan.startTime > 0 ? formatTimestamp(loan.startTime) : 'Pending funding'}
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

        {/* Action Button */}
        {loan.status === 0 && !isBorrower && (
          <button
            onClick={() => fundLoan(loan.loanId, loan.principal)}
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20"
          >
            Fund Loan (Deposit ${formatUSDC(loan.principal)} mUSDC)
          </button>
        )}

        {loan.status === 1 && isBorrower && (
          <button
            onClick={() => repayLoan(loan.loanId, totalDue)}
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/20"
          >
            Repay Total Due (${formatUSDC(totalDue)} mUSDC)
          </button>
        )}
      </div>
    </div>
  );
}
