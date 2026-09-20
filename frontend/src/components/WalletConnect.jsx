import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useLoan } from '../hooks/useLoan';
import { formatAddress, formatUSDC } from '../utils/formatters';
import { Wallet, AlertTriangle, Droplets, Loader2, LogOut } from 'lucide-react';
import TransactionProgress from './TransactionProgress';

export default function WalletConnect() {
  const {
    account,
    isConnecting,
    isCorrectNetwork,
    tokenBalance,
    connectWallet,
    disconnectWallet,
    switchNetwork,
  } = useWallet();

  const { claimFaucet, status, txHash, error, reset, isPending } = useLoan();
  const [faucetModalOpen, setFaucetModalOpen] = useState(false);

  if (!account) {
    return (
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-blue-600/30 flex items-center space-x-2"
      >
        {isConnecting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Wallet size={14} />
            <span>Connect MetaMask</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      {/* Wrong Network Banner */}
      {!isCorrectNetwork && (
        <button
          onClick={switchNetwork}
          className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
        >
          <AlertTriangle size={13} className="text-rose-400" />
          <span>Switch to Sepolia</span>
        </button>
      )}

      {/* Faucet Trigger */}
      <button
        onClick={() => setFaucetModalOpen(true)}
        className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 text-cyan-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
        title="Mint test MockUSDC"
      >
        <Droplets size={13} className="text-cyan-400" />
        <span>Faucet</span>
      </button>

      {/* Balance & Address Badge */}
      <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl p-1 text-xs">
        <div className="px-3 py-1 text-slate-300 font-mono font-medium">
          {formatUSDC(tokenBalance)} <span className="text-cyan-400">mUSDC</span>
        </div>
        <div className="px-3 py-1 rounded-lg bg-slate-900/90 text-white font-mono font-semibold flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{formatAddress(account)}</span>
        </div>
        <button
          onClick={disconnectWallet}
          className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors ml-1"
          title="Disconnect"
        >
          <LogOut size={13} />
        </button>
      </div>

      {/* Faucet Modal */}
      {faucetModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Droplets size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">MockUSDC Demo Faucet</h3>
                  <p className="text-xs text-slate-400">Mint test stablecoins for hackathon testing</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFaucetModalOpen(false);
                  reset();
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Mint <strong>1,000 MockUSDC</strong> directly to your wallet on Ethereum Sepolia. These are test tokens for the demo and carry no real-world value.
            </p>

            <TransactionProgress
              status={status}
              txHash={txHash}
              error={error}
              onReset={reset}
            />

            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setFaucetModalOpen(false);
                  reset();
                }}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => claimFaucet(1000n * 10n ** 6n)}
                disabled={isPending}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-all disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-cyan-500/20"
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                <span>Mint 1,000 mUSDC</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
