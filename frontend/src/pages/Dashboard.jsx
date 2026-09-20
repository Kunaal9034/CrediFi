import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useCredit } from '../hooks/useCredit';
import { useLoan } from '../hooks/useLoan';
import { api } from '../services/api';
import { fetchUserLoansOnchain } from '../services/blockchain';
import CreditScoreCard from '../components/CreditScoreCard';
import BorrowingPowerCard from '../components/BorrowingPowerCard';
import LoanTable from '../components/LoanTable';
import TransactionProgress from '../components/TransactionProgress';
import { formatAddress, formatUSDC } from '../utils/formatters';
import { Layers, CheckCircle2, AlertOctagon, TrendingUp, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { account, provider, isConnecting, connectWallet } = useWallet();
  const {
    score,
    limit,
    availableBorrowingPower,
    outstandingPrincipal,
    profile,
    loading: creditLoading,
    isRefreshing: creditRefreshing,
    initialLoading,
    refresh: refreshCredit,
  } = useCredit();
  const { fundLoan, repayLoan, status, txHash, error, reset, isPending } = useLoan();

  const [loans, setLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(false);

  const fetchUserLoans = async () => {
    if (!account) return;
    setLoansLoading(true);
    try {
      // 1. Direct onchain scan from Sepolia
      const onchain = await fetchUserLoansOnchain(account, provider);
      if (onchain && onchain.length > 0) {
        setLoans(onchain);
        setLoansLoading(false);
        return;
      }
    } catch (onchainErr) {
      console.warn('Dashboard onchain loan fetch error:', onchainErr.message);
    }

    try {
      const data = await api.getUserLoans(account);
      setLoans(data.loans || []);
    } catch (err) {
      console.warn('Could not fetch loans from backend API, using empty list:', err.message);
      setLoans([]);
    } finally {
      setLoansLoading(false);
    }
  };

  useEffect(() => {
    fetchUserLoans();
  }, [account]);

  const handleActionCompleted = async () => {
    await refreshCredit();
    await fetchUserLoans();
  };

  if (!account) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-3xl glass-panel border border-slate-800 max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Connect with MetaMask on Ethereum Sepolia to view your protocol-native onchain credit score and borrowing limit.
          </p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/20"
          >
            Connect MetaMask
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
            Account Overview
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2 mt-0.5">
            <span>Welcome, {formatAddress(account)}</span>
          </h1>
        </div>

        <button
          onClick={() => {
            refreshCredit();
            fetchUserLoans();
          }}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 flex items-center space-x-2 transition-colors"
        >
          <RefreshCw size={13} className={creditLoading || creditRefreshing || loansLoading ? 'animate-spin' : ''} />
          <span>Refresh Onchain State</span>
        </button>
      </div>

      {/* Transaction Progress Tracker */}
      <TransactionProgress
        status={status}
        txHash={txHash}
        error={error}
        onReset={() => {
          reset();
          handleActionCompleted();
        }}
      />

      {/* Primary Cards Grid: Score + Borrowing Power */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <CreditScoreCard score={score} loading={creditLoading} initialLoading={initialLoading} />
        <BorrowingPowerCard
          limit={limit}
          availableBorrowingPower={availableBorrowingPower}
          outstandingPrincipal={outstandingPrincipal}
          loading={creditLoading}
          initialLoading={initialLoading}
        />
      </div>

      {/* Profile Onchain Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="p-4 rounded-xl glass-panel border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
            <Layers size={13} className="text-cyan-400" />
            <span>Loans Taken</span>
          </div>
          <span className="text-xl font-bold font-mono text-white">
            {profile ? profile.loansTaken : 0}
          </span>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>Loans Repaid</span>
          </div>
          <span className="text-xl font-bold font-mono text-emerald-400">
            {profile ? profile.loansRepaid : 0}
          </span>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
            <AlertOctagon size={13} className="text-rose-400" />
            <span>Defaults</span>
          </div>
          <span className="text-xl font-bold font-mono text-rose-400">
            {profile ? profile.defaults : 0}
          </span>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
            <TrendingUp size={13} className="text-blue-400" />
            <span>Total Borrowed</span>
          </div>
          <span className="text-xl font-bold font-mono text-white">
            ${profile ? formatUSDC(profile.totalBorrowed) : '0.00'}
          </span>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
            <TrendingUp size={13} className="text-emerald-400" />
            <span>Total Repaid</span>
          </div>
          <span className="text-xl font-bold font-mono text-emerald-400">
            ${profile ? formatUSDC(profile.totalRepaid) : '0.00'}
          </span>
        </div>
      </div>

      {/* Active Borrowings Table */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Your Loans</h2>
            <p className="text-xs text-slate-400">Manage, monitor, and repay your active debt positions</p>
          </div>
          <Link
            to="/loans"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
          >
            View All →
          </Link>
        </div>

        <LoanTable
          loans={loans}
          currentAccount={account}
          onRepay={async (loanId, amount) => {
            await repayLoan(loanId, amount);
            handleActionCompleted();
          }}
          isProcessing={isPending}
          emptyMessage="You have no loans yet. Visit the Borrow page to request credit-based liquidity."
        />
      </div>
    </div>
  );
}
