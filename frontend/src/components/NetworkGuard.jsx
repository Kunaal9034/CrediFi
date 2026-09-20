import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function NetworkGuard() {
  const { account, chainId, isCorrectNetwork, switchNetwork } = useWallet();

  // Only render if a wallet is connected and on the wrong network
  if (!account || isCorrectNetwork) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-rose-950/90 via-rose-900/80 to-amber-950/90 border-b border-rose-500/40 text-rose-200 px-4 py-3 shadow-lg backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
            <AlertTriangle size={18} />
          </div>
          <div>
            <span className="font-bold text-white block sm:inline mr-2">
              Wrong Network Detected (Chain ID: {chainId || 'Unknown'})
            </span>
            <span className="text-rose-200/90">
              CrediFi is live on <strong>Ethereum Sepolia</strong> (Chain ID: 11155111). Please switch networks to view onchain credit data and transact.
            </span>
          </div>
        </div>

        <button
          onClick={switchNetwork}
          className="whitespace-nowrap px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-black font-bold text-xs transition-all flex items-center space-x-1.5 shadow-md shadow-rose-500/20"
        >
          <span>Switch to Sepolia</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
