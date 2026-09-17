import React from 'react';
import { ShieldAlert, Shield, Microscope, Scale, Gavel } from 'lucide-react';

const roleConfig = {
  ADMIN: {
    label: 'ADMIN',
    bg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    icon: ShieldAlert
  },
  OFFICER: {
    label: 'POLICE OFFICER',
    bg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    icon: Shield
  },
  FORENSIC: {
    label: 'FORENSIC SPECIALIST',
    bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    icon: Microscope
  },
  PROSECUTOR: {
    label: 'PROSECUTOR',
    bg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    icon: Scale
  },
  JUDGE: {
    label: 'JUDGE / MAGISTRATE',
    bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    icon: Gavel
  }
};

export default function RoleBadge({ role }) {
  const config = roleConfig[role] || roleConfig.OFFICER;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold tracking-wider rounded-md border ${config.bg}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
    </span>
  );
}
