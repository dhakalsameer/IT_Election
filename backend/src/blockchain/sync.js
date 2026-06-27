import { ethers } from "ethers";
import { electionContractV3 } from "./electionContract.js";
import { db } from "../db.js";
import { addEvent, seedHistoricalEvents } from "../services/eventStore.js";

const POLL_MS = 10000;

export function startBlockchainSync(io) {
  console.log("🔄 Blockchain sync engine running (Poll-based)...");

  let prevVotes = {};
  let prevPhase = null;
  let prevElectionId = 0;
  let prevCandidateCount = 0;
  let snapshotInProgress = false;

  async function emitEvent(event) {
    try {
      await addEvent(event);
    } catch (err) {
      console.error("Failed to persist event:", err.message);
    }
    if (io) io.emit("blockchainEvent", event);
  }

  async function broadcastResults() {
    if (!io) return;
    try {
      const result = await db.query(
        "SELECT blockchain_id as id, name, position, vote_count FROM candidates ORDER BY vote_count DESC"
      );
      io.emit("voteUpdate", result.rows);
    } catch (err) {
      console.error("Broadcast results error:", err.message);
    }
  }

  function positionToString(pos) {
    if (Number(pos) === 0) return "President";
    if (Number(pos) === 1) return "Secretary";
    return "General Member";
  }

  async function upsertCandidate(cand) {
    const id = Number(cand.id);
    const position = positionToString(cand.position);
    await db.query(
      `INSERT INTO candidates (blockchain_id, name, position, vote_count, year, gender, image_cid, status, wallet_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', NULL)
       ON CONFLICT (blockchain_id) WHERE blockchain_id IS NOT NULL
       DO UPDATE SET vote_count = $4, name = $2, position = $3`,
      [
        id,
        cand.name,
        position,
        Number(cand.voteCount),
        String(cand.year),
        cand.isFemale ? "female" : "male",
        cand.imageCID || null,
      ]
    );
    return id;
  }

  async function snapshotResults(electionNum) {
    try {
      const snapRes = await db.query(
        `SELECT name, position, vote_count, year, gender, image_cid
         FROM candidates WHERE status = 'approved' ORDER BY position, vote_count DESC`
      );
      if (snapRes.rows.length > 0) {
        for (const row of snapRes.rows) {
          await db.query(
            `INSERT INTO election_history (election_number, candidate_name, candidate_position, vote_count, candidate_year, candidate_gender, candidate_photo)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [electionNum, row.name, row.position, row.vote_count, row.year, row.gender, row.image_cid]
          );
        }
        console.log(`   → Snapshot saved for election #${electionNum} (${snapRes.rows.length} candidates)`);
      }
    } catch (err) {
      console.error("Snapshot error:", err.message);
    }
  }

  async function checkPhase() {
    try {
      const phase = Number(await electionContractV3.getPhase());
      const eid = Number(await electionContractV3.currentElectionId());

      // Detect new election: either by phase transition (3→0) or by election ID increment
      const newElectionDetected =
        (prevPhase !== null && prevPhase === 3 && phase === 0) ||
        (prevElectionId > 0 && eid > prevElectionId);

      if (newElectionDetected) {
        const prevElectionNum = eid - 1;
        console.log(`🏁 New election detected (ID: ${eid}), snapshotting election #${prevElectionNum}`);
        snapshotInProgress = true;
        // Snapshot BEFORE clearing — captures old candidates
        await snapshotResults(prevElectionNum);
        // Clear old candidate data and events for the new cycle
        await db.query("DELETE FROM candidates");
        await db.query("DELETE FROM events");
        prevVotes = {};
        prevCandidateCount = 0;
        snapshotInProgress = false;
        await emitEvent({
          eventName: "NewElectionStarted",
          txHash: null,
          blockNumber: null,
          args: { electionId: eid },
        });
      }
      if (prevPhase !== phase) {
        await emitEvent({
          eventName: "PhaseChanged",
          txHash: null,
          blockNumber: null,
          args: { newPhase: phase },
        });
      }
      prevPhase = phase;
      prevElectionId = eid;
    } catch (err) {
      console.error("Phase check error:", err.message);
    }
  }

  async function syncAll() {
    try {
      if (snapshotInProgress) return;
      const provider = electionContractV3.runner?.provider;
      if (!provider) return;

      const cc = Number(await electionContractV3.candidateCount());
      let anyChange = false;

      for (let i = 1; i <= cc; i++) {
        const cand = await electionContractV3.getCandidate(i);
        if (!cand.exists) continue;

        const id = Number(cand.id);
        const onChainVotes = Number(cand.voteCount);
        const isNew = !(id in prevVotes);
        const prev = prevVotes[id] || 0;

        // Upsert candidate record (insert if new, update if exists)
        await upsertCandidate(cand);

        // Emit event for new candidate registration
        if (isNew) {
          console.log(`📝 New candidate detected: ${cand.name} (${positionToString(cand.position)})`);
          prevVotes[id] = onChainVotes;
          await emitEvent({
            eventName: "CandidateRegistered",
            txHash: null,
            blockNumber: null,
            args: {
              id: id,
              name: cand.name,
              position: Number(cand.position),
              candidate: null,
              imageCID: cand.imageCID || "",
            },
          });
        }

        // Handle vote changes
        if (onChainVotes !== prev) {
          anyChange = true;
          const diff = onChainVotes - prev;

          if (diff > 0) {
            console.log(`🗳️ ${cand.name} gained ${diff} vote(s) (now ${onChainVotes})`);
          }

          await db.query(
            `UPDATE candidates SET vote_count = $1 WHERE blockchain_id = $2`,
            [onChainVotes, id]
          );

          for (let v = 0; v < diff; v++) {
            await emitEvent({
              eventName: "VoteCast",
              txHash: null,
              blockNumber: null,
              args: { candidateId: id },
            });
          }

          prevVotes[id] = onChainVotes;
        }
      }

      if (prevCandidateCount !== cc) {
        anyChange = true;
        prevCandidateCount = cc;
      }

      if (anyChange) {
        broadcastResults();
      }
    } catch (err) {
      console.error("Sync error:", err.message);
    }
  }

  if (
    electionContractV3.target &&
    electionContractV3.target !== "0x0000000000000000000000000000000000000000"
  ) {
    // Initial sync
    (async () => {
      try {
        prevPhase = Number(await electionContractV3.getPhase());
        prevElectionId = Number(await electionContractV3.currentElectionId());
        prevCandidateCount = Number(await electionContractV3.candidateCount());

        // New election cycle — clear old data from DB
        if (prevPhase === 0 && prevCandidateCount === 0) {
          await db.query("DELETE FROM candidates");
          await db.query("DELETE FROM events");
        }

        for (let i = 1; i <= prevCandidateCount; i++) {
          const cand = await electionContractV3.getCandidate(i);
          if (!cand.exists) continue;
          const id = Number(cand.id);
          const votes = Number(cand.voteCount);
          await upsertCandidate(cand);
          prevVotes[id] = votes;
        }

        const total = Object.values(prevVotes).reduce((a, b) => a + b, 0);
        console.log(`✅ Initial sync — ${prevCandidateCount} candidates, ${total} votes, phase ${prevPhase}`);
        broadcastResults();
        await seedHistoricalEvents();
      } catch (err) {
        console.error("Initial sync error:", err.message);
      }
    })();

    setInterval(syncAll, POLL_MS);
    setInterval(checkPhase, POLL_MS);
  }
}
