import { useElectionListener } from "../hooks/useElectionListener";

export default function LiveBlockchainDashboard() {
  const liveVotes = useElectionListener();
  const activeIds = Object.keys(liveVotes);

  if (activeIds.length === 0) return null;

  return (
    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl border border-blue-500/30 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-sm uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="h-2 w-2 bg-blue-400 rounded-full animate-ping"></span>
          Direct Chain Monitor
        </h3>
        <span className="text-[10px] font-mono text-blue-400">REAL-TIME EVENTS</span>
      </div>

      <div className="space-y-3">
        {activeIds.map((id) => (
          <div key={id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
               <div className="bg-blue-600 h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs">
                 #{id}
               </div>
               <span className="text-xs font-bold text-slate-300">New On-Chain Votes</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xl font-black text-blue-400">+{liveVotes[id]}</span>
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-[9px] text-slate-500 mt-4 leading-relaxed italic">
        This panel listens directly to the Sepolia RPC for events. It captures votes cast since you opened this session, bypassing the backend database entirely.
      </p>
    </div>
  );
}
