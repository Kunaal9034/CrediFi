import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  FileCheck2,
  ShieldCheck,
  AlertTriangle,
  ArrowRightLeft,
  Plus,
  ArrowRight,
  ExternalLink,
  Shield
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import HashDisplay from '../components/common/HashDisplay';
import EvidenceUploadModal from '../components/evidence/EvidenceUploadModal';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const metrics = stats?.metrics || {
    activeCases: 0,
    totalEvidence: 0,
    verifiedEvidence: 0,
    flaggedEvidence: 0,
    transferredEvidence: 0
  };

  const canUpload = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-slate-400">
            Real-time status of cryptographic evidence custody and on-chain attestations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/verify"
            className="px-4 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Verification Studio</span>
          </Link>

          {canUpload && (
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-justice-600 to-justice-500 hover:from-justice-500 hover:to-justice-400 text-white text-xs font-semibold flex items-center gap-2 shadow-glow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Register Evidence</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Cases */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Cases</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{metrics.activeCases}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <span>Investigative dossiers in progress</span>
          </div>
        </div>

        {/* Total Evidence */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Evidence</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{metrics.totalEvidence}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <span>SHA-256 anchored on Polygon Amoy</span>
          </div>
        </div>

        {/* Verified Evidence */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Hash Verified</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">{metrics.verifiedEvidence}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <span>Confirmed cryptographic matches</span>
          </div>
        </div>

        {/* Flagged / Tampered */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Hash Mismatches</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-400">{metrics.flaggedEvidence}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <span>Tampered or altered file alerts</span>
          </div>
        </div>
      </div>

      {/* Main Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Evidence Registry (2 Cols) */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-850/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-justice-400" />
              <h2 className="font-bold text-sm text-slate-200">Recent Evidence Vault Entries</h2>
            </div>
            <Link to="/evidence" className="text-xs text-justice-400 hover:text-justice-300 flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto p-2">
            {stats?.recentEvidence && stats.recentEvidence.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="px-4 py-3">Evidence ID</th>
                    <th className="px-4 py-3">Case</th>
                    <th className="px-4 py-3">File Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">On-Chain Digest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {stats.recentEvidence.map((ev) => (
                    <tr key={ev._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-bold text-justice-300">
                        <Link to={`/evidence/${ev.evidenceId}`} className="hover:underline">
                          {ev.evidenceId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">{ev.caseNumber}</td>
                      <td className="px-4 py-3 truncate max-w-[140px]">{ev.originalFilename}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ev.status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <HashDisplay hash={ev.sha256} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No digital evidence registered yet. Click 'Register Evidence' to upload.
              </div>
            )}
          </div>
        </div>

        {/* Live Custody Timeline Stream (1 Col) */}
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-850/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
              <h2 className="font-bold text-sm text-slate-200">Recent Custody Transitions</h2>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">● LIVE</span>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto max-h-[380px]">
            {stats?.recentEvents && stats.recentEvents.length > 0 ? (
              stats.recentEvents.map((evt) => (
                <div key={evt._id} className="p-3 rounded-xl bg-slate-850 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{evt.evidenceNumber}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300">{evt.reason}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>By: {evt.actor?.name || 'Officer'}</span>
                    {evt.blockchainTx && <HashDisplay hash={evt.blockchainTx} isTx={true} truncate={true} />}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">No custody activity recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Evidence Upload Modal */}
      <EvidenceUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          setIsUploadOpen(false);
          fetchStats();
        }}
      />
    </div>
  );
}
