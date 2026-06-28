import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { createIntent, getIntent, mockSucceed, webhookCBE, webhookAwash, initiateFromPayment } from "../controller/paymentIntentController.js";
import { Document } from "../models/Document.js";
import path from "path";
import fs from "fs";

const router = express.Router();

// Create a payment intent (Importer, Finance Officer, Admin)
router.post("/intent", verifyToken, authorizeRoles("Importer", "Finance Officer", "Admin"), createIntent);

// Initiate provider checkout from existing payment row
router.post("/:id/initiate", verifyToken, authorizeRoles("Importer", "Finance Officer", "Admin"), initiateFromPayment);

// Get intent status
router.get("/intent/:id", verifyToken, authorizeRoles("Importer", "Finance Officer", "Admin"), getIntent);

// Mock success (dev only)
router.post("/mock/:id/succeed", verifyToken, authorizeRoles("Importer", "Finance Officer", "Admin"), mockSucceed);

// Webhooks (banks)
router.post("/webhook/cbe", webhookCBE);
router.post("/webhook/awash", webhookAwash);

// Stream receipt by declaration
router.get("/receipt/by-declaration/:id", async (req, res) => {
  try {
    const declId = req.params.id;
    const docs = await Document.getAll({ declaration_id: declId });
    const rec = (docs || []).find(d => String(d.title).toLowerCase() === 'payment receipt');
    if (!rec) return res.status(404).json({ message: 'Receipt not found' });
    const absolute = path.join(process.cwd(), rec.file_path.replace(/^\/*/, ''));
    if (!fs.existsSync(absolute)) return res.status(404).json({ message: 'File missing' });
    res.sendFile(absolute);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
