import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useLoan } from '../hooks/useLoan';
import { fetchMarketplaceLoansOnchain, checkAllowance } from '../services/blockchain';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import { formatAddress, formatUSDC, formatAPR, formatDurationDays } from '../utils/formatters';
import LoanCard from '../components/LoanCard';
import TransactionProgress from '../components/TransactionProgress';
import ExplorerLink from '../components/ExplorerLink';
import {
  Coins,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Percent,
  DollarSign,
  User,
  ArrowRight,
  Sparkles,
  X,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Lend() {
  const { account, provider, tokenBalance, refreshBalances, isConnecting, connectWallet, isCorrectNetwork } = useWallet();
  const {
    approveLendingPool,
    fundLoan,
    claimFaucet,
    fundedLoan,
    status,
    txHash,
    error,
    reset,
    isPending,
    isSuccess,
  } = useLoan();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [allowance, setAllowance] = useState(0n);
  const [isApproving, setIsApproving] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  // Fetch open REQUESTED loans directly onchain from Sepolia
  const fetchMarketplaceLoans = useCallback(async () => {
    setLoading(true);
    try {
      const onchainLoans = await fetchMarketplaceLoansOnchain(provider);
      setLoans(onchainLoans || []);
    } catch (err) {
      console.error('[Lend] Failed to fetch marketplace loans:', err);
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchMarketplaceLoans();
  }, [fetchMarketplaceLoans]);

  // Check allowance when a loan is selected or account changes
  const updateAllowance = useCallback(async (currentLoan) => {
    if (!account || !currentLoan) return;
    try {
      const currentAllowance = await checkAllowance(
        'mockUSDC',
        account,
        CONTRACT_ADDRESSES.lendingPool,
        provider
      );
      setAllowance(currentAllowance);
    } catch (err) {
      console.error('[Lend] Failed to read allowance:', err);
    }
  }, [account, provider]);

  useEffect(() => {
    if (selectedLoan) {
      updateAllowance(selectedLoan);
    }
  }, [selectedLoan, updateAllowance]);

  const handleSelectLoan = (loan) => {
    reset();
    setSelectedLoan(loan);
  };

  const handleCloseModal = () => {
    reset();
    setSelectedLoan(null);
    fetchMarketplaceLoans();
  };

  // Step 1: Approve LendingPool
  const handleApprove = async () => {
    if (!selectedLoan) return;
    setIsApproving(true);
    try {
      await approveLendingPool(selectedLoan.principal);
      await updateAllowance(selectedLoan);
      reset();
    } catch (err) {
      console.error('[Lend] Approval failed:', err);
    } finally {
      setIsApproving(false);
    }
  };

  // Step 2: Fund Loan
  const handleFund = async () => {
    if (!selectedLoan) return;
    try {
      await fundLoan(selectedLoan.loanId, async () => {
        await refreshBalances();
        await fetchMarketplaceLoans();
      });
    } catch (err) {
      console.error('[Lend] Funding failed:', err);
    }
  };

  // Quick faucet claim helper
  const handleClaimFaucet = async () => {
    setClaimLoading(true);
    try {
      await claimFaucet();
      await refreshBalances();
    } catch (err) {
      console.error('[Lend] Faucet claim failed:', err);
    } finally {
      setClaimLoading(false);
    }
  };

  const isBorrower =
    account &&
    selectedLoan &&
    selectedLoan.borrower.toLowerCase() === account.toLowerCase();

  const hasInsufficientBalance =
    selectedLoan && tokenBalance < selectedLoan.principal;

  const needsApproval =
    selectedLoan && allowance < selectedLoan.principal;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-cyan-400 mb-1">
            <Sparkles size={14} />
            <span>Peer-to-Peer Liquidity Layer</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Lending Marketplace
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Fund verified onchain unsecured loans on Ethereum Sepolia and earn fixed APR returns at maturity.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              refreshBalances();
              fetchMarketplaceLoans();
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 flex items-center space-x-2 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Lender Summary Banner */}
      {account ? (
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">
              Connected Lender Wallet
            </span>
            <span className="font-mono font-bold text-slate-200 text-sm">
              {formatAddress(account)}
            </span>
            <span className="text-[11px] text-cyan-400 flex items-center space-x-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"></span>
              <span>Sepolia Verified</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">
              Lender MockUSDC Balance
            </span>
            <span className="font-mono font-bold text-white text-lg">
              ${formatUSDC(tokenBalance)}{' '}
              <span className="text-xs font-normal text-slate-400">mUSDC</span>
            </span>
          </div>

          <div className="flex items-center sm:justify-end">
            <button
              onClick={handleClaimFaucet}
              disabled={claimLoading || isPending}
              className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-semibold text-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Coins size={14} />
              <span>{claimLoading ? 'Minting 1,000...' : 'Claim 1,000 mUSDC Faucet'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 text-center mb-8">
          <h3 className="text-sm font-bold text-white mb-1">Connect Your Wallet to Fund Loans</h3>
          <p className="text-xs text-slate-400 mb-4">
            Connect with MetaMask on Ethereum Sepolia to deploy liquidity and earn interest.
          </p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20"
          >
            Connect MetaMask
          </button>
        </div>
      )}

      {/* Global Transaction Progress Tracker if no modal is active */}
      {!selectedLoan && (
        <TransactionProgress
          status={status}
          txHash={txHash}
          error={error}
          onReset={reset}
        />
      )}

      {/* Open Loan Requests Section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
          Open Loan Requests ({loans.length})
        </h2>
        <span className="text-[11px] text-slate-500">
          Live reads from LoanManager.sol
        </span>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-500 text-xs">
          Scanning Sepolia LoanManager for open loan requests...
        </div>
      ) : loans.length === 0 ? (
        <div className="py-16 text-center glass-panel rounded-2xl border border-slate-800 max-w-lg mx-auto">
          <Coins size={36} className="text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Open Loan Requests</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            There are currently no unfunded loan requests awaiting liquidity on Sepolia.
          </p>
          <Link
            to="/borrow"
            className="inline-block px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-colors"
          >
            Request a Loan →
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loans.map((loan) => (
            <LoanCard
              key={loan.loanId.toString()}
              loan={loan}
              currentAccount={account}
              onFund={() => handleSelectLoan(loan)}
              isProcessing={isPending}
            />
          ))}
        </div>
      )}

      {/* Selected Loan Funding Modal */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-semibold text-cyan-400">
                  Liquidity Deployment
                </span>
                <h3 className="text-lg font-bold text-white">
                  Fund Loan #{selectedLoan.loanId}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isPending}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Success View */}
            {isSuccess && fundedLoan ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 text-emerald-400 flex items-start space-x-3">
                  <CheckCircle2 size={24} className="shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Loan Funded Successfully!
                    </h4>
                    <p className="text-xs text-emerald-400/90 mt-0.5">
                      Loan #{fundedLoan.loanId} is now <strong className="font-mono">ACTIVE</strong> onchain. Principal has been disbursed to the borrower.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Principal Disbursed:</span>
                    <span className="font-mono font-semibold text-white">
                      ${formatUSDC(fundedLoan.principal)} mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Lender (You):</span>
                    <span className="font-mono text-slate-300">
                      {formatAddress(fundedLoan.lender)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Borrower:</span>
                    <span className="font-mono text-slate-300">
                      {formatAddress(fundedLoan.borrower)}
                    </span>
                  </div>
                  {txHash && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span>Transaction:</span>
                      <ExplorerLink hash={txHash} type="tx" />
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                  >
                    Done
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
              <div className="space-y-4">
                {/* Loan Terms Summary */}
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs space-y-2.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Borrower Address:</span>
                    <span className="font-mono text-slate-200 font-semibold">
                      {formatAddress(selectedLoan.borrower)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Principal Required:</span>
                    <span className="font-mono text-white font-bold text-sm">
                      ${formatUSDC(selectedLoan.principal)} mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Offered APR:</span>
                    <span className="font-mono text-cyan-400 font-semibold">
                      {formatAPR(selectedLoan.interestRateBps || selectedLoan.interestRate)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Loan Duration:</span>
                    <span className="font-mono text-slate-200">
                      {formatDurationDays(selectedLoan.duration)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-slate-300 font-semibold">
                    <span>Total Return at Maturity:</span>
                    <span className="font-mono text-emerald-400">
                      ${formatUSDC(selectedLoan.totalDue || selectedLoan.principal)} mUSDC
                    </span>
                  </div>
                </div>

                {/* Self-funding Warning */}
                {isBorrower && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-start space-x-2">
                    <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Self-Funding Forbidden</span>
                      <p className="text-[11px] text-amber-400/90 mt-0.5">
                        You are the creator of this loan request. The protocol prevents borrowers from funding their own loans. Please switch to a different wallet to fund.
                      </p>
                    </div>
                  </div>
                )}

                {/* Insufficient Balance Warning */}
                {!isBorrower && hasInsufficientBalance && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start space-x-2">
                    <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Insufficient mUSDC Balance</span>
                      <p className="text-[11px] text-rose-400/90 mt-0.5">
                        You have ${formatUSDC(tokenBalance)} mUSDC, but ${formatUSDC(selectedLoan.principal)} is required. Use the faucet button above to claim test tokens.
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

                {/* Action Buttons: 2-Step Allowance -> Fund */}
                <div className="space-y-2 pt-2">
                  {needsApproval ? (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isPending || isApproving || isBorrower || hasInsufficientBalance || !isCorrectNetwork}
                      className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
                    >
                      {isApproving || (isPending && status !== 'confirmed')
                        ? 'Approving mUSDC onchain...'
                        : '1. Approve MockUSDC Spending'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFund}
                      disabled={isPending || isBorrower || hasInsufficientBalance || !isCorrectNetwork}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white font-semibold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/15"
                    >
                      {isPending
                        ? 'Broadcasting to Sepolia...'
                        : '2. Confirm & Fund Loan'}
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

