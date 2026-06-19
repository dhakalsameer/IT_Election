import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import ABI from "../abi/Election3.json";
import { CONTRACT_ADDRESS_V3, API_URL } from "../config";
import { AuthContext } from "./AuthContextValue";

export function AuthProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [student, setStudent] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [provider, setProvider] = useState(null);
  const [voterStatus, setVoterStatus] = useState({
    registered: false,
    walletLinked: false,
    verified: false,
    canVote: false,
    hasVoted: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      setProvider(p);

      if (window.ethereum.setMaxListeners) {
        window.ethereum.setMaxListeners(20);
      }
    }
  }, []);

  const checkVoterStatus = useCallback(async (address) => {
    try {
      if (!address || !provider) return;

      const contract = new ethers.Contract(CONTRACT_ADDRESS_V3, ABI.abi, provider);
      const adminAddress = await contract.admin();
      setIsAdmin(address.toLowerCase() === adminAddress.toLowerCase());

      const response = await fetch(`${API_URL}/api/voters/me?wallet=${address}`);
      const data = await response.json();

      setStudent(data.registered ? data : null);
      setVoterStatus({
        registered: Boolean(data.registered),
        walletLinked: Boolean(data.walletLinked),
        verified: Boolean(data.verified),
        canVote: Boolean(data.canVote),
        hasVoted: Boolean(data.hasVoted),
      });
    } catch (err) {
      console.error("Status check error:", err);
    }
  }, [provider]);

  const connectWallet = async () => {
    if (!window.ethereum) return alert("MetaMask not found!");

    setLoading(true);
    try {
      const p = provider || new ethers.BrowserProvider(window.ethereum);
      const accounts = await p.send("eth_requestAccounts", []);
      setWallet(accounts[0]);
      if (!provider) setProvider(p);
      await checkVoterStatus(accounts[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      const address = accounts[0] || null;
      setWallet(address);

      if (address) {
        checkVoterStatus(address);
      } else {
        setIsAdmin(false);
        setStudent(null);
        setVoterStatus({
          registered: false,
          walletLinked: false,
          verified: false,
          canVote: false,
          hasVoted: false,
        });
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, [checkVoterStatus]);

  return (
    <AuthContext.Provider
      value={{
        wallet,
        setWallet,
        student,
        setStudent,
        isAdmin,
        voterStatus,
        connectWallet,
        checkVoterStatus,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
