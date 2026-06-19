import express from "express";
import { generateCodes, listCodes } from "../controllers/registrationCodeController.js";
import { verifyAdmin } from "../middleware/admin.js";

const router = express.Router();

router.post("/generate-codes", verifyAdmin, generateCodes);
router.get("/codes", verifyAdmin, listCodes);

export default router;
