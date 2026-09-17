import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, X, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function TransferModal({ isOpen, onClose, evidence, onTransferSuccess }) {
  const [users, setUsers] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    } else {
      setRecipientId('');
      setReason('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      if (res.data.success) {
        setUsers(res.data.data);
        if (res.data.data.length > 0) {
          setRecipientId(res.data.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load recipient personnel:', err);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!recipientId || !reason) {
      setError('Please select a recipient and provide a transfer reason.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await api.post(`/evidence/${evidence.evidenceId}/transfer`, {
        recipientUserId: recipientId,
        reason,
        notes
      });

      if (res.data.success) {
        if (onTransferSuccess) onTransferSuccess(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !evidence) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Transfer Custody</h3>
              <p className="text-xs text-slate-400">Record chain of custody transfer for {evidence.evidenceId}</p>
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
        <form onSubmit={handleTransfer} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Recipient Personnel (New Custodian) *
            </label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
            >
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} — {u.role} ({u.department || u.badgeNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Official Custody Transfer Reason *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="e.g. Transferred to Cyber Forensics Unit for audio extraction"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Additional Custodial Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hardware serials, protective anti-static bag ID, transport seals..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-justice-500 resize-none"
            />
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
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all flex items-center gap-2"
            >
              {loading ? 'Recording On-Chain...' : 'Confirm Custody Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
