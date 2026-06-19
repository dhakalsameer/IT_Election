import { useEffect, useState } from "react";
import { ethers } from "ethers";
import Election3ABI from "../abi/Election3.json";                                                                                
import { CONTRACT_ADDRESS_V3 } from "../config";

const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com"; // Fallback public RPC

export function useElectionListener() {
  const [liveVotes, setLiveVotes] = useState({});

  useEffect(() => {
    if (!CONTRACT_ADDRESS_V3 || CONTRACT_ADDRESS_V3 === "0x0000000000000000000000000000000000000000") return;

    let contract;
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      contract = new ethers.Contract(
        CONTRACT_ADDRESS_V3,
        Election3ABI.abi,
        provider
      );

      console.log("🔗 Direct blockchain listener active on:", CONTRACT_ADDRESS_V3);

      contract.on("VoteCast", (voter, candidateId) => {
        const id = candidateId.toString();
        console.log(`⛓️ On-chain event: Vote for candidate ${id} by ${voter}`);
        
        setLiveVotes(prev => ({
          ...prev,
          [id]: (prev[id] || 0) + 1
        }));
      });

    } catch (err) {
      console.error("Failed to setup blockchain listener:", err);
    }

    return () => {
      if (contract) contract.removeAllListeners("VoteCast");
    };
  }, []);

  return liveVotes;
}
