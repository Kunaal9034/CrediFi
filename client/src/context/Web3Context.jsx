import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import api from '../services/api';

const Web3Context = createContext(null);

const AMOY_CHAIN_ID_HEX = '0x13882'; // 80002 in hex
const HARDHAT_CHAIN_ID_HEX = '0x7a69'; // 31337 in hex

const AMOY_NETWORK_PARAMS = {
  chainId: AMOY_CHAIN_ID_HEX,
  chainName: 'Polygon Amoy Testnet',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-amoy.polygon.technology'],
  blockExplorerUrls: ['https://amoy.polygonscan.com'],
};

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [isVerifiedSigner, setIsVerifiedSigner] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      setHasMetaMask(true);
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(browserProvider);

      // Check if already connected
      window.ethereum.request({ method: 'eth_accounts' }).then(async (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const currentSigner = await browserProvider.getSigner();
          setSigner(currentSigner);
          const network = await browserProvider.getNetwork();
          setChainId(Number(network.chainId));
        }
      }).catch(console.error);

      // Listen for account changes
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length === 0) {
          setAccount(null);
          setSigner(null);
          setIsVerifiedSigner(false);
        } else {
          setAccount(accounts[0]);
          const updatedSigner = await browserProvider.getSigner();
          setSigner(updatedSigner);
        }
      };

      // Listen for chain changes
      const handleChainChanged = (newChainId) => {
        setChainId(parseInt(newChainId, 16));
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not detected. Please install MetaMask to enable Web3 signing.');
      return;
    }

    try {
      setIsConnecting(true);
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const s = await browserProvider.getSigner();
        setSigner(s);
        const net = await browserProvider.getNetwork();
        setChainId(Number(net.chainId));
        setProvider(browserProvider);
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToPolygonAmoy = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: AMOY_CHAIN_ID_HEX }],
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [AMOY_NETWORK_PARAMS],
          });
        } catch (addError) {
          console.error('Failed to add Polygon Amoy network to MetaMask:', addError);
        }
      }
    }
  };

  /**
   * Cryptographically sign an authorization nonce with MetaMask
   */
  const signAuthorizationMessage = async () => {
    if (!account || !signer) {
      await connectWallet();
    }

    try {
      // 1. Request nonce from backend
      const nonceRes = await api.post('/auth/nonce', { walletAddress: account });
      const { nonce } = nonceRes.data;

      // 2. Request user to sign message in MetaMask
      const signature = await signer.signMessage(nonce);

      // 3. Verify signature on backend
      const verifyRes = await api.post('/auth/verify-signature', {
        walletAddress: account,
        signature,
        message: nonce
      });

      if (verifyRes.data.verified) {
        setIsVerifiedSigner(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Cryptographic signature verification failed:', err);
      return false;
    }
  };

  const isAmoyNetwork = chainId === 80002;
  const isLocalNetwork = chainId === 31337;

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        provider,
        signer,
        hasMetaMask,
        isConnecting,
        isVerifiedSigner,
        isAmoyNetwork,
        isLocalNetwork,
        connectWallet,
        switchToPolygonAmoy,
        signAuthorizationMessage
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};
