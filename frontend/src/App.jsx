import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Web3Provider } from './context/Web3Context';
import Navbar from './components/Navbar';
import NetworkGuard from './components/NetworkGuard';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Borrow from './pages/Borrow';
import Lend from './pages/Lend';
import MyLoans from './pages/MyLoans';
import LoanDetails from './pages/LoanDetails';
import CreditProfile from './pages/CreditProfile';
import Analytics from './pages/Analytics';
import { CONTRACT_ADDRESSES, EXPLORER_URL } from './contracts/addresses';

export default function App() {
  return (
    <Web3Provider>
      <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
        <NetworkGuard />
        <Navbar />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<Dashboard />} />
            <Route path="/borrow" element={<Borrow />} />
            <Route path="/lend" element={<Lend />} />
            <Route path="/loans" element={<MyLoans />} />
            <Route path="/loan/:id" element={<LoanDetails />} />
            <Route path="/credit" element={<CreditProfile />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-900/90 py-8 px-4 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <span className="font-semibold text-slate-400">CrediFi by ArcTech</span> • Hack in Hills '26 • Ethereum Sepolia (Chain ID: 11155111)
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-mono">
              <span className="text-slate-600">Contracts:</span>
              <a
                href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESSES.creditRegistry}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-400 underline decoration-slate-700 underline-offset-2 transition-colors"
              >
                CreditRegistry
              </a>
              <span className="text-slate-700">•</span>
              <a
                href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESSES.loanManager}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-400 underline decoration-slate-700 underline-offset-2 transition-colors"
              >
                LoanManager
              </a>
              <span className="text-slate-700">•</span>
              <a
                href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESSES.lendingPool}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-400 underline decoration-slate-700 underline-offset-2 transition-colors"
              >
                LendingPool
              </a>
              <span className="text-slate-700">•</span>
              <a
                href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESSES.mockUSDC}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-400 underline decoration-slate-700 underline-offset-2 transition-colors"
              >
                MockUSDC
              </a>
            </div>
          </div>
        </footer>
      </div>
    </Web3Provider>
  );
}
