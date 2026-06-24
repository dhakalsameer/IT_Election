import { useEffect, useState, useRef, useMemo } from "react";
import { ethers } from "ethers";
import Election3ABI from "../abi/Election3.json";
import { CONTRACT_ADDRESS_V3, SEPOLIA_EXPLORER } from "../config";

const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

const PHASE_NAMES = ["Created", "Registration", "Voting", "Ended"];
const POSITION_NAMES = ["President", "Secretary", "General Member"];

const EVENT_META = {
  VoteCast:                { label: "Vote Cast",        color: "emerald", icon: "🗳" },
  CandidateRegistered:     { label: "Candidate Reg",    color: "blue",    icon: "📝" },
  PhaseChanged:            { label: "Phase Changed",    color: "amber",   icon: "🔄" },
  MerkleRootUpdated:       { label: "Merkle Root",      color: "violet",  icon: "🌳" },
  IdentityMerkleRootUpdated: { label: "Identity Root",  color: "cyan",    icon: "🆔" },
  NewElectionStarted:      { label: "New Election",     color: "rose",    icon: "🏁" },
};

const EVENT_NAMES = Object.keys(EVENT_META);

function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts * 1000) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function truncate(hash) {
  if (!hash) return "";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function Badge({ variant, children }) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue:    "bg-sky-500/10    text-sky-400    border-sky-500/20",
    amber:   "bg-amber-500/10  text-amber-400  border-amber-500/20",
    violet:  "bg-violet-500/10 text-violet-400 border-violet-500/20",
    cyan:    "bg-cyan-500/10   text-cyan-400   border-cyan-500/20",
    rose:    "bg-rose-500/10   text-rose-400   border-rose-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${colors[variant] || colors.emerald}`}>
      {children}
    </span>
  );
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text);
}

function formatValue(key, value) {
  if (key === "voter" || key === "candidate" || key === "account" || key === "candidateAddr")
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  if (key === "newPhase" || key === "phase")
    return `${Number(value)} (${PHASE_NAMES[Number(value)] || "Unknown"})`;
  if (key === "position")
    return `${Number(value)} (${POSITION_NAMES[Number(value)] || "Unknown"})`;
  if (key === "newRoot" || key === "identityRoot")
    return `${value.slice(0, 10)}...${value.slice(-6)}`;
  if (key === "electionId" || key === "id")
    return `#${value.toString()}`;
  if (typeof value === "boolean")
    return value ? "Yes" : "No";
  return String(value);
}

function EventCard({ event }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const meta = EVENT_META[event.eventName] || { label: event.eventName, color: "emerald", icon: "📄" };
  const args = event.args || {};

  return (
    <div className="rounded-xl border border-app bg-app-surface overflow-hidden transition-all hover:border-app-accent/30">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-app/50 bg-app-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-sm">{meta.icon}</span>
          <Badge variant={meta.color}>{meta.label}</Badge>
          {event.txHash && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCopy(event.txHash)}
                className="text-[11px] font-mono text-app-muted-text hover:text-app-accent transition-colors cursor-pointer"
                title="Copy tx hash"
              >
                {truncate(event.txHash)}
              </button>
              <a
                href={`${SEPOLIA_EXPLORER}/tx/${event.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-app-muted-text hover:text-app-accent transition-colors"
                title="View on Etherscan"
              >
                ↗
              </a>
              {copied && <span className="text-[9px] text-emerald-400">Copied</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-app-muted-text">
          {event.blockNumber && (
            <a
              href={`${SEPOLIA_EXPLORER}/block/${event.blockNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-app-accent transition-colors"
            >
              #{event.blockNumber}
            </a>
          )}
          {event.timestamp && (
            <span title={new Date(event.timestamp * 1000).toLocaleString()}>
              {timeAgo(event.timestamp)}
            </span>
          )}
        </div>
      </div>
      <div className="px-4 py-3">
        {event.eventName === "CandidateRegistered" && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <span className="text-app-muted-text">Candidate ID</span>
            <span className="text-app-heading font-mono font-bold">{args.id?.toString()}</span>
            <span className="text-app-muted-text">Address</span>
            <span className="text-app-heading font-mono">{args.candidate?.slice(0, 10)}...{args.candidate?.slice(-6)}</span>
            <span className="text-app-muted-text">Name</span>
            <span className="text-app-heading font-medium">{args.name}</span>
            <span className="text-app-muted-text">Position</span>
            <span className="text-app-heading">{POSITION_NAMES[Number(args.position)] || `Unknown (${args.position})`}</span>
          </div>
        )}
        {event.eventName === "VoteCast" && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <span className="text-app-muted-text">Voter</span>
            <span className="text-app-heading font-mono">{args.voter?.slice(0, 10)}...{args.voter?.slice(-6)}</span>
            <span className="text-app-muted-text">Candidate ID</span>
            <span className="text-app-heading font-mono font-bold">#{args.candidateId?.toString()}</span>
          </div>
        )}
        {event.eventName === "PhaseChanged" && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <span className="text-app-muted-text">New Phase</span>
            <span className="text-app-heading font-bold">{PHASE_NAMES[Number(args.newPhase)] || `Unknown (${args.newPhase})`}</span>
          </div>
        )}
        {event.eventName === "MerkleRootUpdated" && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <span className="text-app-muted-text">New Root</span>
            <span className="text-app-heading font-mono text-[10px] break-all">{args.newRoot}</span>
          </div>
        )}
        {event.eventName === "IdentityMerkleRootUpdated" && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <span className="text-app-muted-text">New Identity Root</span>
            <span className="text-app-heading font-mono text-[10px] break-all">{args.newRoot}</span>
          </div>
        )}
        {event.eventName === "NewElectionStarted" && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <span className="text-app-muted-text">Election ID</span>
            <span className="text-app-heading font-mono font-bold">#{args.electionId?.toString()}</span>
          </div>
        )}
        {!["CandidateRegistered", "VoteCast", "PhaseChanged", "MerkleRootUpdated", "IdentityMerkleRootUpdated", "NewElectionStarted"].includes(event.eventName) && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {Object.entries(args).filter(([k]) => isNaN(Number(k))).map(([k, v]) => (
              <div key={k} className="contents">
                <span className="text-app-muted-text capitalize">{k}</span>
                <span className="text-app-heading font-mono">{formatValue(k, v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveBlockchainDashboard() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("All");
  const [stats, setStats] = useState({
    total: 0, votes: 0, candidates: 0, phaseChanges: 0, merkleUpdates: 0, identityUpdates: 0, elections: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const feedRef = useRef(null);
  const contractRef = useRef(null);

  useEffect(() => {
    if (!CONTRACT_ADDRESS_V3 || CONTRACT_ADDRESS_V3 === "0x0000000000000000000000000000000000000000") {
      setError("No contract address configured");
      setLoading(false);
      return;
    }

    let mounted = true;
    let provider;
    let contract;

    const attach = async () => {
      try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        contract = new ethers.Contract(CONTRACT_ADDRESS_V3, Election3ABI.abi, provider);
        contractRef.current = contract;

        if (!mounted) return;

        // Fetch recent logs for all event types
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 5000);

        const filterPromises = EVENT_NAMES.map(name => {
          try {
            return contract.queryFilter(name, fromBlock);
          } catch {
            return [];
          }
        });

        const results = await Promise.allSettled(filterPromises);
        if (!mounted) return;

        const historical = [];

        for (let i = 0; i < EVENT_NAMES.length; i++) {
          const result = results[i];
          if (result.status !== "fulfilled" || !Array.isArray(result.value)) continue;
          for (const log of result.value) {
            const args = {};
            try {
              const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
              if (parsed) {
                parsed.args.forEach((val, idx) => {
                  const key = parsed.fragment.inputs[idx]?.name || `arg${idx}`;
                  args[key] = val;
                });
              }
            } catch { /* ignore parse errors */ }

            let timestamp = null;
            try {
              const block = await provider.getBlock(log.blockNumber);
              timestamp = block?.timestamp;
            } catch { /* ignore */ }

            historical.push({
              eventName: EVENT_NAMES[i],
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              logIndex: log.index,
              timestamp,
              args,
            });
          }
        }

        historical.sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) return b.blockNumber - a.blockNumber;
          return (b.logIndex || 0) - (a.logIndex || 0);
        });

        if (mounted) {
          setEvents(historical);
          updateStats(historical);
          setLoading(false);
        }
      } catch (err) {
        console.error("Blockchain dashboard init error:", err);
        if (mounted) {
          setError(err.message || "Failed to connect to RPC");
          setLoading(false);
        }
      }
    };

    attach();

    return () => { mounted = false; };
  }, []);

  // Subscribe to live events after historical load
  useEffect(() => {
    if (!contractRef.current || loading) return;

    const contract = contractRef.current;
    let mounted = true;

    const handleEvent = (eventName) => async (...args) => {
      if (!mounted) return;

      const event = args[args.length - 1];
      let timestamp = null;
      try {
        const block = await event.getBlock();
        timestamp = block.timestamp;
      } catch { /* ignore */ }

      const decoded = {};
      try {
        const parsed = contract.interface.parseLog({ topics: event.topics, data: event.data });
        if (parsed) {
          parsed.args.forEach((val, idx) => {
            const key = parsed.fragment.inputs[idx]?.name || `arg${idx}`;
            decoded[key] = val;
          });
        }
      } catch { /* ignore */ }

      const entry = {
        eventName,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.index,
        timestamp,
        args: decoded,
      };

      setEvents(prev => [entry, ...prev]);
      setStats(prev => {
        const updated = { ...prev, total: prev.total + 1 };
        updated.votes      += eventName === "VoteCast" ? 1 : 0;
        updated.candidates += eventName === "CandidateRegistered" ? 1 : 0;
        updated.phaseChanges      += eventName === "PhaseChanged" ? 1 : 0;
        updated.merkleUpdates      += eventName === "MerkleRootUpdated" ? 1 : 0;
        updated.identityUpdates    += eventName === "IdentityMerkleRootUpdated" ? 1 : 0;
        updated.elections          += eventName === "NewElectionStarted" ? 1 : 0;
        return updated;
      });
    };

    const listeners = {};
    for (const name of EVENT_NAMES) {
      listeners[name] = handleEvent(name);
      try {
        contract.on(name, listeners[name]);
      } catch (err) {
        console.warn(`Failed to subscribe to ${name}:`, err);
      }
    }

    return () => {
      mounted = false;
      for (const name of EVENT_NAMES) {
        try {
          contract.off(name, listeners[name]);
        } catch { /* ignore */ }
      }
    };
  }, [loading]);

  // Scroll to top when new events arrive
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [events.length]);

  const updateStats = (eventList) => {
    const s = { total: 0, votes: 0, candidates: 0, phaseChanges: 0, merkleUpdates: 0, identityUpdates: 0, elections: 0 };
    for (const e of eventList) {
      s.total++;
      s.votes      += e.eventName === "VoteCast" ? 1 : 0;
      s.candidates += e.eventName === "CandidateRegistered" ? 1 : 0;
      s.phaseChanges      += e.eventName === "PhaseChanged" ? 1 : 0;
      s.merkleUpdates      += e.eventName === "MerkleRootUpdated" ? 1 : 0;
      s.identityUpdates    += e.eventName === "IdentityMerkleRootUpdated" ? 1 : 0;
      s.elections          += e.eventName === "NewElectionStarted" ? 1 : 0;
    }
    setStats(s);
  };

  const filtered = useMemo(() => {
    if (filter === "All") return events;
    return events.filter(e => e.eventName === filter);
  }, [events, filter]);

  const tabCounts = useMemo(() => {
    const counts = { All: events.length };
    for (const name of EVENT_NAMES) {
      counts[name] = events.filter(e => e.eventName === name).length;
    }
    return counts;
  }, [events]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Blockchain Activity Feed</h3>
          <span className="text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">Sepolia</span>
        </div>
        <div className="rounded-xl border border-app bg-app-surface p-8 text-center space-y-3">
          <div className="animate-spin mx-auto h-6 w-6 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full" />
          <p className="text-xs text-app-muted-text">Querying on-chain event logs (last 5000 blocks)…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>
          <h3 className="text-sm font-bold text-rose-400 uppercase tracking-widest">Blockchain Activity Feed</h3>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
          <p className="text-sm text-rose-400">{error}</p>
          <p className="text-xs text-app-muted-text mt-2">Check your RPC connection and contract address configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Blockchain Activity Feed</h3>
          <span className="text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">Sepolia</span>
        </div>
        <a
          href={`${SEPOLIA_EXPLORER}/address/${CONTRACT_ADDRESS_V3}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-app-muted-text hover:text-app-accent transition-colors underline underline-offset-2"
        >
          View Contract ↗
        </a>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        <StatCard label="Total" value={stats.total} color="emerald" />
        <StatCard label="Votes" value={stats.votes} color="emerald" />
        <StatCard label="Candidates" value={stats.candidates} color="blue" />
        <StatCard label="Phases" value={stats.phaseChanges} color="amber" />
        <StatCard label="Merkle" value={stats.merkleUpdates} color="violet" />
        <StatCard label="Identity" value={stats.identityUpdates} color="cyan" />
        <StatCard label="Elections" value={stats.elections} color="rose" />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        <FilterTab active={filter === "All"} onClick={() => setFilter("All")}>
          All <span className="text-[10px] opacity-60">({tabCounts.All})</span>
        </FilterTab>
        {EVENT_NAMES.map(name => (
          <FilterTab key={name} active={filter === name} onClick={() => setFilter(name)}>
            {EVENT_META[name].icon} {EVENT_META[name].label} <span className="text-[10px] opacity-60">({tabCounts[name] || 0})</span>
          </FilterTab>
        ))}
      </div>

      {/* Events Feed */}
      <div
        ref={feedRef}
        className="space-y-2 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin"
      >
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-app bg-app-muted/20 p-8 text-center">
            <p className="text-sm text-app-muted-text">
              {filter === "All" ? "No on-chain events detected yet." : `No ${EVENT_META[filter]?.label || filter} events yet.`}
            </p>
            <p className="text-xs text-app-muted-text mt-1">
              Events will appear here in real-time as they are mined on Sepolia.
            </p>
          </div>
        ) : (
          filtered.map((ev, i) => <EventCard key={`${ev.txHash}-${ev.logIndex}-${i}`} event={ev} />)
        )}
      </div>

      <p className="text-[10px] text-app-muted-text leading-relaxed italic">
        Connected to <span className="font-mono">publicnode.com</span> (Sepolia). All event data is fetched directly from the blockchain — no backend cache involved.
      </p>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const dotColors = {
    emerald: "bg-emerald-400",
    blue:    "bg-sky-400",
    amber:   "bg-amber-400",
    violet:  "bg-violet-400",
    cyan:    "bg-cyan-400",
    rose:    "bg-rose-400",
  };
  return (
    <div className="rounded-xl border border-app bg-app-surface px-3 py-2.5 text-center">
      <p className="text-lg font-black text-app-heading">{value}</p>
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColors[color] || "bg-emerald-400"}`} />
        <p className="text-[10px] font-bold uppercase tracking-wider text-app-muted-text">{label}</p>
      </div>
    </div>
  );
}

function FilterTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
        active
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-app-surface text-app-muted-text border-app hover:border-app-accent/30 hover:text-app-heading"
      }`}
    >
      {children}
    </button>
  );
}
