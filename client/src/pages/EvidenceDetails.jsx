import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileCheck2,
  Download,
  ShieldCheck,
  ArrowRightLeft,
  Search,
  ArrowLeft,
  File,
  Layers,
  Calendar,
  User,
  Shield,
  ExternalLink,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import HashDisplay from '../components/common/HashDisplay';
import CustodyTimeline from '../components/custody/CustodyTimeline';
import VerificationModal from '../components/evidence/VerificationModal';
import TransferModal from '../components/custody/TransferModal';

export default function EvidenceDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisNotes, setAnalysisNotes] = useState('');
  const [toolUsed, setToolUsed] = useState('Autopsy Forensic Browser v4.21');

  useEffect(() => {
    fetchEvidenceDetails();
  }, [id]);

  const fetchEvidenceDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/evidence/${id}`);
      if (res.data.success) {
        setEvidence(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load evidence details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(`/evidence/${evidence.evidenceId}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: evidence.fileType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = evidence.originalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Refresh custody timeline as an ACCESSED event was created
      fetchEvidenceDetails();
    } catch (err) {
      alert('Download error: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRecordAnalysis = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/evidence/${evidence.evidenceId}/analyze`, {
        notes: analysisNotes,
        toolUsed
      });
      if (res.data.success) {
        setIsAnalyzing(false);
        setAnalysisNotes('');
        fetchEvidenceDetails();
      }
    } catch (err) {
      alert('Failed to record analysis: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs">Loading evidence dossier...</div>;
  }

  if (error || !evidence) {
    return (
      <div className="p-8 text-center text-rose-400 text-xs">
        {error || 'Evidence not found'}
        <div className="mt-4">
          <Link to="/evidence" className="text-justice-400 hover:underline">
            Back to Evidence Vault
          </Link>
        </div>
      </div>
    );
  }

  const canTransfer = user?.role === 'ADMIN' || user?.role === 'OFFICER';
  const canAnalyze = user?.role === 'ADMIN' || user?.role === 'FORENSIC';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div>
        <Link
          to="/evidence"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Evidence Vault</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-justice-400 bg-justice-500/10 px-3 py-1 rounded-lg border border-justice-500/20">
                {evidence.evidenceId}
              </span>
              <StatusBadge status={evidence.status} size="md" />
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">
                {evidence.category}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{evidence.title}</h1>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>Original File: </span>
              <span className="font-mono text-slate-200 font-semibold">{evidence.originalFilename}</span>
              <span>•</span>
              <span>{(evidence.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
              <span>•</span>
              <span>{evidence.fileType}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownload}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
              title="Securely stream off-chain file"
            >
              <Download className="w-4 h-4 text-justice-400" />
              <span>Download File</span>
            </button>

            <button
              onClick={() => setIsVerifyOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold flex items-center gap-2 shadow-glow-success transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verify Hash</span>
            </button>

            {canTransfer && (
              <button
                onClick={() => setIsTransferOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                <span>Transfer Custody</span>
              </button>
            )}

            {canAnalyze && (
              <button
                onClick={() => setIsAnalyzing(!isAnalyzing)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Search className="w-4 h-4 text-amber-400" />
                <span>Record Analysis</span>
              </button>
            )}
          </div>
        </div>

        {/* Forensic Analysis Input Form Drawer */}
        {isAnalyzing && (
          <form onSubmit={handleRecordAnalysis} className="p-4 rounded-2xl bg-slate-850 border border-slate-700 space-y-3 animate-in fade-in duration-150">
            <div className="font-bold text-xs text-amber-400 flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span>Log Forensic Examination into Chain of Custody</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Forensic Software / Hardware Tool</label>
                <input
                  type="text"
                  value={toolUsed}
                  onChange={(e) => setToolUsed(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-justice-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Examination Findings & Methodology</label>
                <input
                  type="text"
                  value={analysisNotes}
                  onChange={(e) => setAnalysisNotes(e.target.value)}
                  required
                  placeholder="e.g. Frame-by-frame analysis, facial biometric match verified"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-justice-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAnalyzing(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm"
              >
                Log to Blockchain
              </button>
            </div>
          </form>
        )}

        {/* Cryptographic Proof Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Authoritative SHA-256 */}
          <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Authoritative SHA-256</span>
              <span className="text-emerald-400 font-bold">On-Chain</span>
            </div>
            <div className="font-mono text-xs text-slate-200 break-all select-all p-2 rounded-lg bg-slate-900 border border-slate-800">
              {evidence.sha256}
            </div>
            <p className="text-[10px] text-slate-500">
              Computed server-side from raw file stream. Immutable verification anchor.
            </p>
          </div>

          {/* Off-Chain IPFS CID */}
          <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Off-Chain Storage Locator</span>
              <span className="text-sky-400 font-bold">IPFS CID</span>
            </div>
            <div className="font-mono text-xs text-slate-200 break-all select-all p-2 rounded-lg bg-slate-900 border border-slate-800">
              {evidence.ipfsCid}
            </div>
            <p className="text-[10px] text-slate-500">
              Content-addressed locator for secure off-chain streaming retrieval.
            </p>
          </div>

          {/* Blockchain Attestation */}
          <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Polygon Amoy Attestation</span>
              <span className="text-purple-400 font-bold">Confirmed</span>
            </div>
            <div className="font-mono text-xs text-slate-200 break-all select-all p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="truncate">{evidence.blockchainTx}</span>
              <a
                href={`https://amoy.polygonscan.com/tx/${evidence.blockchainTx}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View on Polygonscan Amoy"
                className="text-justice-400 hover:text-justice-300 p-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[10px] text-slate-500">
              Transaction block: {evidence.blockNumber || 'Live'} • Network: Polygon Amoy (80002)
            </p>
          </div>
        </div>

        {/* Metadata Details Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Associated Case:</span>
            <Link
              to={`/cases/${evidence.caseNumber}`}
              className="font-bold text-justice-400 hover:underline flex items-center gap-1"
            >
              <span>{evidence.caseNumber}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Registered By:</span>
            <span className="font-semibold text-slate-200">
              {evidence.registeredBy?.name} ({evidence.registeredBy?.badgeNumber || 'Officer'})
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Current Physical Custodian:</span>
            <span className="font-semibold text-purple-300">
              {evidence.currentCustodian?.name} ({evidence.currentCustodian?.role})
            </span>
          </div>
        </div>
      </div>

      {/* Chain of Custody Timeline Section */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Cryptographic Chain of Custody Timeline</h2>
              <p className="text-xs text-slate-400">
                Chronological, tamper-evident record of all evidence state transitions
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {evidence.custodyHistory?.length || 0} Total Events Recorded
          </span>
        </div>

        <CustodyTimeline events={evidence.custodyHistory} />
      </div>

      {/* Verification Modal */}
      <VerificationModal
        isOpen={isVerifyOpen}
        onClose={() => setIsVerifyOpen(false)}
        evidence={evidence}
        onVerificationComplete={() => {
          fetchEvidenceDetails();
        }}
      />

      {/* Transfer Custody Modal */}
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        evidence={evidence}
        onTransferSuccess={() => {
          fetchEvidenceDetails();
        }}
      />
    </div>
  );
}
