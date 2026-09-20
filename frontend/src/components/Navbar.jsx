import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import WalletConnect from './WalletConnect';

export default function Navbar() {
  const location = useLocation();

  const navLinks = [
    { path: '/app', label: 'Dashboard' },
    { path: '/borrow', label: 'Borrow' },
    { path: '/lend', label: 'Lend' },
    { path: '/loans', label: 'My Loans' },
    { path: '/credit', label: 'Credit Profile' },
    { path: '/analytics', label: 'Analytics' },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-[#090d16]/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-black text-black text-base shadow-md shadow-blue-500/20">
            C
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-white">
              Credi<span className="text-cyan-400">Fi</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] text-slate-500 font-mono tracking-wider uppercase">
              by ArcTech
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 text-xs font-semibold">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  isActive
                    ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-800/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet Actions */}
        <WalletConnect />
      </div>
    </header>
  );
}
