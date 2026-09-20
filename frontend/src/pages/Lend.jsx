import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useLoan } from '../hooks/useLoan';
import { api } from '../services/api';
import { getContract } from '../services/blockchain';
import LoanCard from '../components/LoanCard';
import TransactionProgress from '../components/TransactionProgress';
import { Search, RefreshCw, Filter, Coins, CheckCircle2 } from 'lucide-react';

export default function Lend() {
  const { account, provider } = useWallet();
  const { fundLoan, status, txHash, error, reset, isPending } = useLoan();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterTerm, setFilterTerm] = useState('all');

  const fetchMarketplaceLoans = async () => {
    setLoading(true);
    try {
      // First try backend indexed open loans
      const res = await api.getLoans({ status: 0 }); // REQUESTED
      if (res && res.loans && res.loans.length > 0) {
        setLoans(res.loans);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Backend API query skipped, checking onchain loans directly:', err.message);
    }

    // Onchain fallback: query LoanManager directly for existing loans
    try {
      const loanManager = getContract('loanManager', provider);
      if (loanManager) {
        const totalCount = await loanManager.loanCounter();
        const onchainLoans = [];
        for (let i = 1; i <= Number(totalCount); i++) {
          const loan = await loanManager.getLoan(i);
          if (Number(loan.status) === 0) {
            onchainLoans.push({
              loanId: Number(loan.loanId),
              borrower: loan.borrower,
              lender: loan.lender,
              principal: loan.principal,
              interestRate: Number(loan.interestRate),
              duration: Number(loan.duration),
              status: Number(loan.status),
              startTime: Number(loan.startTime),
              dueDate: Number(loan.dueDate),
            });
          }
        }
        setLoans(onchainLoans);
      }
    } catch (onchainErr) {
      console.error('Failed to read onchain loans:', onchainErr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketplaceLoans();
  }, [provider]);

  const handleFund = async (loanId, principal) => {
    try {
      await fundLoan(loanId, principal);
      await fetchMarketplaceLoans();
    } catch (err) {
      console.error('Funding failed:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
            Peer-to-Peer Liquidity
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
            Lending Marketplace
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Fund verified undercollateralized loan requests directly onchain and earn fixed APR returns.
          </p>
        </div>

        <button
          onClick={fetchMarketplaceLoans}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 flex items-center space-x-2 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Marketplace</span>
        </button>
      </div>

      {/* Transaction Progress Tracker */}
      <TransactionProgress
        status={status}
        txHash={txHash}
        error={error}
        onReset={() => {
          reset();
          fetchMarketplaceLoans();
        }}
      />

      {/* Marketplace Loans Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-xs">
          Loading active loan requests from blockchain...
        </div>
      ) : loans.length === 0 ? (
        <div className="py-16 text-center glass-panel rounded-2xl border border-slate-800 max-w-lg mx-auto">
          <Coins size={36} className="text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Open Loan Requests</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            There are currently no unfunded loan requests in the marketplace.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loans.map((loan) => (
            <LoanCard
              key={loan.loanId.toString()}
              loan={loan}
              currentAccount={account}
              onFund={handleFund}
              isProcessing={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
