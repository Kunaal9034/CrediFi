import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useLoan } from '../hooks/useLoan';
import { useCredit } from '../hooks/useCredit';
import { api } from '../services/api';
import { getContract, fetchUserLoansOnchain } from '../services/blockchain';
import LoanTable from '../components/LoanTable';
import TransactionProgress from '../components/TransactionProgress';
import { RefreshCw, Filter, ShieldCheck } from 'lucide-react';

export default function MyLoans() {
  const { account, provider } = useWallet();
  const { repayLoan, status, txHash, error, reset, isPending } = useLoan();
  const { score, refresh: refreshCredit } = useCredit();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all | active | requested | completed

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

  const handleRepay = async (loanId, amount) => {
    try {
      await repayLoan(loanId, amount);
      await refreshCredit();
      await fetchMyLoans();
    } catch (err) {
      console.error('Repayment failed:', err);
    }
  };

  // Filter loans
  const filteredLoans = loans.filter((l) => {
    if (activeTab === 'requested') return Number(l.status) === 0;
    if (activeTab === 'active') return Number(l.status) === 1;
    if (activeTab === 'completed') return Number(l.status) === 2 || Number(l.status) === 3;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
            Portfolio Management
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
            My Loans
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track active borrowings, view repayment schedules, and settle debts to boost your credit score.
          </p>
        </div>

        <button
          onClick={fetchMyLoans}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 flex items-center space-x-2 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Loans</span>
        </button>
      </div>

      {/* Transaction Progress Tracker */}
      <TransactionProgress
        status={status}
        txHash={txHash}
        error={error}
        onReset={() => {
          reset();
          refreshCredit();
          fetchMyLoans();
        }}
      />

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 mb-6 border-b border-slate-800 pb-3">
        {[
          { key: 'all', label: 'All Loans' },
          { key: 'requested', label: 'Requested' },
          { key: 'active', label: 'Active (To Repay)' },
          { key: 'completed', label: 'Repaid & Defaulted' },
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

      {/* Loans Table */}
      <LoanTable
        loans={filteredLoans}
        currentAccount={account}
        onRepay={handleRepay}
        isProcessing={isPending}
        emptyMessage="No loans match the selected filter."
      />
    </div>
  );
}
