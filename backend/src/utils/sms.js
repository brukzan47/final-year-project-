import { env } from "../config/env.js";

// Minimal SMS abstraction; extend with real provider (e.g., Twilio) when creds are available
export async function sendSms({ to, message }) {
  try {
    if (!env.sms?.enabled) return { skipped: true };
    // Prefer Twilio if credentials are present
    if (process.env.TWILIO_ACCOUNT_SID || env.sms?.twilioSid) {
      return await sendSmsTwilio({ to, message });
    }
    // Fallback noop logger
    console.log(`[SMS] to=${to} message=${message}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Optional Twilio provider
export async function sendSmsTwilio({ to, message }) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID || env.sms?.twilioSid;
    const token = process.env.TWILIO_AUTH_TOKEN || env.sms?.twilioToken;
    const from = process.env.TWILIO_FROM || env.sms?.sender;
    if (!sid || !token || !from) return { skipped: true };
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const form = new URLSearchParams();
    form.append('From', from);
    form.append('To', to);
    form.append('Body', message);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`Twilio ${res.status}: ${t}`); }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
