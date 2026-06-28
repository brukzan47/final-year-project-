import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

export function getTransporter() {
  if (!env.mail.enabled) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: env.mail.user && env.mail.pass ? { user: env.mail.user, pass: env.mail.pass } : undefined,
  });
  return transporter;
}

export async function sendMail({ to, subject, text, html, attachments }) {
  try {
    const tx = getTransporter();
    if (!tx) return { skipped: true };
    await tx.sendMail({ from: env.mail.from, to, subject, text, html, attachments });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

