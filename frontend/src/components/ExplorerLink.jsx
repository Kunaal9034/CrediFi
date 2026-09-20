import React from 'react';
import { ExternalLink } from 'lucide-react';
import { formatAddress } from '../utils/formatters';

export default function ExplorerLink({
  hash,
  type = 'tx', // 'tx' | 'address'
  label,
  className = '',
}) {
  if (!hash) return null;

  const baseUrl = 'https://sepolia.etherscan.io';
  const url = type === 'address' ? `${baseUrl}/address/${hash}` : `${baseUrl}/tx/${hash}`;
  const displayLabel = label || (type === 'address' ? formatAddress(hash) : `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 transition-colors font-mono text-xs ${className}`}
    >
      <span>{displayLabel}</span>
      <ExternalLink size={12} className="opacity-75" />
    </a>
  );
}
