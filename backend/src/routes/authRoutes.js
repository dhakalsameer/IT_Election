import express from "express";
import {
  registerStudent,
  loginStudent,
  getProfile,
  updateProfile,
  verifyCode,
} from "../controllers/authController.js";
import { uploadMiddleware, uploadPhoto } from "../controllers/uploadController.js";
import { requireStudentAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/verify-code", verifyCode);
router.post("/register", registerStudent);
router.post("/login", loginStudent);

router.get("/me", requireStudentAuth, getProfile);
router.patch("/me", requireStudentAuth, updateProfile);

// Photo upload (multipart/form-data, field name "photo")
router.post(
  "/me/photo",
  requireStudentAuth,
  uploadMiddleware,
  uploadPhoto
);

export default router;
