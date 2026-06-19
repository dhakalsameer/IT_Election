export default function ArchitectureOverview() {
  return (
    <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500 mt-8">
      <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-4">System Architecture</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
            <span className="bg-indigo-100 p-1.5 rounded-md">🛡️</span>
            Merkle Tree Verification
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Eligible voters are stored in an off-chain Merkle Tree. Only the root is on-chain, 
            slashing gas costs by 99% while maintaining cryptographic security.
          </p>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
            <span className="bg-blue-100 p-1.5 rounded-md">🔗</span>
            Blockchain Ledger
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Votes are permanently recorded on the Sepolia Testnet. Once cast, a vote cannot 
            be altered, deleted, or double-counted by anyone, including admins.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
            <span className="bg-green-100 p-1.5 rounded-md">⚡</span>
            Hybrid Database
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Candidate metadata and student profiles are managed by a PostgreSQL backend, 
            providing a fast, responsive UI while ensuring critical logic stays decentralized.
          </p>
        </div>
      </div>
    </div>
  );
}
