import crypto from "crypto";
import { db } from "../db.js";

/**
 * Generate a human-friendly code: XXXX-XXXX-XXXX (12 uppercase alphanumeric chars).
 */
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit 0, O, I, 1 for readability
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

/**
 * POST /api/admin/generate-codes
 * Body: { studentIds: string[] }
 *
 * Bulk generates one unique registration code per student ID.
 * Returns a list of { student_id, code } pairs.
 * If a code already exists for a student_id, it is skipped (idempotent).
 */
export const generateCodes = async (req, res) => {
  try {
    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: "studentIds must be a non-empty array" });
    }

    // Trim and upper-case for consistency
    const normalized = [...new Set(studentIds.map((id) => String(id).trim()).filter(Boolean))];

    if (normalized.length === 0) {
      return res.status(400).json({ error: "No valid studentIds provided" });
    }

    const inserted = [];

    for (const studentId of normalized) {
      // Check if a code already exists for this student
      const existing = await db.query(
        "SELECT code FROM registration_codes WHERE student_id = $1 AND used = false LIMIT 1",
        [studentId]
      );

      if (existing.rows.length > 0) {
        // Already has an unused code — return it instead of creating a duplicate
        inserted.push({ student_id: studentId, code: existing.rows[0].code });
        continue;
      }

      // Prevent collisions with a retry loop
      let code = generateCode();
      let attempts = 0;
      while (attempts < 5) {
        try {
          await db.query(
            "INSERT INTO registration_codes (student_id, code) VALUES ($1, $2)",
            [studentId, code]
          );
          inserted.push({ student_id: studentId, code });
          break;
        } catch (err) {
          // If unique violation, retry with a new code
          if (err.code === "23505") {
            code = generateCode();
            attempts++;
            continue;
          }
          throw err;
        }
      }
    }

    return res.status(201).json({
      message: "Registration codes generated",
      count: inserted.length,
      codes: inserted,
    });
  } catch (error) {
    console.error("generateCodes error:", error);
    return res.status(500).json({ error: "Failed to generate registration codes" });
  }
};

/**
 * GET /api/admin/codes
 * Query: ?used=true|false&studentId=GU001
 *
 * List registration codes (optionally filtered).
 */
export const listCodes = async (req, res) => {
  try {
    const { used, studentId } = req.query;
    let sql = `SELECT id, student_id, code, used, created_at, used_at FROM registration_codes`;
    const where = [];
    const params = [];

    if (used !== undefined) {
      params.push(used === "true");
      where.push(`used = $${params.length}`);
    }
    if (studentId) {
      params.push(studentId);
      where.push(`student_id = $${params.length}`);
    }

    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }

    sql += " ORDER BY created_at DESC";

    const result = await db.query(sql, params);
    return res.json({ codes: result.rows });
  } catch (error) {
    console.error("listCodes error:", error);
    return res.status(500).json({ error: "Failed to list registration codes" });
  }
};
