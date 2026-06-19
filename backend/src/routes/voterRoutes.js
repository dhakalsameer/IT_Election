import express from "express";
import { bulkVerifyVoters, getMe, getPendingVoters, revokeVoter, getProof } from "../controllers/voterController.js";
import { verifyAdmin } from "../middleware/admin.js";

const router = express.Router();

router.get("/me", getMe);
router.get("/pending", getPendingVoters);
router.get("/proof", getProof);
router.post("/verify-bulk", verifyAdmin, bulkVerifyVoters);
router.post("/revoke", verifyAdmin, revokeVoter);

export default router;
