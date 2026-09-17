import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login, switchDemoRole } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (role) => {
    try {
      setLoading(true);
      setError(null);
      await switchDemoRole(role);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Quick demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-justice-700 via-justice-500 to-sky-400 flex items-center justify-center shadow-glow border border-justice-400/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">JusticeVault</h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Tamper-Proof Digital Evidence & Cryptographic Chain-of-Custody System
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl shadow-2xl space-y-6 border border-slate-800">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Official Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="officer@justicevault.gov"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Security Passcode</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-justice-600 to-justice-500 hover:from-justice-500 hover:to-justice-400 text-white font-semibold text-xs transition-all shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Secure Vault'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Role Logins */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-400 text-center uppercase tracking-wider">
              1-Click Demo Personas:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('OFFICER')}
                className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-left transition-colors"
              >
                <div className="font-semibold text-blue-400 text-[11px]">Officer</div>
                <div className="text-[10px] text-slate-400 truncate">Det. Sarah Jenkins</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('FORENSIC')}
                className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-left transition-colors"
              >
                <div className="font-semibold text-emerald-400 text-[11px]">Forensics</div>
                <div className="text-[10px] text-slate-400 truncate">Dr. Evelyn Reed</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('JUDGE')}
                className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-left transition-colors"
              >
                <div className="font-semibold text-amber-400 text-[11px]">Judge</div>
                <div className="text-[10px] text-slate-400 truncate">Judge Catherine Adams</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('PROSECUTOR')}
                className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-left transition-colors"
              >
                <div className="font-semibold text-purple-400 text-[11px]">Prosecutor</div>
                <div className="text-[10px] text-slate-400 truncate">DA David Miller</div>
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('ADMIN')}
              className="w-full p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold text-center transition-colors"
            >
              Sign In as Chief Administrator
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          Anchored to Polygon Amoy Testnet (Chain ID: 80002) • Off-Chain IPFS Storage
        </div>
      </div>
    </div>
  );
}
