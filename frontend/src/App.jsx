import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wider text-cyan-400 uppercase bg-cyan-950/60 border border-cyan-800 rounded-full mb-4">
        ArcTech Presents • Hack in Hills '26
      </span>
      <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-4">
        Credi<span className="text-cyan-400">Fi</span>
      </h1>
      <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mb-8 font-light">
        "Onchain Credit. Undercollateralized Lending."
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          to="/app"
          className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/30"
        >
          Launch App
        </Link>
        <Link
          to="/analytics"
          className="px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-all"
        >
          Protocol Analytics
        </Link>
      </div>
    </div>
  );
}

function PlaceholderPage({ title, description }) {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400">{description}</p>
      <div className="mt-8 p-6 rounded-xl glass-panel border border-slate-800">
        <p className="text-sm text-slate-500">
          Module ready for Phase implementation.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans">
      <header className="border-b border-slate-800/80 bg-[#0f172a]/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-black text-black">
              C
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              Credi<span className="text-cyan-400">Fi</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-300">
            <Link to="/app" className="hover:text-cyan-400 transition-colors">Dashboard</Link>
            <Link to="/borrow" className="hover:text-cyan-400 transition-colors">Borrow</Link>
            <Link to="/lend" className="hover:text-cyan-400 transition-colors">Lend</Link>
            <Link to="/loans" className="hover:text-cyan-400 transition-colors">My Loans</Link>
            <Link to="/credit" className="hover:text-cyan-400 transition-colors">Credit Profile</Link>
            <Link to="/analytics" className="hover:text-cyan-400 transition-colors">Analytics</Link>
          </nav>
          <div>
            <Link
              to="/app"
              className="px-4 py-2 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-xs font-semibold text-white tracking-wide transition-all"
            >
              Connect Wallet
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<PlaceholderPage title="Protocol Dashboard" description="Live onchain credit metrics, active borrowings, and lending stats." />} />
          <Route path="/borrow" element={<PlaceholderPage title="Borrow Undercollateralized" description="Request loans based on your transparent onchain credit profile." />} />
          <Route path="/lend" element={<PlaceholderPage title="Lending Marketplace" description="Fund verified peer-to-peer loan requests directly via smart contracts." />} />
          <Route path="/loans" element={<PlaceholderPage title="My Loans" description="Manage and repay your active borrowings." />} />
          <Route path="/loan/:id" element={<PlaceholderPage title="Loan Details" description="Detailed onchain loan breakdown." />} />
          <Route path="/credit" element={<PlaceholderPage title="Credit Profile" description="Onchain credit score, borrowing power, and transparent repayment history." />} />
          <Route path="/analytics" element={<PlaceholderPage title="Protocol Analytics" description="Macro-level statistics, volume metrics, and repayment fidelity." />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        CrediFi by ArcTech • Hack in Hills '26 • Operating on Ethereum Sepolia Testnet
      </footer>
    </div>
  );
}
