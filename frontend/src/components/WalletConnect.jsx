import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useLoan } from '../hooks/useLoan';
import { formatAddress, formatUSDC } from '../utils/formatters';
import { EXPLORER_URL } from '../contracts/addresses';
import { Wallet, AlertTriangle, Droplets, Loader2, LogOut, ExternalLink } from 'lucide-react';
import TransactionProgress from './TransactionProgress';

export default function WalletConnect() {
  const {
    account,
    chainId,
    isConnecting,
    connectionError,
    clearConnectionError,
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
      <div className="flex flex-col items-end">
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-blue-600/30 flex items-center space-x-2 disabled:opacity-50"
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
        {connectionError && (
          <div className="absolute top-16 right-4 z-50 p-3 bg-rose-950/90 border border-rose-500/40 rounded-xl text-rose-200 text-xs shadow-xl flex items-center space-x-2">
            <AlertTriangle size={14} className="text-rose-400 shrink-0" />
            <span>{connectionError}</span>
            <button onClick={clearConnectionError} className="ml-2 text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 sm:space-x-3">
      {/* Network Badge */}
      {isCorrectNetwork ? (
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-xs font-mono font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sepolia</span>
        </div>
      ) : (
        <button
          onClick={switchNetwork}
          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
          title="Click to switch to Ethereum Sepolia"
        >
          <AlertTriangle size={13} className="text-rose-400 animate-pulse" />
          <span>Switch to Sepolia</span>
        </button>
      )}

      {/* Faucet Trigger */}
      <button
        onClick={() => setFaucetModalOpen(true)}
        className="px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 text-cyan-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
        title="Mint test MockUSDC on Sepolia"
      >
        <Droplets size={13} className="text-cyan-400" />
        <span className="hidden sm:inline">Faucet</span>
      </button>

      {/* Balance & Address Badge */}
      <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl p-1 text-xs">
        <div className="px-2.5 py-1 text-slate-300 font-mono font-medium hidden md:block">
          {formatUSDC(tokenBalance)} <span className="text-cyan-400">mUSDC</span>
        </div>
        <a
          href={`${EXPLORER_URL}/address/${account}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-900 text-white font-mono font-semibold flex items-center space-x-1.5 transition-colors"
          title="View on Sepolia Etherscan"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{formatAddress(account)}</span>
          <ExternalLink size={10} className="text-slate-500 hover:text-slate-300 ml-0.5" />
        </a>
        <button
          onClick={disconnectWallet}
          className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors ml-1"
          title="Disconnect wallet"
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
                  <h3 className="text-base font-bold text-white">MockUSDC Testnet Faucet</h3>
                  <p className="text-xs text-slate-400">Mint test stablecoins on Ethereum Sepolia</p>
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
              Mint <strong>1,000 MockUSDC</strong> directly to your wallet from the deployed contract on Ethereum Sepolia. These tokens are for testnet lending & borrowing evaluations.
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
                disabled={isPending || !isCorrectNetwork}
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
