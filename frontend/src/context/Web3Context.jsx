import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ethers } from 'ethers';
import { CHAIN_ID, CONTRACT_ADDRESSES } from '../contracts/addresses';
import {
  switchNetwork as switchChain,
  fetchTokenBalance,
  getFallbackProvider,
} from '../services/blockchain';

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0n);
  const [ethBalance, setEthBalance] = useState(0n);

  const accountRef = useRef(account);
  const providerRef = useRef(provider);
  const signerRef = useRef(signer);

  useEffect(() => {
    accountRef.current = account;
    providerRef.current = provider;
    signerRef.current = signer;
  }, [account, provider, signer]);

  const isCorrectNetwork = chainId === Number(CHAIN_ID);

  const refreshBalances = useCallback(async (currentAccount, currentSigner) => {
    if (!currentAccount) return;
    try {
      const runner = currentSigner || getFallbackProvider();
      const [tokBal, ethBal] = await Promise.all([
        fetchTokenBalance(currentAccount, runner),
        (currentSigner?.provider || getFallbackProvider()).getBalance(currentAccount),
      ]);
      setTokenBalance(tokBal);
      setEthBalance(ethBal);
    } catch (err) {
      console.warn('[Web3Context] Failed to refresh balances:', err.message || err);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setConnectionError(null);
    if (!window.ethereum) {
      const msg = 'MetaMask is not detected. Please install the MetaMask extension to use CrediFi.';
      setConnectionError(msg);
      return;
    }

    setIsConnecting(true);
    try {
      const browserProvider = providerRef.current || new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      const network = await browserProvider.getNetwork();
      const currentSigner = await browserProvider.getSigner();

      const userAccount = ethers.getAddress(accounts[0]);
      setAccount(userAccount);
      setProvider(browserProvider);
      setSigner(currentSigner);
      setChainId(Number(network.chainId));

      await refreshBalances(userAccount, currentSigner);
    } catch (err) {
      console.error('[Web3Context] Error connecting wallet:', err);
      let readable = 'Failed to connect wallet';
      if (err.code === 4001 || err.message?.includes('rejected')) {
        readable = 'Connection request was rejected in MetaMask';
      }
      setConnectionError(readable);
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalances]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setTokenBalance(0n);
    setEthBalance(0n);
    setConnectionError(null);
  }, []);

  const handleSwitchNetwork = useCallback(async () => {
    setConnectionError(null);
    try {
      await switchChain(CHAIN_ID);
      const currentProvider = providerRef.current || (window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null);
      if (currentProvider) {
        const net = await currentProvider.getNetwork();
        setChainId(Number(net.chainId));
      }
    } catch (err) {
      console.error('[Web3Context] Failed to switch network:', err);
      let readable = 'Failed to switch network';
      if (err.code === 4001 || err.message?.includes('rejected')) {
        readable = 'Network switch request was rejected in MetaMask';
      }
      setConnectionError(readable);
    }
  }, []);

  // Eagerly check if wallet was previously connected
  useEffect(() => {
    if (!window.ethereum) return;

    let isMounted = true;
    const checkActiveConnection = async () => {
      try {
        const browserProvider = providerRef.current || new ethers.BrowserProvider(window.ethereum);
        const accounts = await browserProvider.send('eth_accounts', []);
        if (accounts.length > 0 && isMounted) {
          const network = await browserProvider.getNetwork();
          const currentSigner = await browserProvider.getSigner();
          const userAccount = ethers.getAddress(accounts[0]);
          setAccount(userAccount);
          setProvider(browserProvider);
          setSigner(currentSigner);
          setChainId(Number(network.chainId));
          refreshBalances(userAccount, currentSigner);
        }
      } catch (err) {
        console.warn('[Web3Context] Eager connection check failed:', err.message || err);
      }
    };

    checkActiveConnection();

    const handleAccountsChanged = async (accounts) => {
      if (!isMounted) return;
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        const newAccount = ethers.getAddress(accounts[0]);
        setAccount(newAccount);
        try {
          const currentProvider = providerRef.current || new ethers.BrowserProvider(window.ethereum);
          if (!providerRef.current) setProvider(currentProvider);
          const newSigner = await currentProvider.getSigner();
          setSigner(newSigner);
          refreshBalances(newAccount, newSigner);
        } catch (e) {
          console.warn('[Web3Context] Error updating account/signer on accountsChanged:', e);
        }
      }
    };

    const handleChainChanged = async (hexChainId) => {
      if (!isMounted) return;
      const newChainId = Number(hexChainId);
      setChainId(newChainId);
      try {
        const currentProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(currentProvider);
        const currentSigner = await currentProvider.getSigner();
        setSigner(currentSigner);
        if (accountRef.current) {
          refreshBalances(accountRef.current, currentSigner);
        }
      } catch {
        if (accountRef.current && signerRef.current) {
          refreshBalances(accountRef.current, signerRef.current);
        }
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      isMounted = false;
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [disconnectWallet, refreshBalances]);

  const contextValue = useMemo(
    () => ({
      account,
      provider,
      signer,
      chainId,
      targetChainId: CHAIN_ID,
      isCorrectNetwork,
      isConnecting,
      connectionError,
      clearConnectionError: () => setConnectionError(null),
      tokenBalance,
      ethBalance,
      contracts: CONTRACT_ADDRESSES,
      connectWallet,
      disconnectWallet,
      switchNetwork: handleSwitchNetwork,
      refreshBalances: () => refreshBalances(account, signer),
    }),
    [
      account,
      provider,
      signer,
      chainId,
      isCorrectNetwork,
      isConnecting,
      connectionError,
      tokenBalance,
      ethBalance,
      connectWallet,
      disconnectWallet,
      handleSwitchNetwork,
      refreshBalances,
    ]
  );

  return (
    <Web3Context.Provider value={contextValue}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}
