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
        let rawError = err.reason || err.data?.message || err.error?.message || err.shortMessage || err.message || '';
        let readableError = 'Transaction rejected or failed';

        // Check common failure modes
        if (
          rawError.includes('user rejected') ||
          rawError.includes('ACTION_REJECTED') ||
          err.code === 4001 ||
          err.code === 'ACTION_REJECTED'
        ) {
          readableError = 'Transaction cancelled: Rejected in MetaMask';
        } else if (rawError.toLowerCase().includes('insufficient funds')) {
          readableError = 'Insufficient Sepolia ETH for network gas fees';
        } else if (rawError.includes('exceed borrowing limit') || rawError.includes('exceeds borrowing limit')) {
          readableError = 'Transaction reverted: Requested amount exceeds your active borrowing power';
        } else if (rawError.includes('active defaulted loans')) {
          readableError = 'Transaction reverted: Account has defaulted loans and cannot borrow';
        } else if (rawError.includes('Borrower cannot fund their own loan') || rawError.includes('Lender cannot be borrower')) {
          readableError = 'Transaction reverted: Self-funding is prohibited (you cannot fund your own loan)';
        } else if (rawError.includes('Only the borrower can repay this loan')) {
          readableError = 'Transaction reverted: Only the original borrower can execute repayment';
        } else if (rawError.includes('Loan is not in REQUESTED state')) {
          readableError = 'Transaction reverted: Loan is no longer in REQUESTED state (already funded or cancelled)';
        } else if (rawError.includes('Loan is not in ACTIVE state')) {
          readableError = 'Transaction reverted: Loan is not currently ACTIVE';
        } else if (rawError.includes('Grace period') || rawError.includes('grace period')) {
          readableError = 'Transaction reverted: Loan cannot be marked defaulted until grace period expires';
        } else if (rawError.includes('insufficient allowance') || rawError.includes('allowance')) {
          readableError = 'Transaction failed: Insufficient mUSDC token allowance. Please approve mUSDC first.';
        } else if (rawError.includes('transfer amount exceeds balance') || rawError.includes('exceeds balance')) {
          readableError = 'Transaction failed: Insufficient mUSDC balance in wallet.';
        } else if (rawError.includes('Amount exceeds faucet limit')) {
          readableError = 'Faucet limit exceeded: Maximum 10,000 mUSDC per claim';
        } else if (err.reason) {
          readableError = `Contract Revert: ${err.reason}`;
        } else if (err.shortMessage) {
          readableError = err.shortMessage;
        } else if (err.message) {
          // Remove internal json-rpc error garbage if present
          const cleanMsg = err.message.split('(')[0].trim();
          readableError = cleanMsg.length > 5 ? cleanMsg : 'Transaction execution failed';
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
