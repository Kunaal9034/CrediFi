import { useWeb3 } from '../context/Web3Context';

export function useWallet() {
  return useWeb3();
}
