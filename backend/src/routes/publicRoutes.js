import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { Document } from '../models/Document.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'Ethiopian Import Customs API',
    checked_at: new Date().toISOString(),
  });
});

router.post('/verify-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const matches = await Document.findByHash(hash);
    const items = matches.map(m => ({
      document_id: m.document_id,
      title: m.title,
      declaration_id: m.declaration_id,
      file_name: m.file_name,
      file_type: m.file_type,
      file_size: m.file_size,
      uploaded_at: m.uploaded_at,
      blockchain_status: m.blockchain_status,
      blockchain_tx: m.blockchain_tx,
      blockchain_network: m.blockchain_network,
    }));
    res.json({ ok: items.length > 0, hash, matches: items });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
