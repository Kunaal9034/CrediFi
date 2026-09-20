export const LOAN_STATUS = {
  0: { label: 'Requested', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  1: { label: 'Active', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  2: { label: 'Repaid', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  3: { label: 'Defaulted', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
};

export const LOAN_STATUS_BY_NAME = {
  REQUESTED: 0,
  ACTIVE: 1,
  REPAID: 2,
  DEFAULTED: 3,
};

export function getCreditTier(score) {
  if (score >= 750) return { name: 'Exceptional', color: 'text-emerald-400', badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-800' };
  if (score >= 670) return { name: 'Very Good', color: 'text-cyan-400', badge: 'bg-cyan-950/60 text-cyan-400 border-cyan-800' };
  if (score >= 580) return { name: 'Good', color: 'text-blue-400', badge: 'bg-blue-950/60 text-blue-400 border-blue-800' };
  if (score >= 500) return { name: 'Fair', color: 'text-amber-400', badge: 'bg-amber-950/60 text-amber-400 border-amber-800' };
  return { name: 'High Risk', color: 'text-rose-400', badge: 'bg-rose-950/60 text-rose-400 border-rose-800' };
}
