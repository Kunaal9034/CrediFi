import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CHAIN_ID } from '../contracts/addresses';
import { switchNetwork as switchChain, fetchTokenBalance } from '../services/blockchain';

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0n);
  const [ethBalance, setEthBalance] = useState(0n);

  const isCorrectNetwork = chainId === Number(CHAIN_ID) || chainId === 31337;

  const refreshBalances = useCallback(async (currentAccount, currentSigner) => {
    if (!currentAccount || !currentSigner) return;
    try {
      const [tokBal, ethBal] = await Promise.all([
        fetchTokenBalance(currentAccount, currentSigner),
        currentSigner.provider.getBalance(currentAccount),
      ]);
      setTokenBalance(tokBal);
      setEthBalance(ethBal);
    } catch (err) {
      console.warn('[Web3Context] Failed to refresh balances:', err);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert('MetaMask is not detected. Please install MetaMask extension to use CrediFi.');
      return;
    }

    setIsConnecting(true);
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      const network = await browserProvider.getNetwork();
      const currentSigner = await browserProvider.getSigner();

      const userAccount = accounts[0];
      setAccount(userAccount);
      setProvider(browserProvider);
      setSigner(currentSigner);
      setChainId(Number(network.chainId));

      await refreshBalances(userAccount, currentSigner);
    } catch (err) {
      console.error('[Web3Context] Error connecting wallet:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalances]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setTokenBalance(0n);
    setEthBalance(0n);
  }, []);

  const handleSwitchNetwork = useCallback(async () => {
    try {
      await switchChain(CHAIN_ID);
      if (provider) {
        const net = await provider.getNetwork();
        setChainId(Number(net.chainId));
      }
    } catch (err) {
      console.error('[Web3Context] Failed to switch network:', err);
    }
  }, [provider]);

  // Handle MetaMask account and chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accounts[0]);
        if (provider) {
          provider.getSigner().then((newSigner) => {
            setSigner(newSigner);
            refreshBalances(accounts[0], newSigner);
          });
        }
      }
    };

    const handleChainChanged = (hexChainId) => {
      setChainId(Number(hexChainId));
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [provider, disconnectWallet, refreshBalances]);

  return (
    <Web3Context.Provider
      value={{
        account,
        provider,
        signer,
        chainId,
        isCorrectNetwork,
        isConnecting,
        tokenBalance,
        ethBalance,
        connectWallet,
        disconnectWallet,
        switchNetwork: handleSwitchNetwork,
        refreshBalances: () => refreshBalances(account, signer),
      }}
    >
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
