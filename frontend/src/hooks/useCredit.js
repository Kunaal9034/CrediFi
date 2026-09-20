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
    profile: null,
  });
  const [loading, setLoading] = useState(false);

  const fetchCredit = useCallback(async () => {
    if (!addressToQuery) {
      setCreditData({ score: 500, limit: 500n * 10n ** 6n, profile: null });
      return;
    }
    setLoading(true);
    try {
      const data = await fetchOnchainCreditProfile(addressToQuery, provider);
      setCreditData(data);
    } catch (err) {
      console.error('[useCredit] Error fetching credit profile:', err);
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
    profile: creditData.profile,
    tier,
    loading,
    refresh: fetchCredit,
  };
}
