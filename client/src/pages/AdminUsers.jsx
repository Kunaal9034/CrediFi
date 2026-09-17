import React, { useState, useEffect } from 'react';
import { Users, Shield, Edit2, Check, X, AlertCircle } from 'lucide-react';
import api from '../services/api';
import RoleBadge from '../components/common/RoleBadge';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState(null);
  const [selectedRole, setSelectedRole] = useState('OFFICER');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/users');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (user) => {
    setEditingUserId(user._id);
    setSelectedRole(user.role);
  };

  const handleSaveRole = async (userId) => {
    try {
      const res = await api.put(`/admin/users/${userId}/role`, { role: selectedRole });
      if (res.data.success) {
        setUsers(users.map((u) => (u._id === userId ? { ...u, role: selectedRole } : u)));
        setEditingUserId(null);
      }
    } catch (err) {
      alert('Failed to update role: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Personnel & Access Control</h1>
          <p className="text-xs text-slate-400">
            Manage system roles, security clearance levels, and law enforcement badge credentials
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-2 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading personnel directory...</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="px-4 py-3">Personnel</th>
                  <th className="px-4 py-3">Official Email</th>
                  <th className="px-4 py-3">Badge / ID</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Current Role</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {users.map((u) => {
                  const isEditing = editingUserId === u._id;
                  return (
                    <tr key={u._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-200">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{u.email}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{u.badgeNumber || 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-400">{u.department}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200"
                          >
                            <option value="OFFICER">OFFICER</option>
                            <option value="FORENSIC">FORENSIC</option>
                            <option value="PROSECUTOR">PROSECUTOR</option>
                            <option value="JUDGE">JUDGE</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        ) : (
                          <RoleBadge role={u.role} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSaveRole(u._id)}
                              className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                              title="Save Role"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                            title="Edit Role"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
