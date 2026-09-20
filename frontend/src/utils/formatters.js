import { ethers } from 'ethers';

export function formatAddress(address) {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export function formatUSDC(rawAmount, decimals = 2) {
  if (rawAmount === undefined || rawAmount === null) return '0.00';
  try {
    const formatted = ethers.formatUnits(rawAmount, 6);
    const num = parseFloat(formatted);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } catch (err) {
    return '0.00';
  }
}

export function parseUSDC(amountString) {
  if (!amountString || isNaN(amountString)) return 0n;
  return ethers.parseUnits(amountString.toString(), 6);
}

export function formatAPR(basisPoints) {
  if (!basisPoints) return '0.0%';
  return `${(Number(basisPoints) / 100).toFixed(1)}%`;
}

export function formatDurationDays(seconds) {
  if (!seconds) return '0 Days';
  const days = Math.round(Number(seconds) / (24 * 3600));
  return `${days} Day${days === 1 ? '' : 's'}`;
}

export function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
