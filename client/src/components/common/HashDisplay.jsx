import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

export default function HashDisplay({
  hash,
  label = null,
  isTx = false,
  isCid = false,
  truncate = true,
  className = ''
}) {
  const [copied, setCopied] = useState(false);

  if (!hash) {
    return <span className="text-slate-500 italic text-xs">None</span>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayHash = truncate
    ? hash.length > 20
      ? `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`
      : hash
    : hash;

  const explorerUrl = isTx ? `https://amoy.polygonscan.com/tx/${hash}` : null;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {label && <span className="text-xs font-medium text-slate-400">{label}:</span>}
      <div className="inline-flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-slate-300">
        <span title={hash} className="select-all">
          {displayHash}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          title="Copy full hash to clipboard"
          className="text-slate-400 hover:text-justice-400 transition-colors p-0.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        {isTx && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View on Polygonscan Amoy"
            className="text-slate-400 hover:text-justice-400 transition-colors p-0.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
