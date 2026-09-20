import React from 'react';
import { ShieldCheck, TrendingUp, Info } from 'lucide-react';
import { getCreditTier } from '../utils/constants';

export default function CreditScoreCard({ score = 500, loading = false, initialLoading }) {
  const showPlaceholder = initialLoading !== undefined ? initialLoading : loading;
  const tier = getCreditTier(score);
  // Calculate percentage between 300 and 850
  const percentage = Math.min(Math.max(((score - 300) / (850 - 300)) * 100, 0), 100);

  return (
    <div className="p-6 rounded-2xl glass-panel-glow relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Onchain Credit Score</h3>
            <p className="text-xs text-slate-400">Protocol-native deterministic rating</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${tier.badge}`}>
          {tier.name}
        </span>
      </div>

      <div className="flex items-baseline space-x-3 my-3">
        <span className="text-5xl font-black tracking-tight text-white font-mono">
          {showPlaceholder ? '---' : score}
        </span>
        <span className="text-xs text-slate-500 font-mono">/ 850 Max</span>
      </div>

      {/* Visual Score Meter */}
      <div className="w-full bg-slate-800 rounded-full h-2.5 my-3 overflow-hidden border border-slate-700/60">
        <div
          className="h-2.5 rounded-full bg-gradient-to-r from-amber-500 via-blue-500 to-cyan-400 transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
        <span>300 (Min)</span>
        <span>500 (Base)</span>
        <span>850 (Max)</span>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center space-x-1">
          <TrendingUp size={13} className="text-cyan-400" />
          <span>Next on-time repayment: <strong className="text-cyan-300">+50 pts</strong></span>
        </span>
      </div>
    </div>
  );
}
