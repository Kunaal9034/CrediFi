import React from 'react';
import { Wallet, ArrowRight, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatUSDC } from '../utils/formatters';

export default function BorrowingPowerCard({ limit = 0n, loading = false }) {
  return (
    <div className="p-6 rounded-2xl glass-panel relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Wallet size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Borrowing Power</h3>
            <p className="text-xs text-slate-400">Undercollateralized onchain limit</p>
          </div>
        </div>
        <span className="inline-flex items-center space-x-1 text-xs text-slate-400">
          <Lock size={12} />
          <span>No Collateral Req.</span>
        </span>
      </div>

      <div className="flex items-baseline space-x-2 my-3">
        <span className="text-4xl font-extrabold tracking-tight text-white font-mono">
          ${loading ? '---' : formatUSDC(limit)}
        </span>
        <span className="text-xs text-cyan-400 font-semibold uppercase">USDC</span>
      </div>

      <p className="text-xs text-slate-400 mb-5">
        Enforced strictly onchain by the CreditRegistry smart contract.
      </p>

      <Link
        to="/borrow"
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/15"
      >
        <span>Request Undercollateralized Loan</span>
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
