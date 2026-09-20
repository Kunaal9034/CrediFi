import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';
import { fetchOnchainCreditProfile } from '../services/blockchain';
import { getCreditTier } from '../utils/constants';

export function useCredit(targetAddress) {
  const { account, provider } = useWallet();
  const addressToQuery = targetAddress || account;

  const [creditData, setCreditData] = useState({
    score: 500,
    limit: 500n * 10n ** 6n,
    availableBorrowingPower: 500n * 10n ** 6n,
    outstandingPrincipal: 0n,
    profile: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCredit = useCallback(async () => {
    if (!addressToQuery) {
      setCreditData({
        score: 500,
        limit: 500n * 10n ** 6n,
        availableBorrowingPower: 500n * 10n ** 6n,
        outstandingPrincipal: 0n,
        profile: null,
      });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOnchainCreditProfile(addressToQuery, provider);
      setCreditData(data);
    } catch (err) {
      console.error('[useCredit] Error fetching onchain credit profile:', err);
      setError(err.message || 'Failed to load credit profile from Sepolia');
    } finally {
      setLoading(false);
    }
  }, [addressToQuery, provider]);

  useEffect(() => {
    fetchCredit();
  }, [fetchCredit]);

  const tier = getCreditTier(creditData.score);

  return {
    score: creditData.score,
    limit: creditData.limit,
    availableBorrowingPower: creditData.availableBorrowingPower,
    outstandingPrincipal: creditData.outstandingPrincipal,
    profile: creditData.profile,
    tier,
    loading,
    error,
    refresh: fetchCredit,
  };
}
