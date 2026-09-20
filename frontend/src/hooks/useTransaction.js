import { useState, useCallback } from 'react';
import { useWallet } from './useWallet';
import { CHAIN_ID, EXPLORER_URL } from '../contracts/addresses';

export function useTransaction() {
  const { account, isCorrectNetwork } = useWallet();
  const [status, setStatus] = useState('idle'); // idle | validating | waiting_wallet | submitted | confirming | confirmed | failed
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
    setReceipt(null);
  }, []);

  const executeTransaction = useCallback(
    async (txFunction, onStateRefresh) => {
      reset();
      try {
        setStatus('validating');
        if (!account) {
          throw new Error('Please connect your MetaMask wallet first');
        }
        if (!isCorrectNetwork) {
          throw new Error('Please switch your wallet to Ethereum Sepolia (Chain ID 11155111)');
        }

        setStatus('waiting_wallet');
        const tx = await txFunction();

        if (!tx || !tx.hash) {
          throw new Error('No transaction returned from wallet');
        }

        setStatus('submitted');
        setTxHash(tx.hash);

        setStatus('confirming');
        const txReceipt = await tx.wait(1);

        setReceipt(txReceipt);
        setStatus('confirmed');

        if (onStateRefresh && typeof onStateRefresh === 'function') {
          try {
            await onStateRefresh();
          } catch (refErr) {
            console.warn('[useTransaction] Post-tx refresh warning:', refErr.message);
          }
        }

        return txReceipt;
      } catch (err) {
        console.error('[useTransaction] Transaction error:', err);
        let readableError = err.reason || err.shortMessage || err.message || 'Transaction rejected or failed';
        if (
          readableError.includes('user rejected') ||
          readableError.includes('ACTION_REJECTED') ||
          err.code === 4001
        ) {
          readableError = 'Transaction rejected in MetaMask';
        } else if (readableError.toLowerCase().includes('insufficient funds')) {
          readableError = 'Insufficient Sepolia ETH for gas fees';
        }
        setError(readableError);
        setStatus('failed');
        throw new Error(readableError);
      }
    },
    [account, isCorrectNetwork, reset]
  );

  const explorerUrl = txHash ? `${EXPLORER_URL}/tx/${txHash}` : null;

  return {
    status,
    txHash,
    explorerUrl,
    error,
    receipt,
    reset,
    executeTransaction,
    isValidating: status === 'validating',
    isWaitingWallet: status === 'waiting_wallet',
    isSubmitted: status === 'submitted',
    isConfirming: status === 'confirming',
    isPending:
      status === 'validating' ||
      status === 'waiting_wallet' ||
      status === 'submitted' ||
      status === 'confirming',
    isSuccess: status === 'confirmed',
    isFailed: status === 'failed',
  };
}
