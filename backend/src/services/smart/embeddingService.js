// Minimal embedding stub: tokenize and compute pseudo-embedding (term frequency)
export function embedText(text) {
  const tokens = String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  // Represent as array of { t, f }
  return Object.entries(freq).map(([t,f]) => ({ t, f }));
}

