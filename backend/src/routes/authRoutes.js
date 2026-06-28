import express from "express";
import { loginUser, registerUser, getMe, updateProfile, changePassword } from "../controller/authController.js";
import { verifyToken } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

// POST /api/auth/login
router.post("/login", rateLimit({ windowMs: 15 * 60_000, max: 20, scope: "auth-login" }), loginUser);
router.post("/register", rateLimit({ windowMs: 60 * 60_000, max: 10, scope: "auth-register" }), registerUser);

// GET /api/auth/me
router.get("/me", verifyToken, getMe);

// PUT /api/auth/profile (update full name/email)
router.put("/profile", verifyToken, updateProfile);

// PUT /api/auth/password (change password)
router.put("/password", verifyToken, changePassword);

export default router;

