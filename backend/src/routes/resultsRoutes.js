import express from "express";
import { db } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM candidates ORDER BY vote_count DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/history", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT election_number, candidate_name, candidate_position, candidate_year, candidate_gender, candidate_photo, vote_count, snapshot_at
       FROM election_history
       ORDER BY election_number DESC, candidate_position, vote_count DESC`
    );

    const grouped = {};
    for (const row of result.rows) {
      const num = row.election_number;
      if (!grouped[num]) {
        grouped[num] = {
          election_number: num,
          snapshot_at: row.snapshot_at,
          candidates: [],
        };
      }
      grouped[num].candidates.push({
        name: row.candidate_name,
        position: row.candidate_position,
        vote_count: row.vote_count,
        year: row.candidate_year,
        gender: row.candidate_gender,
        photo: row.candidate_photo,
      });
    }

    res.json(Object.values(grouped).sort((a, b) => b.election_number - a.election_number));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
