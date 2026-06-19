import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContextValue";
import { getContractV3 } from "../contract";
import { API_URL } from "../config";
import { getProof } from "../utils/merkle";

const getImageUrl = (imageCID) => {
  if (!imageCID) return "";
  if (imageCID.startsWith("http://") || imageCID.startsWith("https://")) return imageCID;
  return `https://ipfs.io/ipfs/${imageCID}`;
};

const getPositionLabel = (position) => {
  if (position === 0) return "President";
  if (position === 1) return "Secretary";
  return "General Member";
};

function CandidateOption({ candidate, selected, onSelect }) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getImageUrl(candidate.imageCID);
  const initials = candidate.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
        selected 
          ? "border-blue-600 bg-blue-50/30 shadow-[0_0_20px_rgba(37,99,235,0.1)]" 
          : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg"
      }`}
    >
      {selected && (
        <div className="absolute top-0 right-0 p-3">
           <div className="bg-blue-600 text-white rounded-full p-1 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
           </div>
        </div>
      )}
      
      <div className="p-5 flex items-center gap-5">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-white shadow-sm transition-transform group-hover:scale-105">
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={candidate.name}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-black text-white">
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0 text-left">
          <p className={`font-black text-base truncate transition-colors ${selected ? "text-blue-900" : "text-slate-800"}`}>
            {candidate.name}
          </p>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {getPositionLabel(candidate.position)}
             </span>
             <span className="text-[10px] font-bold text-slate-400">#{candidate.studentId}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function VotingPanelV3() {
  const { wallet } = useContext(AuthContext);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [eligibleWallets, setEligibleWallets] = useState([]);

  const loadCandidates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/candidates`);
      const rows = await response.json();
      setCandidates(rows.map(c => ({
        id: Number(c.blockchain_id),
        name: c.name,
        studentId: c.student_id,
        imageCID: c.image_cid,
        position: c.position === "President" ? 0 : c.position === "Secretary" ? 1 : 2,
      })));
    } catch (err) { console.error(err); }
  };

  const loadEligibleWallets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/voters/pending`);
      const data = await response.json();
      setEligibleWallets(data.filter(s => s.eligible_to_vote).map(s => s.wallet_address));
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    loadCandidates();
    loadEligibleWallets();
  }, []);

  const castVote = async () => {
    if (!wallet) return;
    if (!selectedId) return alert("Select a candidate to proceed");

    setLoading(true);
    try {
      let proof;
      try {
        const proofResponse = await fetch(`${API_URL}/api/voters/proof?wallet=${wallet}`);
        const data = await proofResponse.json();
        proof = data.proof;
      } catch (err) {
        console.warn("Backend proof fetch failed, trying local generation...");
        proof = getProof(eligibleWallets, wallet);
      }

      if (!proof || proof.length === 0) {
        throw new Error("You are not eligible to vote (no Merkle proof found)");
      }

      const contract = await getContractV3();
      const tx = await contract.vote(selectedId, proof);
      await tx.wait();

      alert("🎉 Vote cast successfully! Blockchain record confirmed.");
      window.location.reload(); 
    } catch (err) {
      console.error(err);
      alert(err.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden transform transition-all">
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-8 text-white relative">
        <div className="absolute top-0 right-0 p-8 opacity-20">
           <span className="text-6xl text-blue-400">🛡️</span>
        </div>
        <div className="flex items-center gap-3 mb-2">
           <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-blue-500/30">
              V3 Protocol Active
           </span>
        </div>
        <h2 className="text-3xl font-black tracking-tight">Electoral Ballot</h2>
        <p className="text-slate-400 text-sm mt-2 max-w-lg leading-relaxed">
          Identity verified via Merkle Tree. Select one candidate. Your choice will be cryptographically sealed and recorded on the Ethereum ledger.
        </p>
      </div>

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {candidates.map(c => (
            <CandidateOption
              key={c.id}
              candidate={c}
              selected={selectedId === c.id}
              onSelect={() => setSelectedId(c.id)}
            />
          ))}
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-2xl">
             <div className="bg-white p-2 rounded-xl shadow-sm text-lg">💡</div>
             <p className="text-xs text-blue-900 font-medium leading-relaxed">
                By clicking the button below, you will trigger a MetaMask signature. 
                <span className="font-black"> This action is irreversible.</span>
             </p>
          </div>

          <button 
            onClick={castVote}
            disabled={loading || !wallet || !selectedId}
            className="group relative w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-2xl shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0"
          >
            <span className={loading ? "opacity-0" : "opacity-100"}>
              {selectedId ? "Confirm Selection & Sign Transaction" : "Select a Candidate to Vote"}
            </span>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center gap-3">
                 <div className="h-5 w-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                 <span className="text-sm uppercase tracking-widest font-black">Encrypting Ballot...</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
