import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Web3Provider } from './context/Web3Context';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Borrow from './pages/Borrow';
import Lend from './pages/Lend';
import MyLoans from './pages/MyLoans';
import LoanDetails from './pages/LoanDetails';
import CreditProfile from './pages/CreditProfile';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <Web3Provider>
      <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
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

        <footer className="border-t border-slate-900/90 py-8 px-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              CrediFi by ArcTech • Hack in Hills '26 • Operating on Ethereum Sepolia Testnet
            </span>
            <div className="flex items-center space-x-4 text-slate-500 text-[11px]">
              <span>Smart Contracts Verified</span>
              <span>•</span>
              <span>Zero Collateral Protocol</span>
            </div>
          </div>
        </footer>
      </div>
    </Web3Provider>
  );
}
