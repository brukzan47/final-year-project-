const TARIC_LOOKUP_URL = import.meta?.env?.VITE_TARIC_LOOKUP_URL || "";

function withCode(url, code) {
  if (!url) return "";
  if (url.includes("{code}")) return url.replace("{code}", encodeURIComponent(code));
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}code=${encodeURIComponent(code)}`;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeLookupPayload(payload) {
  if (!payload) return null;

  const root = payload.data || payload.result || payload.item || payload;
  const desc = root.description || root.desc || root.goods_description || "";
  const dutyRate = root.duty_rate ?? root.duty ?? root.tariff_rate ?? null;
  const vatRate = root.vat_rate ?? root.vat ?? null;
  const source = root.source || payload.source || "taric";

  return {
    description: desc || "",
    dutyRate: dutyRate == null ? null : Number(dutyRate),
    vatRate: vatRate == null ? null : Number(vatRate),
    source,
    raw: payload,
  };
}

export const TaricAPI = {
  isConfigured: () => Boolean(TARIC_LOOKUP_URL),
  lookup: async (code) => {
    if (!TARIC_LOOKUP_URL) throw new Error("TARIC lookup endpoint is not configured");
    const url = withCode(TARIC_LOOKUP_URL, code);
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`TARIC lookup failed (HTTP ${res.status})`);
    }
    const payload = await safeJson(res);
    const normalized = normalizeLookupPayload(payload);
    if (!normalized) throw new Error("TARIC lookup returned an empty response");
    return normalized;
  },
};

