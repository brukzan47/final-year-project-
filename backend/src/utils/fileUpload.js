import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Ensure upload directory exists
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeField = String(file.fieldname || "file").replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeField}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = new Map([
    ["application/pdf", [".pdf"]],
    ["image/jpeg", [".jpg", ".jpeg"]],
    ["image/png", [".png"]],
  ]);
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.get(file.mimetype)?.includes(ext)) cb(null, true);
  else cb(new Error("Invalid file type. Only PDF, JPG, PNG allowed."), false);
};

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});
