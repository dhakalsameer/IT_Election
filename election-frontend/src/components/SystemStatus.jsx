import { useState, useEffect } from "react";
import { API_URL, CONTRACT_ADDRESS_V3 } from "../config";

export default function SystemStatus() {
  const [backendStatus, setBackendStatus] = useState("checking");
  const [chainStatus, setChainStatus] = useState("checking");

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_URL}/api/candidates`);
        if (res.ok) setBackendStatus("online");
        else setBackendStatus("error");
      } catch {
        setBackendStatus("offline");
      }
    };

    const updateChainStatus = (chainId) => {
      if (chainId === '0xaa36a7') setChainStatus("sepolia");
      else setChainStatus("wrong-network");
    };

    const initChain = async () => {
      if (window.ethereum) {
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          updateChainStatus(chainId);
        } catch {
          setChainStatus("error");
        }
      } else {
        setChainStatus("no-wallet");
      }
    };

    checkBackend();
    initChain();

    const handleChainChanged = (chainId) => {
      updateChainStatus(chainId);
    };

    if (window.ethereum) {
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    const interval = setInterval(checkBackend, 30000);

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-wrap gap-4 items-center bg-gray-50 border-b border-gray-200 px-8 py-2 text-xs font-mono">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">API:</span>
        <span className={`h-2 w-2 rounded-full ${
          backendStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
          backendStatus === 'checking' ? 'bg-yellow-500' : 'bg-red-500'
        }`}></span>
        <span className={backendStatus === 'online' ? 'text-green-700' : 'text-red-700'}>
          {backendStatus.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
        <span className="text-gray-500">NETWORK:</span>
        <span className={`h-2 w-2 rounded-full ${
          chainStatus === 'sepolia' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-red-500'
        }`}></span>
        <span className={chainStatus === 'sepolia' ? 'text-blue-700' : 'text-red-700'}>
          {chainStatus === 'sepolia' ? 'SEPOLIA (LIVE)' : chainStatus.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-2 border-l border-gray-300 pl-4 hidden md:flex">
        <span className="text-gray-500">CONTRACT:</span>
        <a 
          href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS_V3}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {CONTRACT_ADDRESS_V3.slice(0, 10)}...{CONTRACT_ADDRESS_V3.slice(-6)}
        </a>
      </div>
    </div>
  );
}
