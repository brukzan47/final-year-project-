export function scoreRisk({ shipment = {}, performance = null }) {
  let score = 0;
  const reasons = [];

  const cif = Number(shipment.cif_value_usd || 0);
  if (isFinite(cif)) {
    if (cif > 500000) { score += 50; reasons.push("High CIF value (> 500k USD)"); }
    else if (cif > 100000) { score += 30; reasons.push("Elevated CIF value (> 100k USD)"); }
  }

  const goods = String(shipment.goods_type || '').toLowerCase();
  if (["chemicals","pharmaceuticals","electronics"].some(k => goods.includes(k))) {
    score += 15; reasons.push("Sensitive goods category");
  }

  const origin = String(shipment.origin_country || '').toLowerCase();
  const watchlist = ["somalia","yemen","afghanistan","syria","libya"]; 
  if (watchlist.some(w => origin.includes(w))) { score += 20; reasons.push("High-risk origin country"); }

  if (performance) {
    const queries = Number(performance.number_of_queries || 0);
    const penalties = String(performance.penalties || '').toLowerCase();
    const feedback = Number(performance.feedback_score || 5);
    if (queries > 3) { score += 10; reasons.push("Frequent customs queries historically"); }
    if (penalties && penalties !== 'none') { score += 10; reasons.push("Prior penalties noted"); }
    if (isFinite(feedback) && feedback < 3) { score += 10; reasons.push("Low feedback score"); }
  }

  let channel = 'Green';
  if (score >= 60) channel = 'Red';
  else if (score >= 30) channel = 'Yellow';

  return { channel, score, reasons };
}

