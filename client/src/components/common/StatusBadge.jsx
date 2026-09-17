import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, ArrowRightLeft, Search, Archive } from 'lucide-react';

const statusConfig = {
  VERIFIED: {
    label: 'VERIFIED / HASH MATCH',
    bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
    dot: 'bg-emerald-400'
  },
  FLAGGED: {
    label: 'FAILED / HASH MISMATCH',
    bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    icon: AlertTriangle,
    dot: 'bg-rose-400 animate-pulse'
  },
  REGISTERED: {
    label: 'REGISTERED',
    bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    icon: Clock,
    dot: 'bg-sky-400'
  },
  IN_CUSTODY: {
    label: 'IN CUSTODY',
    bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    icon: Clock,
    dot: 'bg-indigo-400'
  },
  TRANSFERRED: {
    label: 'TRANSFERRED',
    bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    icon: ArrowRightLeft,
    dot: 'bg-purple-400'
  },
  UNDER_ANALYSIS: {
    label: 'UNDER ANALYSIS',
    bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: Search,
    dot: 'bg-amber-400'
  },
  ARCHIVED: {
    label: 'ARCHIVED',
    bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    icon: Archive,
    dot: 'bg-slate-400'
  }
};

export default function StatusBadge({ status, size = 'md', showIcon = true }) {
  const config = statusConfig[status] || statusConfig.REGISTERED;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm font-medium'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.bg} ${sizeClasses[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      <span>{config.label}</span>
    </span>
  );
}
