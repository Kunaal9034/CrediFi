import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { formatUSDC, formatAPR } from '../utils/formatters';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  CheckCircle,
  ShieldCheck,
  RefreshCw,
  Clock,
  Coins,
  Layers,
  Info,
} from 'lucide-react';

const DEFAULT_STATS = {
  totalUsers: 0,
  totalLoans: 0,
  totalVolume: '0',
  totalLent: '0',
  totalRepaid: '0',
  totalInterest: '0',
  activeLoans: 0,
  completedLoans: 0,
  repaidLoans: 0,
  defaultedLoans: 0,
  repaymentRate: 100,
  defaultRate: 0,
  averageLoanAmount: '0',
  averageInterestRate: 0,
  averageDurationDays: 0,
};

const DEFAULT_VOLUME_HISTORY = [
  { period: 'Wk 1', volumeFormatted: 0, cumulativeVolume: 0, loanCount: 0 },
  { period: 'Wk 2', volumeFormatted: 0, cumulativeVolume: 0, loanCount: 0 },
  { period: 'Wk 3', volumeFormatted: 0, cumulativeVolume: 0, loanCount: 0 },
  { period: 'Wk 4', volumeFormatted: 0, cumulativeVolume: 0, loanCount: 0 },
  { period: 'Wk 5', volumeFormatted: 0, cumulativeVolume: 0, loanCount: 0 },
];

const DEFAULT_CREDIT_DISTRIBUTION = {
  poor: 0,
  fair: 0,
  good: 0,
  excellent: 0,
};

export default function Analytics() {
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [volumeHistory, setVolumeHistory] = useState(DEFAULT_VOLUME_HISTORY);
  const [creditDist, setCreditDist] = useState(DEFAULT_CREDIT_DISTRIBUTION);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchStats = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = await api.getAnalytics(forceRefresh ? { refresh: 'true' } : {});
      if (res && res.stats && Object.keys(res.stats).length > 0) {
        setStats({
          ...DEFAULT_STATS,
          ...res.stats,
        });
      }
      if (res && res.volumeHistory && res.volumeHistory.length > 0) {
        setVolumeHistory(res.volumeHistory);
      }
      if (res && res.creditScoreDistribution) {
        setCreditDist(res.creditScoreDistribution);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('[Analytics] API query failed, using protocol baseline:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Visual chart datasets
  const statusData = [
    { name: 'Repaid', value: Number(stats.completedLoans || stats.repaidLoans || 0), color: '#10b981' },
    { name: 'Active', value: Number(stats.activeLoans || 0), color: '#00d2ff' },
    { name: 'Defaulted', value: Number(stats.defaultedLoans || 0), color: '#f43f5e' },
  ];

  const creditTierData = [
    { tier: 'Poor (300-579)', count: creditDist.poor || 0, color: '#f59e0b' },
    { tier: 'Fair (580-669)', count: creditDist.fair || 0, color: '#3b82f6' },
    { tier: 'Good (670-739)', count: creditDist.good || 0, color: '#00d2ff' },
    { tier: 'Excellent (740+)', count: creditDist.excellent || 0, color: '#10b981' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              Macro Protocol Insights
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              Sepolia Indexed View
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
            Protocol Analytics & Performance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time offchain aggregation synchronized with verified Ethereum Sepolia event logs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {lastRefreshed && (
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline-block">
              Refreshed {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchStats(true)}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Analytics'}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (8 metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
        <div className="p-3.5 rounded-xl glass-panel border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">Total Volume</span>
            <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-lg font-bold font-mono text-cyan-400">
            ${formatUSDC(stats.totalVolume, 0)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">Total Loans</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <span className="text-lg font-bold font-mono text-white">{stats.totalLoans}</span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">Total Repaid</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-lg font-bold font-mono text-emerald-400">
            ${formatUSDC(stats.totalRepaid || stats.totalLent, 0)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">Interest Yield</span>
            <Coins className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-lg font-bold font-mono text-purple-400">
            ${formatUSDC(stats.totalInterest, 0)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">Repayment</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-lg font-bold font-mono text-emerald-400">
            {stats.repaymentRate}%
          </span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">Borrowers</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <span className="text-lg font-bold font-mono text-white">{stats.totalUsers}</span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">Avg Loan</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <span className="text-lg font-bold font-mono text-white">
            ${formatUSDC(stats.averageLoanAmount, 0)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">Avg APR • Term</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <span className="text-sm font-bold font-mono text-blue-400">
            {formatAPR(stats.averageInterestRate)} • {stats.averageDurationDays || 14}d
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Cumulative Lending Volume Trend */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Cumulative Lending Volume Trend</h3>
              <p className="text-xs text-slate-400">Historical MockUSDC loan disbursements indexed across Sepolia</p>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
              USD (USDC)
            </span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeHistory}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d2ff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00d2ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                  formatter={(val) => [`$${Number(val).toLocaleString()} USDC`, 'Cumulative Volume']}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeVolume"
                  stroke="#00d2ff"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#volumeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loan Settlement Health (Donut) */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800">
          <h3 className="text-sm font-bold text-white mb-1">Loan Settlement Health</h3>
          <p className="text-xs text-slate-400 mb-4">Ratio of loans funded, successfully repaid, and defaulted</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={6}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(val, name) => [`${val} Loans`, name]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Second Row Charts: Credit Tier Distribution & Protocol Architecture */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Credit Score Distribution */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Borrower Credit Score Distribution</h3>
              <p className="text-xs text-slate-400">Onchain credit tier segments across indexed borrower profiles</p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              Range: 300 – 850
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={creditTierData}>
                <XAxis dataKey="tier" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(val) => [`${val} Borrowers`, 'Count']}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {creditTierData.map((entry, index) => (
                    <Cell key={`tier-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Protocol Invariant Guarantee Notice */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-2">Decentralized Financial Authority</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              CrediFi operates on a strict zero-custody trust model. All borrowing limits, interest rate calculations, token transfers, and credit penalties are executed exclusively through immutable Solidity smart contracts on Ethereum Sepolia.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              This analytics interface is powered by an idempotent offchain event log indexed via Alchemy webhooks. Offchain services are strictly read-only and cannot mutate financial state.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Chain ID: 11155111</span>
            <span>Contracts: Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
