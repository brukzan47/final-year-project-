// OCR service stub: returns placeholder fields; integrate provider later
export async function extractFields({ document_id, file_name = '' }) {
  const lower = String(file_name || '').toLowerCase();
  const fields = {};
  if (lower.includes('invoice')) fields.invoice_no = `INV-${Date.now().toString().slice(-6)}`;
  if (lower.includes('packing')) fields.package_count = 1;
  return { fields, confidence: Object.fromEntries(Object.keys(fields).map(k => [k, 0.6])) };
}

