import express from "express";
import { bankWebhook } from "../controller/paymentWorkflowController.js";

// Use raw body to verify HMAC signature
const router = express.Router();
router.post("/webhook", express.raw({ type: "*/*" }), bankWebhook);

export default router;

