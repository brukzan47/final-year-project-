import fs from "fs";
import path from "path";

const TYPE_PATTERNS = [
  ["commercial_invoice", /commercial|invoice|\binv\b/i],
  ["packing_list", /packing/i],
  ["bill_of_lading", /bill[_\s-]?of[_\s-]?lading|\bbol\b|lading/i],
  ["airway_bill", /airway|\bawb\b/i],
  ["certificate_of_origin", /certificate[_\s-]?of[_\s-]?origin|\bcoo\b|origin/i],
  ["import_permit", /import[_\s-]?permit|permit/i],
  ["letter_of_credit", /letter[_\s-]?of[_\s-]?credit|\blc\b/i],
  ["insurance_certificate", /insurance/i],
];

function confidenceFromFields(fields, value = 0.7) {
  return Object.fromEntries(Object.keys(fields).map((key) => [key, value]));
}

function normalizeText(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectDocumentType({ title = "", file_name = "" }) {
  const source = `${title} ${file_name}`;
  const match = TYPE_PATTERNS.find(([, pattern]) => pattern.test(source));
  return match ? match[0] : "supporting_document";
}

function readLocalText(filePath, fileType = "") {
  const resolved = filePath ? path.resolve(process.cwd(), filePath) : "";
  if (!resolved || !fs.existsSync(resolved)) return "";

  const ext = path.extname(resolved).toLowerCase();
  const type = String(fileType || "").toLowerCase();
  const textLike = /text|json|csv|xml|html/.test(type) || [".txt", ".csv", ".json", ".xml", ".html"].includes(ext);
  const pdfLike = type.includes("pdf") || ext === ".pdf";

  try {
    const stat = fs.statSync(resolved);
    if (stat.size > 2 * 1024 * 1024) return "";
    const buffer = fs.readFileSync(resolved);
    if (textLike) return buffer.toString("utf8");
    if (pdfLike) {
      return buffer
        .toString("latin1")
        .match(/[A-Za-z0-9][A-Za-z0-9\s.,:/#()_-]{2,}/g)
        ?.join(" ") || "";
    }
  } catch {}

  return "";
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return normalizeText(match[1]);
  }
  return null;
}

function extractKnownFields(text) {
  const fields = {};
  const source = normalizeText(text);

  const invoiceNo = firstMatch(source, [
    /\binv\b\s*(?:no|number|#|:|-)?\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
    /\binvoice\s*(?:no|number|#|:|-)\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
  ]);
  if (invoiceNo) fields.invoice_no = invoiceNo;

  const blNo = firstMatch(source, [
    /\b(?:bill of lading|bol|bl)\s*(?:no|number|#|:)?\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
  ]);
  if (blNo) fields.bill_of_lading_no = blNo;

  const awbNo = firstMatch(source, [
    /\b(?:airway bill|awb)\s*(?:no|number|#|:)?\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
  ]);
  if (awbNo) fields.airway_bill_no = awbNo;

  const permitNo = firstMatch(source, [
    /\b(?:permit|import permit)\s*(?:no|number|#|:)?\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
  ]);
  if (permitNo) fields.permit_no = permitNo;

  const hsCode = firstMatch(source, [
    /\b(?:hs|hscode|tariff)\s*(?:code|:)?\s*(\d{4}(?:[.\s-]?\d{2}){0,2})\b/i,
    /\b(\d{4}\.\d{2}(?:\.\d{2})?)\b/,
  ]);
  if (hsCode) fields.hs_code = hsCode.replace(/\s+/g, "");

  const amount = firstMatch(source, [
    /\b(?:total|amount|invoice value|value)\s*(?:etb|usd|birr)?\s*(?:[:#-])?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
  ]);
  if (amount) fields.amount = amount.replace(/,/g, "");

  const currency = firstMatch(source, [
    /\b(USD|ETB|EUR|GBP|CNY|AED)\b/i,
  ]);
  if (currency) fields.currency = currency.toUpperCase();

  const date = firstMatch(source, [
    /\b(?:date|issued)\s*(?:[:#-])?\s*(\d{4}-\d{2}-\d{2})\b/i,
    /\b(?:date|issued)\s*(?:[:#-])?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i,
  ]);
  if (date) fields.document_date = date;

  const packageCount = firstMatch(source, [
    /\b(?:packages|package count|ctns|cartons)\s*(?:[:#-])?\s*(\d+)\b/i,
  ]);
  if (packageCount) fields.package_count = Number(packageCount);

  return fields;
}

export async function extractFields({
  document_id,
  file_name = "",
  title = "",
  file_type = "",
  file_size = null,
  file_path = "",
  ocr_enabled = false,
} = {}) {
  const readableText = readLocalText(file_path, file_type);
  const source = `${title} ${file_name} ${readableText}`;
  const fields = {
    document_id,
    document_type: detectDocumentType({ title, file_name }),
    file_name,
    title: title || null,
    extraction_mode: ocr_enabled ? "local_fallback_with_ocr_enabled" : "local_fallback",
    ...extractKnownFields(source),
  };

  if (file_type) fields.file_type = file_type;
  if (file_size != null) fields.file_size = Number(file_size);

  if (!fields.invoice_no && fields.document_type === "commercial_invoice") {
    fields.invoice_no = `INV-${Date.now().toString().slice(-6)}`;
  }
  if (!fields.package_count && fields.document_type === "packing_list") {
    fields.package_count = 1;
  }

  return {
    fields,
    confidence: confidenceFromFields(fields, readableText ? 0.78 : 0.62),
  };
}
