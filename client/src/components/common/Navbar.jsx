import React, { useState } from 'react';
import { Shield, Wallet, ChevronDown, LogOut, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWeb3 } from '../../context/Web3Context';
import RoleBadge from './RoleBadge';

export default function Navbar() {
  const { user, logout, switchDemoRole } = useAuth();
  const { account, connectWallet, isConnecting, chainId, switchToPolygonAmoy, isAmoyNetwork } = useWeb3();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  const demoRoles = ['OFFICER', 'FORENSIC', 'JUDGE', 'PROSECUTOR', 'ADMIN'];

  const handleRoleSwitch = async (role) => {
    setShowRoleSwitcher(false);
    await switchDemoRole(role);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-justice-700 to-justice-500 flex items-center justify-center shadow-glow border border-justice-400/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                JusticeVault
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-justice-500/10 text-justice-400 border border-justice-500/20 tracking-wider uppercase">
                Enterprise Web3
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Tamper-Proof Digital Evidence & Chain of Custody
            </p>
          </div>
        </div>

        {/* Right: Actions & User State */}
        <div className="flex items-center gap-3">
          {/* Quick Demo Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
              title="Switch demo role instantly for demonstration"
            >
              <RefreshCw className="w-3.5 h-3.5 text-justice-400" />
              <span className="hidden md:inline">Demo Switcher:</span>
              <span className="font-bold text-justice-300">{user?.role}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showRoleSwitcher && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Switch Active Role:
                </div>
                {demoRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleSwitch(role)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      user?.role === role
                        ? 'bg-justice-500/20 text-justice-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{role}</span>
                    {user?.role === role && <CheckCircle className="w-3.5 h-3.5 text-justice-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Blockchain Network Status */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-800 text-xs text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isAmoyNetwork ? 'bg-emerald-400 shadow-glow-success' : 'bg-purple-400'
              }`}
            ></span>
            <span className="font-medium text-slate-300">
              {isAmoyNetwork ? 'Polygon Amoy' : chainId === 31337 ? 'Hardhat Node' : 'Amoy Testnet'}
            </span>
          </div>

          {/* MetaMask Connect Button */}
          {account ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-mono text-slate-300">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {account.substring(0, 6)}...{account.substring(account.length - 4)}
              </span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-justice-600 to-justice-500 hover:from-justice-500 hover:to-justice-400 text-white text-xs font-medium transition-all shadow-glow"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          )}

          {/* User Profile Pill & Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-medium text-slate-200">{user.name}</div>
                <div className="text-[10px] text-slate-400">{user.badgeNumber || user.email}</div>
              </div>
              <button
                onClick={logout}
                title="Sign out of JusticeVault"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
