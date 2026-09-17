import React, { useState, useEffect } from 'react';
import { UploadCloud, X, File, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import api from '../../services/api';
import HashDisplay from '../common/HashDisplay';

export default function EvidenceUploadModal({ isOpen, onClose, onUploadSuccess, preselectedCaseId = null }) {
  const [file, setFile] = useState(null);
  const [caseId, setCaseId] = useState(preselectedCaseId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CCTV_VIDEO');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchCases();
      if (preselectedCaseId) {
        setCaseId(preselectedCaseId);
      }
    } else {
      resetForm();
    }
  }, [isOpen, preselectedCaseId]);

  const fetchCases = async () => {
    try {
      const res = await api.get('/cases?status=ACTIVE');
      if (res.data.success) {
        setCases(res.data.data);
        if (!caseId && res.data.data.length > 0) {
          setCaseId(res.data.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setCategory('CCTV_VIDEO');
    setError(null);
    setSuccessData(null);
    setLoading(false);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      if (!title) {
        setTitle(e.dataTransfer.files[0].name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!title) {
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an evidence file to upload.');
      return;
    }
    if (!caseId) {
      setError('Please associate this evidence with an investigative case.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('caseId', caseId);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);

      const res = await api.post('/evidence', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setSuccessData(res.data.data);
        if (onUploadSuccess) onUploadSuccess(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Evidence upload failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-justice-500/10 border border-justice-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-justice-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Register Digital Evidence</h3>
              <p className="text-xs text-slate-400">Cryptographic hashing & on-chain provenance registration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successData ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-bold text-sm">Evidence Registered Successfully!</div>
                  <div className="text-xs text-emerald-400/90">
                    Authoritative SHA-256 computed on backend & anchored to Polygon Amoy.
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Evidence ID:</span>
                  <span className="font-bold text-slate-200">{successData.evidenceId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Case Number:</span>
                  <span className="font-mono text-slate-200">{successData.caseNumber}</span>
                </div>
                <div className="py-1 border-b border-slate-800 space-y-1">
                  <span className="text-slate-400 block">SHA-256 Digest (On-Chain):</span>
                  <HashDisplay hash={successData.sha256} truncate={false} />
                </div>
                <div className="py-1 border-b border-slate-800 space-y-1">
                  <span className="text-slate-400 block">Off-Chain IPFS CID:</span>
                  <HashDisplay hash={successData.ipfsCid} truncate={false} isCid={true} />
                </div>
                <div className="py-1 space-y-1">
                  <span className="text-slate-400 block">Blockchain Transaction:</span>
                  <HashDisplay hash={successData.blockchainTx} isTx={true} truncate={false} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-justice-600 hover:bg-justice-500 text-white font-semibold text-xs shadow-glow transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* File Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  file
                    ? 'border-justice-500/50 bg-justice-500/5'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-850/50'
                }`}
              >
                {file ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="flex items-center gap-3 truncate">
                      <File className="w-6 h-6 text-justice-400 shrink-0" />
                      <div className="text-left truncate">
                        <div className="text-xs font-semibold text-slate-200 truncate">{file.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'Unknown Type'}
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
                    <UploadCloud className="w-10 h-10 mx-auto text-slate-500 mb-2" />
                    <div className="text-xs font-semibold text-slate-200">
                      Drag & Drop evidence file here, or{' '}
                      <label className="text-justice-400 hover:underline cursor-pointer">
                        browse
                        <input
                          type="file"
                          onChange={handleFileSelect}
                          className="hidden"
                          accept="video/*,image/*,audio/*,.pdf,.doc,.docx,.zip"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Supports CCTV MP4, Photos, Audio recordings, Forensic PDFs (Max 500MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Case Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Investigative Case Association *
                </label>
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
                >
                  <option value="">-- Select Case --</option>
                  {cases.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.caseId} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Evidence Title / Identifier *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Subterranean Vault CCTV Camera 02"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
                  >
                    <option value="CCTV_VIDEO">CCTV Video Footage</option>
                    <option value="AUDIO_RECORDING">Audio Recording</option>
                    <option value="DIGITAL_IMAGE">Digital Crime Scene Photo</option>
                    <option value="FORENSIC_DOCUMENT">Forensic Document / Report</option>
                    <option value="DATA_DUMP">Memory / Disk Data Dump</option>
                    <option value="OTHER">Other Permitted Evidence</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Evidentiary Description & Chain of Custody Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details on collection location, extraction hardware, or forensic notes..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500 resize-none"
                />
              </div>

              {/* Technical Invariant Notice */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Shield className="w-4 h-4 text-justice-400 shrink-0 mt-0.5" />
                <span>
                  The authoritative SHA-256 hash is computed by the server during upload. Raw evidence is pinned to off-chain IPFS; only the cryptographic hash is written to Polygon Amoy.
                </span>
              </div>

              {/* Submit Buttons */}
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-justice-600 to-justice-500 hover:from-justice-500 hover:to-justice-400 text-white font-semibold text-xs shadow-glow transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Calculating Hash & Registering On-Chain...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Register Evidence</span>
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
