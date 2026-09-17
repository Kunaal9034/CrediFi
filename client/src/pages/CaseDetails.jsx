import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Briefcase,
  FileCheck2,
  Calendar,
  User,
  Plus,
  ArrowLeft,
  ShieldCheck,
  Download,
  AlertTriangle,
  Clock
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import HashDisplay from '../components/common/HashDisplay';
import EvidenceUploadModal from '../components/evidence/EvidenceUploadModal';

export default function CaseDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEffect(() => {
    fetchCaseDetails();
  }, [id]);

  const fetchCaseDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/cases/${id}`);
      if (res.data.success) {
        setCaseData(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load case');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await api.put(`/cases/${caseData.caseId}`, { status: newStatus });
      if (res.data.success) {
        setCaseData({ ...caseData, status: newStatus });
      }
    } catch (err) {
      alert('Failed to update case status: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs">Loading case dossier...</div>;
  }

  if (error || !caseData) {
    return (
      <div className="p-8 text-center text-rose-400 text-xs">
        {error || 'Case not found'}
        <div className="mt-4">
          <Link to="/cases" className="text-justice-400 hover:underline">
            Back to Cases
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div>
        <Link
          to="/cases"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Cases</span>
        </Link>
      </div>

      {/* Case Header Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-justice-400 bg-justice-500/10 px-3 py-1 rounded-md border border-justice-500/20">
                {caseData.caseId}
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  caseData.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {caseData.status}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{caseData.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {canEdit && (
              <div className="flex items-center gap-2">
                <select
                  value={caseData.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-justice-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>

                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-justice-600 to-justice-500 hover:from-justice-500 hover:to-justice-400 text-white text-xs font-semibold flex items-center gap-2 shadow-glow transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Attach Evidence</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-300 leading-relaxed max-w-4xl bg-slate-850/60 p-4 rounded-xl border border-slate-800/80">
          {caseData.description}
        </p>

        {/* Metadata Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <User className="w-4 h-4 text-slate-500" />
            <span>Lead Officer: </span>
            <span className="font-semibold text-slate-200">
              {caseData.createdBy?.name} ({caseData.createdBy?.badgeNumber || 'Officer'})
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 font-mono">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Incident Date: </span>
            <span className="font-semibold text-slate-200">
              {caseData.incidentDate ? new Date(caseData.incidentDate).toLocaleDateString() : 'Unspecified'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Registered On: </span>
            <span className="font-semibold text-slate-200">
              {new Date(caseData.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Associated Evidence Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden space-y-2">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-850/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-justice-400" />
            <h2 className="font-bold text-sm text-slate-200">
              Attached Digital Evidence ({caseData.evidenceList?.length || 0})
            </h2>
          </div>
        </div>

        <div className="p-2 overflow-x-auto">
          {caseData.evidenceList && caseData.evidenceList.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="px-4 py-3">Evidence ID</th>
                  <th className="px-4 py-3">Title & Filename</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SHA-256 Digest</th>
                  <th className="px-4 py-3">Custodian</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {caseData.evidenceList.map((ev) => (
                  <tr key={ev._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-justice-300">
                      <Link to={`/evidence/${ev.evidenceId}`} className="hover:underline">
                        {ev.evidenceId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">{ev.title}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{ev.originalFilename}</div>
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
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              No digital evidence attached to this case yet.{' '}
              {canEdit && (
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="text-justice-400 hover:underline font-semibold"
                >
                  Upload first evidence file
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Evidence Modal with preselected case */}
      <EvidenceUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        preselectedCaseId={caseData._id}
        onUploadSuccess={() => {
          setIsUploadOpen(false);
          fetchCaseDetails();
        }}
      />
    </div>
  );
}
