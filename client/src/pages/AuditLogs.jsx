import React, { useState, useEffect } from 'react';
import { ScrollText, Filter, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import api from '../services/api';
import HashDisplay from '../components/common/HashDisplay';
import RoleBadge from '../components/common/RoleBadge';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, statusFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = '';
      if (actionFilter) query += `action=${actionFilter}&`;
      if (statusFilter) query += `status=${statusFilter}&`;

      const res = await api.get(`/admin/audit?${query}`);
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">System Audit Trail</h1>
          <p className="text-xs text-slate-400">
            Immutable log of all user authentication, evidence downloads, custody modifications, and on-chain interactions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-justice-500"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
          </select>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-2 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading audit records...</div>
          ) : logs.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor / Officer</th>
                  <th className="px-4 py-3">Resource Type</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">IP / Client</th>
                  <th className="px-4 py-3">Blockchain Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.map((log) => {
                  const isSuccess = log.status === 'SUCCESS';
                  return (
                    <tr key={log._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-200">{log.action}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{log.actor?.name || log.actorEmail}</div>
                        <div className="text-[10px] text-slate-400">{log.actorRole}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{log.resourceType}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="px-4 py-3">
                        {log.blockchainTx ? (
                          <HashDisplay hash={log.blockchainTx} isTx={true} truncate={true} />
                        ) : (
                          <span className="text-slate-600 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-16 text-center text-slate-500 text-xs">No audit logs found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
