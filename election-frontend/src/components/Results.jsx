import { useState, useEffect } from "react";
import { API_URL } from "../config";
import { socket } from "../socket";

export default function Results() {
  const [candidates, setCandidates] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchResults = async () => {
    try {
      const res = await fetch(`${API_URL}/api/results`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCandidates(data);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch results", err);
    }
  };

  useEffect(() => {
    fetchResults();

    // 🔥 Real-time Listener
    socket.on("voteUpdate", (data) => {
      console.log("⚡ Real-time vote update received");
      setCandidates(data);
      setLastUpdate(new Date());
    });

    const interval = setInterval(fetchResults, 30000); // Poll less frequently as fallback
    
    return () => {
      socket.off("voteUpdate");
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
          <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></span>
          Live Results
        </h2>
        <span className="text-[10px] font-mono text-slate-400">
          Updated: {lastUpdate.toLocaleTimeString()}
        </span>
      </div>
      
      <div className="p-6 space-y-5">
        {candidates.length > 0 ? (
          candidates.map((c) => {
            const totalVotes = candidates.reduce((acc, curr) => acc + Number(curr.vote_count), 0);
            const percentage = totalVotes > 0 ? (Number(c.vote_count) / totalVotes * 100).toFixed(1) : 0;
            
            return (
              <div key={c.id} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{c.name}</p>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">{c.position}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900 text-sm">{c.vote_count}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{percentage}%</p>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-1000 ease-out"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400 font-medium italic">Waiting for first block...</p>
          </div>
        )}
      </div>
      
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-100">
        <button className="w-full text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 hover:text-blue-600 transition-colors">
          View Detailed Analytics →
        </button>
      </div>
    </div>
  );
}
