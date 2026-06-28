import crypto from "crypto";

export function hmacValid({ body, secret, signature }) {
  try {
    if (!secret) return true; // if not configured, skip verification
    const payload = typeof body === 'string' ? body : JSON.stringify(body || {});
    const h = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return typeof signature === 'string' && signature.toLowerCase() === h.toLowerCase();
  } catch {
    return false;
  }
}

