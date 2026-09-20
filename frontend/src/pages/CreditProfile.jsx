import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { useCredit } from '../hooks/useCredit';
import CreditScoreCard from '../components/CreditScoreCard';
import BorrowingPowerCard from '../components/BorrowingPowerCard';
import { formatAddress, formatUSDC } from '../utils/formatters';
import { ShieldCheck, TrendingUp, AlertTriangle, CheckCircle, Info, Lock } from 'lucide-react';

export default function CreditProfile() {
  const { account, connectWallet, isConnecting } = useWallet();
  const { score, limit, profile, loading } = useCredit();

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-3xl glass-panel border border-slate-800">
          <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
          <p className="text-xs text-slate-400 mb-6">
            Connect MetaMask to view your protocol-native onchain credit score and borrowing limit.
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
          Protocol-Native Reputation
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
          Credit Profile
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Mathematically computed onchain by CreditRegistry.sol on Ethereum Sepolia.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <CreditScoreCard score={score} loading={loading} />
        <BorrowingPowerCard limit={limit} loading={loading} />
      </div>

      {/* Transparent Scoring Parameters */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-800 mb-8">
        <div className="flex items-center space-x-2 text-cyan-400 mb-4">
          <Info size={18} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Deterministic Scoring Rules
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          CrediFi uses no centralized credit bureaus and no probabilistic AI models to determine your financial capability. All score adjustments are transparently enforced by the smart contract:
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-900/40">
            <div className="flex items-center space-x-2 text-emerald-400 mb-1">
              <CheckCircle size={15} />
              <span className="font-bold">On-Time Repayment</span>
            </div>
            <span className="text-xl font-bold font-mono text-white block my-1">+50 Points</span>
            <p className="text-[11px] text-slate-400">Awarded automatically upon debt settlement on or before due date.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-900/40">
            <div className="flex items-center space-x-2 text-cyan-400 mb-1">
              <TrendingUp size={15} />
              <span className="font-bold">Early Bonus</span>
            </div>
            <span className="text-xl font-bold font-mono text-white block my-1">+20 Bonus</span>
            <p className="text-[11px] text-slate-400">Awarded if loan is settled in the first half of the duration.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-900/40">
            <div className="flex items-center space-x-2 text-amber-400 mb-1">
              <AlertTriangle size={15} />
              <span className="font-bold">Late Repayment</span>
            </div>
            <span className="text-xl font-bold font-mono text-white block my-1">-40 Penalty</span>
            <p className="text-[11px] text-slate-400">Deducted if payment is completed after the due date.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-rose-900/40">
            <div className="flex items-center space-x-2 text-rose-400 mb-1">
              <AlertTriangle size={15} />
              <span className="font-bold">Default Penalty</span>
            </div>
            <span className="text-xl font-bold font-mono text-white block my-1">-150 Penalty</span>
            <p className="text-[11px] text-slate-400">Heavily penalizes borrowing power down to a minimum of 300 pts.</p>
          </div>
        </div>
      </div>

      {/* Lifetime Stats */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-800">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
          Lifetime Onchain Activity
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-slate-500 block mb-1">Loans Initiated</span>
            <span className="text-lg font-bold font-mono text-white">{profile ? profile.loansTaken : 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-slate-500 block mb-1">Loans Repaid</span>
            <span className="text-lg font-bold font-mono text-emerald-400">{profile ? profile.loansRepaid : 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-slate-500 block mb-1">Lifetime Borrowed</span>
            <span className="text-lg font-bold font-mono text-white">${profile ? formatUSDC(profile.totalBorrowed) : '0.00'}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-slate-500 block mb-1">Lifetime Repaid</span>
            <span className="text-lg font-bold font-mono text-emerald-400">${profile ? formatUSDC(profile.totalRepaid) : '0.00'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
