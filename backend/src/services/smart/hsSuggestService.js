// Simple HS suggestions by keyword heuristics (MVP)
export function suggestHs({ description = "" }) {
  const d = String(description || '').toLowerCase();
  const out = [];
  const push = (code, label, score) => out.push({ code, label, score });
  if (/phone|smartphone|mobile|handset/.test(d)) push('8517.12', 'Telephones for cellular networks', 0.9);
  if (/laptop|notebook|computer|pc/.test(d)) push('8471.30', 'Portable digital automatic data processing machines', 0.85);
  if (/sugar|sucrose/.test(d)) push('1701.12', 'Cane or beet sugar', 0.8);
  if (/car|vehicle|automobile/.test(d)) push('8703.23', 'Motor cars and other motor vehicles', 0.75);
  if (/textile|fabric|garment|cloth/.test(d)) push('6006.32', 'Fabrics knitted or crocheted', 0.7);
  if (out.length === 0 && d) push('9999.00', 'Other', 0.3);
  return out.slice(0, 5);
}

export function estimateValue({ hs_code = '', quantity = 1, unit = 'pcs' }) {
  const q = Number(quantity || 1) || 1;
  // Very naive baseline values for demo
  let unitPrice = 10;
  if (/8517/.test(hs_code)) unitPrice = 120;
  if (/8471/.test(hs_code)) unitPrice = 550;
  if (/1701/.test(hs_code)) unitPrice = 0.4;
  if (/8703/.test(hs_code)) unitPrice = 6000;
  const value_usd = Math.round(unitPrice * q * 100) / 100;
  return [{ value_usd, range: [value_usd * 0.8, value_usd * 1.2], source: 'heuristic', score: 0.5 }];
}

