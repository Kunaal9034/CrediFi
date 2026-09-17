import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Plus, Search, Filter, Calendar, FolderCheck, X, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function CasesList() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Case Form state
  const [newCaseId, setNewCaseId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIncidentDate, setNewIncidentDate] = useState('');
  const [createError, setCreateError] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchCases();
  }, [statusFilter]);

  const fetchCases = async () => {
    try {
      setLoading(true);
      let query = '';
      if (statusFilter) query += `status=${statusFilter}&`;
      if (search) query += `search=${encodeURIComponent(search)}&`;

      const res = await api.get(`/cases?${query}`);
      if (res.data.success) {
        setCases(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCases();
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      setCreateError(null);

      const res = await api.post('/cases', {
        caseId: newCaseId,
        title: newTitle,
        description: newDescription,
        incidentDate: newIncidentDate || undefined
      });

      if (res.data.success) {
        setIsCreateModalOpen(false);
        setNewCaseId('');
        setNewTitle('');
        setNewDescription('');
        setNewIncidentDate('');
        fetchCases();
      }
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message || 'Failed to create case');
    } finally {
      setCreateLoading(false);
    }
  };

  const canCreate = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Investigative Cases</h1>
          <p className="text-xs text-slate-400">
            Active and archived criminal and forensic cases with digital evidence tracking
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-justice-600 to-justice-500 hover:from-justice-500 hover:to-justice-400 text-white text-xs font-semibold flex items-center gap-2 shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Case</span>
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
            placeholder="Search by Case ID, title, description..."
            className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-justice-500"
          >
            <option value="">All Case Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Cases Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Loading investigative dossiers...</div>
      ) : cases.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cases.map((c) => (
            <Link
              key={c._id}
              to={`/cases/${c.caseId}`}
              className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-justice-500/40 transition-all flex flex-col justify-between group shadow-sm hover:shadow-glow space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-justice-400 bg-justice-500/10 px-2.5 py-1 rounded-md border border-justice-500/20">
                    {c.caseId}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      c.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-100 group-hover:text-justice-300 transition-colors line-clamp-1">
                  {c.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{c.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1">
                  <FolderCheck className="w-3.5 h-3.5 text-justice-400" />
                  <span>{c.evidenceCount || 0} Evidence Files</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-16 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
          No cases found matching the criteria. Click 'Create New Case' to initialize a new investigative dossier.
        </div>
      )}

      {/* Create Case Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-justice-400" />
                <h3 className="text-base font-bold text-slate-100">Create Investigative Case</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Case Identifier (Unique) *
                </label>
                <input
                  type="text"
                  value={newCaseId}
                  onChange={(e) => setNewCaseId(e.target.value)}
                  required
                  placeholder="e.g. CASE-2026-001"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Case Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="e.g. Downtown Jewelry Vault Burglary"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Incident Date</label>
                <input
                  type="date"
                  value={newIncidentDate}
                  onChange={(e) => setNewIncidentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Investigative Summary & Description *
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                  placeholder="Summary of incident, location, suspected timeline, and evidentiary scope..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createLoading}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-justice-600 to-justice-500 hover:from-justice-500 hover:to-justice-400 text-white font-semibold text-xs transition-all shadow-glow flex items-center gap-2"
                >
                  {createLoading ? 'Creating Dossier...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
