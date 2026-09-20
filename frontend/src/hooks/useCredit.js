import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from './useWallet';
import { fetchOnchainCreditProfile } from '../services/blockchain';
import { getCreditTier } from '../utils/constants';

const DEFAULT_CREDIT_DATA = {
  score: 500,
  limit: 500n * 10n ** 6n,
  availableBorrowingPower: 500n * 10n ** 6n,
  outstandingPrincipal: 0n,
  profile: null,
};

export function useCredit(targetAddress) {
  const { account, provider, chainId } = useWallet();
  const addressToQuery = targetAddress || account;

  const [creditData, setCreditData] = useState(DEFAULT_CREDIT_DATA);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const lastLoadedKeyRef = useRef(null);
  const fetchCountRef = useRef(0);

  const fetchCredit = useCallback(async () => {
    if (!addressToQuery) {
      setCreditData(DEFAULT_CREDIT_DATA);
      setHasLoaded(false);
      setIsFetching(false);
      setIsRefreshing(false);
      setError(null);
      lastLoadedKeyRef.current = null;
      return;
    }

    const currentKey = `${addressToQuery.toLowerCase()}-${chainId || ''}`;
    const isAlreadyLoaded = lastLoadedKeyRef.current === currentKey;

    if (isAlreadyLoaded) {
      // Background refresh: preserve loaded numbers, do not show initial placeholders
      setIsRefreshing(true);
    } else {
      // First-time load for this address/network: show initial loading state
      setIsFetching(true);
      setHasLoaded(false);
    }
    setError(null);

    const requestId = ++fetchCountRef.current;

    try {
      const data = await fetchOnchainCreditProfile(addressToQuery, provider);
      if (fetchCountRef.current !== requestId) return;

      // Update state atomically without intermediate placeholders
      setCreditData(data);
      setHasLoaded(true);
      lastLoadedKeyRef.current = currentKey;
      setError(null);
    } catch (err) {
      if (fetchCountRef.current !== requestId) return;
      console.error('[useCredit] Error fetching onchain credit profile:', err);
      setError(err.message || 'Failed to load credit profile from Sepolia');
      // Note: If data was already loaded, existing creditData is maintained
    } finally {
      if (fetchCountRef.current === requestId) {
        setIsFetching(false);
        setIsRefreshing(false);
      }
    }
  }, [addressToQuery, chainId, provider]);

  useEffect(() => {
    fetchCredit();
  }, [fetchCredit]);

  const initialLoading = !hasLoaded && isFetching;
  const tier = getCreditTier(creditData.score);

  return {
    score: creditData.score,
    limit: creditData.limit,
    availableBorrowingPower: creditData.availableBorrowingPower,
    outstandingPrincipal: creditData.outstandingPrincipal,
    profile: creditData.profile,
    tier,
    hasLoaded,
    initialLoading,
    isRefreshing,
    isFetching: isFetching || isRefreshing,
    // loading is true ONLY when data has never been loaded for the active account/network
    loading: initialLoading,
    error,
    refresh: fetchCredit,
  };
}
