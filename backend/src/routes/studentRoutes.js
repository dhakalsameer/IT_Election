import express from "express";
import { createStudent, getStudents, getAllStudents, deleteStudent } from "../controllers/studentController.js";
import { verifyAdmin } from "../middleware/admin.js";

const router = express.Router();

router.post("/", createStudent);
router.get("/", getStudents);
router.get("/all", getAllStudents);
router.delete("/:student_id", verifyAdmin, deleteStudent);

export default router;
