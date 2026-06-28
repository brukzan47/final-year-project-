const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:5000/api";

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const msg = await safeMessage(res);
    throw new Error(msg || `Login failed (${res.status})`);
  }
  return res.json();
}

export async function serviceHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API_BASE}/public/health`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Service unavailable (${res.status})`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function register(payload) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    const msg = await safeMessage(res);
    throw new Error(msg || `Registration failed (${res.status})`);
  }
  return res.json();
}

export async function getMe() {
  const token = (() => {
    try { const raw = localStorage.getItem('auth') || sessionStorage.getItem('auth'); return raw ? JSON.parse(raw).token : null; } catch { return null; }
  })();
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

export async function updateProfile(payload) {
  const token = (() => { try { const raw = localStorage.getItem('auth') || sessionStorage.getItem('auth'); return raw ? JSON.parse(raw).token : null; } catch { return null; } })();
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const msg = await safeMessage(res); throw new Error(msg || 'Update failed'); }
  return res.json();
}

export async function changePassword(payload) {
  const token = (() => { try { const raw = localStorage.getItem('auth') || sessionStorage.getItem('auth'); return raw ? JSON.parse(raw).token : null; } catch { return null; } })();
  const res = await fetch(`${API_BASE}/auth/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const msg = await safeMessage(res); throw new Error(msg || 'Password change failed'); }
  return res.json();
}

// Best-effort forgot password; backend endpoint may differ.
export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const msg = await safeMessage(res);
    throw new Error(msg || `Reset failed (${res.status})`);
  }
  return res.json();
}

async function safeMessage(res) {
  try {
    const data = await res.json();
    return data?.message || "";
  } catch {
    return "";
  }
}
