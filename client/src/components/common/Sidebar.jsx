import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  FileCheck2,
  ShieldCheck,
  Users,
  ScrollText,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import RoleBadge from './RoleBadge';

export default function Sidebar() {
  const { user } = useAuth();
  const role = user?.role || 'OFFICER';

  const navItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'OFFICER', 'FORENSIC', 'PROSECUTOR', 'JUDGE']
    },
    {
      label: 'Investigative Cases',
      path: '/cases',
      icon: Briefcase,
      roles: ['ADMIN', 'OFFICER', 'FORENSIC', 'PROSECUTOR', 'JUDGE']
    },
    {
      label: 'Evidence Vault',
      path: '/evidence',
      icon: FileCheck2,
      roles: ['ADMIN', 'OFFICER', 'FORENSIC', 'PROSECUTOR', 'JUDGE']
    },
    {
      label: 'Verification Studio',
      path: '/verify',
      icon: ShieldCheck,
      roles: ['ADMIN', 'OFFICER', 'FORENSIC', 'PROSECUTOR', 'JUDGE'],
      highlight: true
    },
    {
      label: 'Personnel & Roles',
      path: '/admin/users',
      icon: Users,
      roles: ['ADMIN']
    },
    {
      label: 'Audit Trail',
      path: '/admin/audit',
      icon: ScrollText,
      roles: ['ADMIN']
    }
  ];

  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-6">
        {/* User Card */}
        <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Active Security Clearance
          </div>
          <div className="font-semibold text-sm text-slate-200 truncate">{user?.name}</div>
          <div>
            <RoleBadge role={role} />
          </div>
          <div className="text-[11px] text-slate-400 truncate pt-1 border-t border-slate-800/80">
            {user?.department}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? item.highlight
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-glow-success'
                        : 'bg-justice-600 text-white shadow-glow'
                      : item.highlight
                      ? 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* System Invariant Footer Note */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
          <span>Cryptographic Guarantees</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          SHA-256 on-chain attestation guarantees tamper-evident provenance. Raw files remain off-chain.
        </p>
      </div>
    </aside>
  );
}
