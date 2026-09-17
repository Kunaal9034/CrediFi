import React from 'react';
import {
  Clock,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  User,
  ArrowRight
} from 'lucide-react';
import HashDisplay from '../common/HashDisplay';
import RoleBadge from '../common/RoleBadge';

const actionIcons = {
  REGISTERED: { icon: FileCheck, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  ACCESSED: { icon: Clock, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  TRANSFERRED: { icon: ArrowRightLeft, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  ANALYZED: { icon: Search, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  VERIFIED: { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  FLAGGED: { icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
};

export default function CustodyTimeline({ events = [] }) {
  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl">
        No chain of custody records found.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
      {events.map((evt, idx) => {
        const actionConf = actionIcons[evt.action] || actionIcons.REGISTERED;
        const Icon = actionConf.icon;
        const dateStr = new Date(evt.timestamp).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'medium'
        });

        return (
          <div key={evt._id || idx} className="relative group">
            {/* Action Node Dot */}
            <div
              className={`absolute -left-6 top-1 w-6 h-6 rounded-full flex items-center justify-center border shadow-sm ${actionConf.color} z-10 transition-transform group-hover:scale-110`}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>

            {/* Event Card */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5">
              {/* Header: Action + Timestamp */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-100 tracking-wide">
                    {evt.action}
                  </span>
                  <RoleBadge role={evt.actorRole || evt.actor?.role} />
                </div>
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {dateStr}
                </span>
              </div>

              {/* Actor & Transfer Flow */}
              <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                <span className="text-slate-400">Recorded By:</span>
                <span className="font-medium text-slate-200">
                  {evt.actor?.name || 'Authorized Officer'}
                </span>

                {evt.fromUser && evt.toUser && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs">
                    <span>{evt.fromUser?.name || 'Previous Custodian'}</span>
                    <ArrowRight className="w-3 h-3 text-justice-400" />
                    <span className="text-justice-300 font-semibold">{evt.toUser?.name || 'New Custodian'}</span>
                  </div>
                )}
              </div>

              {/* Reason / Notes */}
              {evt.reason && (
                <div className="text-xs text-slate-300 bg-slate-850/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 font-semibold">Details: </span>
                  {evt.reason}
                </div>
              )}

              {/* Verification Details if present */}
              {evt.verificationDetails && evt.verificationDetails.isMatch !== undefined && (
                <div
                  className={`p-2.5 rounded-lg text-xs border ${
                    evt.verificationDetails.isMatch
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="font-bold mb-1">
                    {evt.verificationDetails.isMatch
                      ? '✓ Cryptographic Hash Verification Succeeded'
                      : '✗ Cryptographic Hash Mismatch Detected!'}
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[11px] font-mono">
                    <div>Recalculated: {evt.verificationDetails.computedHash}</div>
                    <div>Blockchain:   {evt.verificationDetails.blockchainHash}</div>
                  </div>
                </div>
              )}

              {/* Blockchain Transaction Hash */}
              {evt.blockchainTx && (
                <div className="pt-1 flex items-center justify-between">
                  <HashDisplay hash={evt.blockchainTx} isTx={true} label="On-Chain Tx" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
