# Security Hardening Notes

Implemented baseline hardening:

- CORS is restricted with `CORS_ORIGINS`.
- API and auth endpoints have in-memory rate limits.
- JSON body size is limited.
- Raw `/uploads` static serving is disabled.
- Document files are served through authenticated `/api/documents/:id/file`.
- Finance permissions are centralized in `backend/src/utils/permissions.js`.
- Sensitive user, refund, and clearance operations write to `audit_logs`.
- Production and strict startup require a configured `JWT_SECRET`.

Production follow-ups:

- Replace in-memory rate limiting with Redis or gateway-level rate limiting.
- Move all startup schema changes to reviewed migrations.
- Add ledger tables for immutable accounting entries.
- Add malware scanning for uploaded documents.
- Expand automated tests to controller and integration coverage.
