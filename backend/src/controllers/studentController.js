import bcrypt from "bcrypt";
import { db } from "../db.js";

const VALID_YEARS = ["1st", "2nd", "3rd", "4th"];
const VALID_GENDERS = ["male", "female", "other"];

export const createStudent = async (req, res) => {
  const { student_id, name, wallet_address, image_cid } = req.body;

  const result = await db.query(
    `INSERT INTO students (student_id, name, wallet_address, image_cid)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [student_id, name, wallet_address, image_cid]
  );

  res.json(result.rows[0]);
};

export const getStudents = async (req, res) => {
  const result = await db.query("SELECT * FROM students");
  res.json(result.rows);
};

export const getAllStudents = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT student_id, name, year, gender, wallet_address, wallet_verified, eligible_to_vote, image_cid
       FROM students
       ORDER BY year, student_id`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("getAllStudents error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { student_id } = req.params;
    if (!student_id) {
      return res.status(400).json({ error: "student_id is required" });
    }
    const result = await db.query(
      `DELETE FROM students WHERE student_id = $1 RETURNING student_id, name`,
      [student_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error("deleteStudent error:", error);
    res.status(500).json({ error: "Delete failed" });
  }
};

export const bulkImportStudents = async (req, res) => {
  try {
    const { students, defaultPassword } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: "students array is required" });
    }
    if (!defaultPassword || defaultPassword.length < 6) {
      return res.status(400).json({ error: "defaultPassword must be at least 6 characters" });
    }

    const password_hash = await bcrypt.hash(defaultPassword, 10);
    const errors = [];
    const imported = [];

    for (const s of students) {
      const { student_id, name, year, gender } = s;

      if (!student_id || !name) {
        errors.push({ student_id: student_id || "?", reason: "Missing student_id or name" });
        continue;
      }
      if (year && !VALID_YEARS.includes(year)) {
        errors.push({ student_id, reason: `Invalid year: ${year}` });
        continue;
      }
      if (gender && !VALID_GENDERS.includes(gender)) {
        errors.push({ student_id, reason: `Invalid gender: ${gender}` });
        continue;
      }

      try {
        const result = await db.query(
          `INSERT INTO students (student_id, name, year, gender, password_hash)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (student_id) DO NOTHING
           RETURNING student_id`,
          [student_id.trim(), name.trim(), year || null, gender || null, password_hash]
        );
        if (result.rows.length > 0) {
          imported.push(student_id.trim());
        }
      } catch (err) {
        errors.push({ student_id, reason: err.message });
      }
    }

    res.json({
      success: true,
      importedCount: imported.length,
      imported,
      skippedCount: Math.max(0, students.length - imported.length - errors.length),
      errors,
    });
  } catch (error) {
    console.error("bulkImportStudents error:", error);
    res.status(500).json({ error: "Bulk import failed" });
  }
};
