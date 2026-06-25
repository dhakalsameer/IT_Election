import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { getCandidates } from "../controllers/candidateController.js";
import { config } from "../config/env.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) {
      return cb(new Error("Only PNG/JPEG/WEBP/GIF images are allowed"));
    }
    cb(null, true);
  },
});

const router = express.Router();

router.get("/", getCandidates);

router.post("/upload-photo", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "photo file is required" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
    const filename = `${crypto.randomBytes(16).toString("hex")}${ext}`;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer);

    const base = config.publicUrl || `http://localhost:${config.port || 5000}`;
    const url = `${base}/uploads/${filename}`;

    res.json({ success: true, url, filename });
  } catch (error) {
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

export default router;
