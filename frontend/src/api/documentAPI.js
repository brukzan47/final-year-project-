import { api } from "./client.js";

export const DocumentsAPI = {
  listByDeclaration: (declaration_id) => api.get(`/documents?declaration_id=${encodeURIComponent(declaration_id)}`),
  uploadBatch: (formData) => api.postForm('/documents/batch', formData),
  upload: (formData) => api.postForm('/documents', formData),
  linkToShipment: ({ shipment_id, document_ids }) => api.post('/documents/link-shipment', { shipment_id, document_ids }),
  delete: (document_id) => api.del(`/documents/${encodeURIComponent(document_id)}`),
  verify: (declaration_id) => api.get(`/documents/verify?declaration_id=${encodeURIComponent(declaration_id)}`),
  anchor: (document_id) => api.post(`/documents/${encodeURIComponent(document_id)}/anchor`),
  verifyHash: (document_id) => api.get(`/documents/${encodeURIComponent(document_id)}/verify-hash`),
  downloadFile: (document_id) => api.download(`/documents/${encodeURIComponent(document_id)}/file`),
};
