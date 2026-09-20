import React from 'react';
import { LOAN_STATUS } from '../utils/constants';

export default function LoanStatus({ status }) {
  const statusInfo = LOAN_STATUS[status] || {
    label: 'Unknown',
    color: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}
    >
      {statusInfo.label}
    </span>
  );
}
