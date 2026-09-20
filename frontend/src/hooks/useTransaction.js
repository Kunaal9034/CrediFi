import { useState, useCallback } from 'react';

export function useTransaction() {
  const [status, setStatus] = useState('idle'); // idle | waiting_wallet | submitted | confirming | confirmed | failed
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
    setReceipt(null);
  }, []);

  const executeTransaction = useCallback(async (txFunction) => {
    reset();
    try {
      setStatus('waiting_wallet');
      const tx = await txFunction();

      setStatus('submitted');
      setTxHash(tx.hash);

      setStatus('confirming');
      const txReceipt = await tx.wait();

      setReceipt(txReceipt);
      setStatus('confirmed');
      return txReceipt;
    } catch (err) {
      console.error('[useTransaction] Transaction failed:', err);
      // Clean up readable revert error
      let readableError = err.reason || err.shortMessage || err.message || 'Transaction rejected or failed';
      if (readableError.includes('user rejected action') || readableError.includes('ACTION_REJECTED')) {
        readableError = 'Transaction rejected in MetaMask';
      }
      setError(readableError);
      setStatus('failed');
      throw new Error(readableError);
    }
  }, [reset]);

  return {
    status,
    txHash,
    error,
    receipt,
    reset,
    executeTransaction,
    isPending: status === 'waiting_wallet' || status === 'submitted' || status === 'confirming',
    isSuccess: status === 'confirmed',
    isFailed: status === 'failed',
  };
}
