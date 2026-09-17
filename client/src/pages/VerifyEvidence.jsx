import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  UploadCloud,
  File,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Shield,
  HelpCircle
} from 'lucide-react';
import api from '../services/api';
import HashDisplay from '../components/common/HashDisplay';
import StatusBadge from '../components/common/StatusBadge';

export default function VerifyEvidence() {
  const [evidenceList, setEvidenceList] = useState([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvidenceList();
  }, []);

  const fetchEvidenceList = async () => {
    try {
      const res = await api.get('/evidence');
      if (res.data.success) {
        setEvidenceList(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedEvidenceId(res.data.data[0].evidenceId);
          setSelectedEvidence(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load evidence for verification:', err);
    }
  };

  const handleSelectEvidence = (evId) => {
    setSelectedEvidenceId(evId);
    const ev = evidenceList.find((item) => item.evidenceId === evId);
    setSelectedEvidence(ev || null);
    setFile(null);
    setResult(null);
    setError(null);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!selectedEvidence) {
      setError('Please select an evidence record from the vault to verify.');
      return;
    }
    if (!file) {
      setError('Please drop or select a file to cryptographically verify.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post(`/evidence/${selectedEvidence.evidenceId}/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setResult(res.data.verificationResult);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Evidence Verification Studio</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              Cryptographic Proof
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Recalculate SHA-256 digest from submitted file and verify against immutable Polygon Amoy on-chain record
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Select Evidence Record (1 Col) */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">1. Select Evidence Target</h2>
            <span className="text-xs text-slate-400">{evidenceList.length} In Vault</span>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {evidenceList.map((ev) => {
              const isSelected = ev.evidenceId === selectedEvidenceId;
              return (
                <button
                  key={ev._id}
                  type="button"
                  onClick={() => handleSelectEvidence(ev.evidenceId)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all text-xs space-y-2 ${
                    isSelected
                      ? 'bg-justice-500/10 border-justice-500/50 shadow-glow'
                      : 'bg-slate-850/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-justice-300 font-mono">{ev.evidenceId}</span>
                    <StatusBadge status={ev.status} size="sm" showIcon={false} />
                  </div>
                  <div className="font-semibold text-slate-200 line-clamp-1">{ev.title}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {ev.caseNumber} • {ev.originalFilename}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Verification Sandbox (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedEvidence ? (
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
              {/* Selected Target Banner */}
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Target:</span>
                    <span className="font-mono text-sm font-bold text-justice-400">{selectedEvidence.evidenceId}</span>
                    <span className="text-slate-300 font-medium text-xs">({selectedEvidence.title})</span>
                  </div>
                  <StatusBadge status={selectedEvidence.status} size="sm" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Original On-Chain SHA-256:</span>
                    <HashDisplay hash={selectedEvidence.sha256} truncate={true} />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Amoy Transaction:</span>
                    <HashDisplay hash={selectedEvidence.blockchainTx} isTx={true} truncate={true} />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {result ? (
                /* Verification Result Display */
                <div className="space-y-6 py-2">
                  {/* Huge Result Banner */}
                  <div
                    className={`p-8 rounded-3xl border text-center space-y-3 shadow-2xl transition-all ${
                      result.isMatch
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-glow-success'
                        : 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-glow-danger'
                    }`}
                  >
                    <div className="flex justify-center">
                      {result.isMatch ? (
                        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center">
                          <AlertTriangle className="w-12 h-12 text-rose-400 animate-pulse" />
                        </div>
                      )}
                    </div>
                    <h3 className="text-2xl font-black tracking-wide uppercase">
                      {result.status} — {result.badge}
                    </h3>
                    <p className="text-sm max-w-lg mx-auto opacity-95 leading-relaxed">{result.message}</p>
                  </div>

                  {/* Hash Comparison Matrix */}
                  <div className="p-6 rounded-2xl bg-slate-850 border border-slate-800 space-y-4">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Authoritative Cryptographic Digest Comparison
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px] block mb-1">
                          Original Immutable Blockchain Hash (Polygon Amoy):
                        </span>
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 select-all break-all">
                          {result.originalHash}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block mb-1">
                          Recalculated Upload SHA-256 Digest:
                        </span>
                        <div
                          className={`p-3 rounded-xl border select-all break-all ${
                            result.isMatch
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {result.recalculatedHash}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400">
                      <span>Verified by: {result.verifiedBy?.name} ({result.verifiedBy?.role})</span>
                      <span>Verified at: {new Date(result.verifiedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Reset Button */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Verify Another File</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Upload Dropzone Form */
                <form onSubmit={handleVerify} className="space-y-5">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all ${
                      file
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-850/40'
                    }`}
                  >
                    {file ? (
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800 border border-slate-700">
                        <div className="flex items-center gap-3 truncate">
                          <File className="w-8 h-8 text-emerald-400 shrink-0" />
                          <div className="text-left truncate">
                            <div className="text-sm font-bold text-slate-100 truncate">{file.name}</div>
                            <div className="text-xs text-slate-400">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ShieldCheck className="w-12 h-12 mx-auto text-emerald-400/70" />
                        <div className="text-sm font-bold text-slate-200">
                          Drop the evidence file here to verify its cryptographic integrity
                        </div>
                        <p className="text-xs text-slate-400">
                          Supports original or test files to evaluate hash matching vs tampering detection.
                        </p>
                        <div className="pt-2">
                          <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-colors inline-block border border-slate-700">
                            Select File from Disk
                            <input
                              type="file"
                              onChange={(e) => e.target.files && setFile(e.target.files[0])}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-850/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
                    <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-justice-400" />
                      <span>Hackathon Demonstration Tip:</span>
                    </div>
                    <p className="leading-relaxed">
                      1. To demonstrate <strong>VERIFIED / HASH MATCH</strong>: Upload the exact identical file originally registered.<br />
                      2. To demonstrate <strong>FAILED / HASH MISMATCH</strong>: Open the file in a text or hex editor, alter a single byte or character, save, and upload here.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading || !file}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-glow-success transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Recalculating SHA-256 & Querying Blockchain...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Run Cryptographic Verification</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="glass-panel p-16 rounded-3xl border border-slate-800 text-center text-slate-500 text-xs">
              Select an evidence item from the left panel to begin verification.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
