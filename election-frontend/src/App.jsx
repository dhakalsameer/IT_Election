import { useContext, useState } from "react";
import { AuthContext } from "./context/AuthContextValue";
import AdminDashboard from "./components/admin/AdminDashboard";
import VotingPanel from "./components/VotingPanel";
import VotingPanelV3 from "./components/VotingPanelV3";
import Results from "./components/Results";
import LiveBlockchainDashboard from "./components/LiveBlockchainDashboard";
import WalletButton from "./components/WalletButton";
import SystemStatus from "./components/SystemStatus";
import ArchitectureOverview from "./components/ArchitectureOverview";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import StudentPortal from "./components/StudentPortal";
import { CONTRACT_ADDRESS_V3 } from "./config";

function App() {
  const { wallet, isAdmin, voterStatus } = useContext(AuthContext);
  const [portalOpen, setPortalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <SystemStatus />
      
      <header className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
              <span className="text-white font-black text-xl">IT</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800 uppercase">Club Election</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Decentralized Voting System v3</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPortalOpen(true)}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              🎓 Student Portal
            </button>
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {!wallet ? (
          <div className="text-center py-32 bg-white rounded-2xl shadow-xl border border-slate-100 max-w-2xl mx-auto transform transition-all hover:scale-[1.01]">
            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
               <span className="text-4xl">🗳️</span>
            </div>
            <h2 className="text-2xl font-bold mb-4 text-slate-800">Ready to cast your vote?</h2>
            <p className="text-slate-500 mb-8 px-12 leading-relaxed">
              Connect your Ethereum wallet to securely access the student portal. 
              Only verified members of the IT Club can participate in active elections.
            </p>
            <div className="flex justify-center">
               <WalletButton />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Actions & Dashboard */}
            <div className="lg:col-span-8 space-y-10">
              {isAdmin && <AdminDashboard />}
              
              {!isAdmin && (
                <>
                  {!voterStatus.registered && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-xl shadow-sm">
                      <h2 className="text-lg font-bold text-amber-900 mb-1">Account Synchronization Required</h2>
                      <p className="text-amber-700 text-sm">
                        Your wallet is not linked to our student database. Please visit the student portal to verify your identity.
                      </p>
                    </div>
                  )}

                  {voterStatus.registered && !voterStatus.walletLinked && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-xl shadow-sm">
                      <h2 className="text-lg font-bold text-amber-900 mb-1">Verification in Progress</h2>
                      <p className="text-amber-700 text-sm">
                        Your wallet link is pending approval. The admin team is currently reviewing your student credentials.
                      </p>
                    </div>
                  )}

                  {voterStatus.registered && voterStatus.walletLinked && !voterStatus.verified && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-xl shadow-sm">
                      <h2 className="text-lg font-bold text-blue-900 mb-1">Electorate Whitelist Pending</h2>
                      <p className="text-blue-700 text-sm">
                        Identity verified. You will be added to the Merkle Tree whitelist once the registration phase concludes.
                      </p>
                    </div>
                  )}

                  {voterStatus.canVote && <VotingPanelV3 />}

                  {voterStatus.hasVoted && (
                    <div className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-xl shadow-sm flex items-center gap-4">
                      <div className="bg-emerald-100 p-3 rounded-full">
                        <span className="text-2xl">✅</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-emerald-900">Blockchain Record Confirmed</h2>
                        <p className="text-emerald-700 text-sm font-medium text-opacity-80 leading-snug">
                          Your vote has been permanently etched into the Sepolia ledger. Your contribution to IT Club's digital democracy is complete.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <ArchitectureOverview />
              <AnalyticsDashboard />
            </div>

            {/* Right Column: Stats & Sidebars */}
            <div className="lg:col-span-4 space-y-8">
              <Results />
              <LiveBlockchainDashboard />
              
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform">
                    <span className="text-6xl">🔒</span>
                 </div>
                 <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></span>
                    Security Notice
                 </h3>
                 <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    This system uses end-to-end cryptographic verification. No central authority can alter your vote.
                 </p>
                 <button className="text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors">
                    Learn about Merkle Proofs →
                 </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-8 py-12 border-t border-gray-200 mt-20 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all cursor-default">
           <span className="font-bold text-xs uppercase tracking-tighter">Powered by</span>
           <span className="font-black text-sm italic">Ethereum + Sepolia</span>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
          © 2026 IT Club Decentralized Governance Platform
        </p>
      </footer>

      <StudentPortal open={portalOpen} onClose={() => setPortalOpen(false)} />
    </div>
  );
}

export default App;
