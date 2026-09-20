import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, TrendingUp, Lock, Zap, CheckCircle2 } from 'lucide-react';

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* Glow background accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-cyan-500/10 blur-[100px] pointer-events-none rounded-full" />

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 text-center max-w-5xl mx-auto relative z-10">
        <span className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-6 shadow-sm">
          <Zap size={13} className="text-cyan-400" />
          <span>ArcTech Presents • Hack in Hills '26</span>
        </span>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Onchain Credit. <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Undercollateralized Lending.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mb-10 font-light leading-relaxed">
          Break free from 150%+ overcollateralization. Build a transparent onchain credit profile on Ethereum Sepolia, unlock capital based on verifiable repayment history, and access decentralized peer-to-peer liquidity.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/app"
            className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-sm transition-all shadow-xl shadow-cyan-500/20 flex items-center space-x-2"
          >
            <span>Launch dApp</span>
            <ArrowRight size={16} />
          </Link>

          <Link
            to="/lend"
            className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm transition-all"
          >
            Explore Lending Marketplace
          </Link>
        </div>

        {/* Highlight Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-4xl mx-auto text-left">
          <div className="p-4 rounded-xl glass-panel border border-slate-800">
            <span className="text-xs text-slate-500 font-mono block mb-1">Base Credit Score</span>
            <span className="text-2xl font-bold font-mono text-white">500 pts</span>
          </div>
          <div className="p-4 rounded-xl glass-panel border border-slate-800">
            <span className="text-xs text-slate-500 font-mono block mb-1">Base Borrow Power</span>
            <span className="text-2xl font-bold font-mono text-cyan-400">$500.00</span>
          </div>
          <div className="p-4 rounded-xl glass-panel border border-slate-800">
            <span className="text-xs text-slate-500 font-mono block mb-1">Repayment Boost</span>
            <span className="text-2xl font-bold font-mono text-emerald-400">+50 / +20</span>
          </div>
          <div className="p-4 rounded-xl glass-panel border border-slate-800">
            <span className="text-xs text-slate-500 font-mono block mb-1">Collateral Required</span>
            <span className="text-2xl font-bold font-mono text-white">0% (Zero)</span>
          </div>
        </div>
      </section>

      {/* Core Principles Section */}
      <section className="py-16 px-4 max-w-6xl mx-auto border-t border-slate-800/80">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Why CrediFi?</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Decentralized Finance shouldn't require you to already be rich just to borrow money.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl glass-panel border border-slate-800">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 w-fit mb-4">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Deterministic Scoring</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No black-box AI models or centralized bureaus. Scoring parameters (+50 on-time, +20 early, -40 late, -150 default) are mathematically enforced by Smart Contracts on Ethereum Sepolia.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-slate-800">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 w-fit mb-4">
              <Lock size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Undercollateralized Loans</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Borrow up to your onchain credit limit without locking up 150%+ collateral. The smart contract validates requested amounts directly against your onchain profile.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-slate-800">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit mb-4">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Transparent Yields for Lenders</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Lenders review verified borrower repayment records onchain and fund peer-to-peer loans directly via LendingPool, earning fixed yields paid directly to their wallet.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
