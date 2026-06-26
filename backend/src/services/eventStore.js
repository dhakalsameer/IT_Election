import { db } from "../db.js";

const MAX_EVENTS = 500;

let cache = [];
let loaded = false;

async function loadCache() {
  if (loaded) return;
  const result = await db.query(
    `SELECT id, event_name, tx_hash, block_number, log_index, args, timestamp
     FROM events ORDER BY timestamp DESC, id DESC LIMIT $1`,
    [MAX_EVENTS]
  );
  cache = result.rows.map(r => ({
    eventName: r.event_name,
    txHash: r.tx_hash,
    blockNumber: r.block_number,
    logIndex: r.log_index,
    args: r.args || {},
    timestamp: Number(r.timestamp),
  }));
  loaded = true;
}

export async function addEvent(event) {
  const timestamp = event.timestamp || Math.floor(Date.now() / 1000);
  const args = event.args || {};

  await db.query(
    `INSERT INTO events (event_name, tx_hash, block_number, log_index, args, timestamp)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [event.eventName, event.txHash || null, event.blockNumber || null, event.logIndex || null, JSON.stringify(args), timestamp]
  );

  cache.unshift({
    eventName: event.eventName,
    txHash: event.txHash || null,
    blockNumber: event.blockNumber || null,
    logIndex: event.logIndex || null,
    args,
    timestamp,
  });
  if (cache.length > MAX_EVENTS) cache.pop();
}

export async function getEvents(limit = 100) {
  await loadCache();
  return cache.slice(0, limit);
}

export async function seedHistoricalEvents() {
  await loadCache();
  if (cache.length > 0) return;

  const entries = [];

  // Phase → Created (phase 0 is the starting phase)
  entries.push({
    eventName: "PhaseChanged",
    txHash: null,
    blockNumber: null,
    args: { newPhase: 0 },
    timestamp: Math.floor(Date.now() / 1000) - 86400,
  });

  // CandidateRegistered from DB candidates
  const candRes = await db.query(
    "SELECT name, position, blockchain_id, image_cid, created_at FROM candidates WHERE blockchain_id IS NOT NULL ORDER BY blockchain_id"
  );
  for (const c of candRes.rows) {
    const ts = c.created_at
      ? Math.floor(new Date(c.created_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    entries.push({
      eventName: "CandidateRegistered",
      txHash: null,
      blockNumber: null,
      args: { id: c.blockchain_id, name: c.name, position: Number(c.position ?? 2), candidate: null, imageCID: c.image_cid || "" },
      timestamp: ts,
    });
  }

  // Aggregated VoteCast events per candidate
  const voteRes = await db.query(
    "SELECT name, blockchain_id, vote_count FROM candidates WHERE vote_count > 0 AND blockchain_id IS NOT NULL ORDER BY blockchain_id"
  );
  for (const c of voteRes.rows) {
    for (let v = 0; v < Number(c.vote_count); v++) {
      entries.push({
        eventName: "VoteCast",
        txHash: null,
        blockNumber: null,
        args: { candidateId: c.blockchain_id, voter: null },
        timestamp: Math.floor(Date.now() / 1000) - 3600 + v,
      });
    }
  }

  // NewElectionStarted from election_history
  const histRes = await db.query(
    "SELECT DISTINCT election_number FROM election_history ORDER BY election_number DESC LIMIT 1"
  );
  if (histRes.rows.length > 0) {
    const lastElectionNum = histRes.rows[0].election_number;
    entries.push({
      eventName: "NewElectionStarted",
      txHash: null,
      blockNumber: null,
      args: { electionId: lastElectionNum + 1 },
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  // Insert in chronological order
  entries.sort((a, b) => a.timestamp - b.timestamp);
  for (const e of entries) {
    await addEvent(e);
  }

  if (entries.length > 0) {
    console.log(`   → Seeded ${entries.length} historical events from DB`);
  }
}
