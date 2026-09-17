import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck2,
  Plus,
  Search,
  Filter,
  Download,
  ShieldCheck,
  Eye,
  ExternalLink,
  Layers
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import HashDisplay from '../components/common/HashDisplay';
import EvidenceUploadModal from '../components/evidence/EvidenceUploadModal';

export default function EvidenceList() {
  const { user } = useAuth();
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEffect(() => {
    fetchEvidence();
  }, [categoryFilter, statusFilter]);

  const fetchEvidence = async () => {
    try {
      setLoading(true);
      let query = '';
      if (categoryFilter) query += `category=${categoryFilter}&`;
      if (statusFilter) query += `status=${statusFilter}&`;
      if (search) query += `search=${encodeURIComponent(search)}&`;

      const res = await api.get(`/evidence?${query}`);
      if (res.data.success) {
        setEvidenceList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEvidence();
  };

  const canUpload = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Digital Evidence Vault</h1>
          <p className="text-xs text-slate-400">
            Immutable digital evidence registry secured with SHA-256 and Polygon Amoy smart contracts
          </p>
        </div>

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

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Evidence ID, filename, SHA-256..."
            className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-justice-500"
          >
            <option value="">All Categories</option>
            <option value="CCTV_VIDEO">CCTV Video</option>
            <option value="AUDIO_RECORDING">Audio</option>
            <option value="DIGITAL_IMAGE">Digital Image</option>
            <option value="FORENSIC_DOCUMENT">Forensic Document</option>
            <option value="DATA_DUMP">Data Dump</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-justice-500"
          >
            <option value="">All Statuses</option>
            <option value="REGISTERED">Registered</option>
            <option value="IN_CUSTODY">In Custody</option>
            <option value="TRANSFERRED">Transferred</option>
            <option value="UNDER_ANALYSIS">Under Analysis</option>
            <option value="VERIFIED">Verified</option>
            <option value="FLAGGED">Flagged (Mismatch)</option>
          </select>
        </div>
      </div>

      {/* Evidence Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-2 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading evidence registry...</div>
          ) : evidenceList.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="px-4 py-3">Evidence ID</th>
                  <th className="px-4 py-3">Title & Original File</th>
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Integrity Status</th>
                  <th className="px-4 py-3">On-Chain Digest (SHA-256)</th>
                  <th className="px-4 py-3">Current Custodian</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {evidenceList.map((ev) => (
                  <tr key={ev._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-justice-300">
                      <Link to={`/evidence/${ev.evidenceId}`} className="hover:underline">
                        {ev.evidenceId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">{ev.title}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                        {ev.originalFilename} ({(ev.fileSize / (1024 * 1024)).toFixed(2)} MB)
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      <Link to={`/cases/${ev.caseNumber}`} className="hover:underline hover:text-justice-400">
                        {ev.caseNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{ev.category}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ev.status} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <HashDisplay hash={ev.sha256} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">{ev.currentCustodian?.name || 'Assigned Officer'}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/evidence/${ev.evidenceId}`}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-16 text-center text-slate-500 text-xs">
              No digital evidence items found matching the selected filters.
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <EvidenceUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          setIsUploadOpen(false);
          fetchEvidence();
        }}
      />
    </div>
  );
}
