import React, { useState } from 'react';
import { ShieldCheck, X, File, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import HashDisplay from '../common/HashDisplay';

export default function VerificationModal({ isOpen, onClose, evidence, onVerificationComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!isOpen || !evidence) return null;

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please provide a file to cryptographically verify');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post(`/evidence/${evidence.evidenceId}/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setResult(res.data.verificationResult);
        if (onVerificationComplete) {
          onVerificationComplete(res.data.verificationResult);
        }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Cryptographic Evidence Verification</h3>
              <p className="text-xs text-slate-400">
                Recalculate SHA-256 against Polygon Amoy on-chain record for {evidence.evidenceId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Registered Hash Context */}
          <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">Registered Target:</span>
              <span className="font-bold text-slate-200">
                {evidence.evidenceId} ({evidence.originalFilename})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Immutable Hash:</span>
              <HashDisplay hash={evidence.sha256} truncate={false} />
            </div>
          </div>

          {result ? (
            <div className="space-y-4 py-2">
              {/* Massive Result Banner */}
              <div
                className={`p-6 rounded-2xl border text-center space-y-2 shadow-2xl transition-all ${
                  result.isMatch
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-glow-success'
                    : 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-glow-danger'
                }`}
              >
                <div className="flex justify-center">
                  {result.isMatch ? (
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center">
                      <AlertTriangle className="w-10 h-10 text-rose-400 animate-pulse" />
                    </div>
                  )}
                </div>
                <h4 className="text-xl font-extrabold tracking-wide uppercase">
                  {result.status} — {result.badge}
                </h4>
                <p className="text-xs max-w-md mx-auto opacity-90 leading-relaxed">{result.message}</p>
              </div>

              {/* Side-by-Side Hash Comparison */}
              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3 text-xs">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Cryptographic Verification Digest Comparison:
                </div>

                <div className="space-y-2 font-mono">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Original On-Chain Digest:</span>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 select-all break-all">
                      {result.originalHash}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">Recalculated Upload Digest:</span>
                    <div
                      className={`p-2.5 rounded-lg border select-all break-all ${
                        result.isMatch
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {result.recalculatedHash}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Verified by: {result.verifiedBy?.name} ({result.verifiedBy?.role})</span>
                  <span>{new Date(result.verifiedAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Verify Another File</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-justice-600 hover:bg-justice-500 text-white font-semibold text-xs transition-all shadow-glow"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  file
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-850/50'
                }`}
              >
                {file ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="flex items-center gap-3 truncate">
                      <File className="w-6 h-6 text-emerald-400 shrink-0" />
                      <div className="text-left truncate">
                        <div className="text-xs font-semibold text-slate-200 truncate">{file.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500/60 mb-2" />
                    <div className="text-xs font-semibold text-slate-200">
                      Upload evidence file to verify cryptographic integrity
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Drag and drop the file, or{' '}
                      <label className="text-justice-400 hover:underline cursor-pointer">
                        browse
                        <input
                          type="file"
                          onChange={(e) => e.target.files && setFile(e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-300">How Verification Works: </span>
                The backend will ingest the raw binary stream of the file and compute its SHA-256 digest in real-time. It then checks this digest directly against the immutable smart contract record on Polygon Amoy.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !file}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs shadow-glow-success transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Recalculating & Comparing on Amoy...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify File Hash</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
