import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';
import ExplorerLink from './ExplorerLink';

export default function TransactionProgress({
  status, // 'idle' | 'waiting_wallet' | 'submitted' | 'confirming' | 'confirmed' | 'failed'
  txHash,
  error,
  onReset,
}) {
  if (status === 'idle') return null;

  const steps = [
    { key: 'waiting_wallet', label: '1. Waiting for wallet approval' },
    { key: 'submitted', label: '2. Transaction submitted' },
    { key: 'confirming', label: '3. Waiting for Sepolia confirmation' },
    { key: 'confirmed', label: '4. Confirmed onchain ✓' },
  ];

  const getStepStatus = (stepKey) => {
    if (status === 'failed') return 'failed';
    const order = ['waiting_wallet', 'submitted', 'confirming', 'confirmed'];
    const currentIndex = order.indexOf(status);
    const stepIndex = order.indexOf(stepKey);

    if (currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="p-4 rounded-xl glass-panel border border-slate-700/80 my-4">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Transaction Lifecycle
        </span>
        {onReset && (status === 'confirmed' || status === 'failed') && (
          <button
            onClick={onReset}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      <div className="space-y-2">
        {steps.map((step) => {
          const stepStatus = getStepStatus(step.key);

          return (
            <div key={step.key} className="flex items-center space-x-3 text-xs">
              {stepStatus === 'completed' && (
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              )}
              {stepStatus === 'active' && (
                <Loader2 size={16} className="text-cyan-400 animate-spin shrink-0" />
              )}
              {stepStatus === 'upcoming' && (
                <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
              )}
              {stepStatus === 'failed' && (
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
              )}

              <span
                className={
                  stepStatus === 'completed'
                    ? 'text-emerald-300 font-medium'
                    : stepStatus === 'active'
                    ? 'text-cyan-300 font-semibold'
                    : 'text-slate-500'
                }
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Explorer Link on Submission / Confirmation */}
      {txHash && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">Tx Hash:</span>
          <ExplorerLink hash={txHash} type="tx" />
        </div>
      )}

      {/* Error Message Display */}
      {status === 'failed' && error && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start space-x-2">
          <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
          <span className="break-all">{error}</span>
        </div>
      )}
    </div>
  );
}
