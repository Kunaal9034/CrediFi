import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from './useWallet';
import { fetchOnchainCreditProfile } from '../services/blockchain';
import { getCreditTier } from '../utils/constants';

// Address-keyed persistent memory cache: lowercaseAddress -> creditData
const creditProfileCache = new Map();

const EMPTY_CREDIT_DATA = {
  score: null,
  limit: null,
  availableBorrowingPower: null,
  outstandingPrincipal: null,
  profile: null,
};

export function useCredit(targetAddress) {
  const { account, provider } = useWallet();
  const addressToQuery = targetAddress || account;
  const addressKey = addressToQuery ? addressToQuery.toLowerCase() : null;

  // Initialize from cache if already loaded for this address, else null state
  const cachedData = addressKey ? creditProfileCache.get(addressKey) : null;
  const [creditData, setCreditData] = useState(cachedData || EMPTY_CREDIT_DATA);
  const [hasLoaded, setHasLoaded] = useState(Boolean(cachedData));
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchCountRef = useRef(0);
  const activeAddressRef = useRef(addressKey);

  // Sync state if address changed or cache updated
  useEffect(() => {
    activeAddressRef.current = addressKey;
    if (!addressKey) {
      setCreditData(EMPTY_CREDIT_DATA);
      setHasLoaded(false);
      setIsFetching(false);
      setIsRefreshing(false);
      setError(null);
      return;
    }

    const currentCached = creditProfileCache.get(addressKey);
    if (currentCached) {
      setCreditData(currentCached);
      setHasLoaded(true);
    } else {
      setCreditData(EMPTY_CREDIT_DATA);
      setHasLoaded(false);
    }
  }, [addressKey]);

  const fetchCredit = useCallback(async () => {
    if (!addressToQuery) {
      setCreditData(EMPTY_CREDIT_DATA);
      setHasLoaded(false);
      setIsFetching(false);
      setIsRefreshing(false);
      setError(null);
      return;
    }

    const currentKey = addressToQuery.toLowerCase();
    const alreadyHasData = creditProfileCache.has(currentKey) || (activeAddressRef.current === currentKey && hasLoaded);

    if (alreadyHasData) {
      // Background refresh: preserve existing valid data, do not show initial skeleton
      setIsRefreshing(true);
    } else {
      // First-time load for this address: show initial skeleton
      setIsFetching(true);
      setHasLoaded(false);
    }
    setError(null);

    const requestId = ++fetchCountRef.current;

    try {
      const data = await fetchOnchainCreditProfile(addressToQuery, provider);
      if (fetchCountRef.current !== requestId) return;
      if (activeAddressRef.current !== currentKey) return;

      creditProfileCache.set(currentKey, data);
      setCreditData(data);
      setHasLoaded(true);
      setError(null);
    } catch (err) {
      if (fetchCountRef.current !== requestId) return;
      if (activeAddressRef.current !== currentKey) return;
      console.error('[useCredit] Error fetching onchain credit profile:', err);
      setError(err.message || 'Failed to load credit profile from Sepolia');
      // CRITICAL UX RULE:
      // If valid data already exists in creditData or cache, preserve it.
      // Do NOT overwrite creditData with default/empty state on error.
    } finally {
      if (fetchCountRef.current === requestId) {
        setIsFetching(false);
        setIsRefreshing(false);
      }
    }
  }, [addressToQuery, hasLoaded, provider]);

  useEffect(() => {
    fetchCredit();
  }, [fetchCredit]);

  const initialLoading = !hasLoaded && isFetching;
  const tier = typeof creditData.score === 'number' && !isNaN(creditData.score)
    ? getCreditTier(creditData.score)
    : { name: 'Loading...', color: 'text-slate-400', badge: 'bg-slate-800/80 text-slate-400 border-slate-700' };

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
    // loading is true ONLY when data has never been loaded for the active account
    loading: initialLoading,
    error,
    refresh: fetchCredit,
  };
}
