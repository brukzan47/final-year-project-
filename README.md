## Smart Search

Powerful, unified search across declarations, shipments, importers, documents, devices and tracking.

Features:
- Entities: Declarations, Shipments, Importers, Documents, Devices, Tracking
- Prefixes (exact where applicable):
  - `dec:` Declaration No (e.g., `dec:DEC-ET-2025-00001`)
  - `ref:` Shipment Reference (e.g., `ref:SHP-20251113-ABCD`)
  - `trk:` Tracking Ref (e.g., `trk:176-12345678`)
  - `hs:` HS code (e.g., `hs:8517`)
  - `imp:` Importer name (e.g., `imp:"Abebe PLC"`)
  - `doc:` Document file name (e.g., `doc:invoice.pdf`)
  - `dev:` Device ID (e.g., `dev:DEV-123`)
- Facets:
  - Origin (shipments), Dest (shipments)
  - Decl Status, Station (declarations)
  - Date From/To
- Pagination and per‑type counts
- Type‑aware results with “Open” links
- Help panel (click `?` next to the search input or press `h`)

API:
- `GET /api/smart/search` returns `{ items, total, page, size, byType }`
  - Query params: `q, types, page, size, origin, destination, decl_status, station, date_from, date_to`
  - Works in both fallback and smart (semantic) modes
    - Smart mode applies post‑filtering so results respect facets/prefixes
- `GET /api/smart/search.csv` returns a CSV export of the same results

Config flags (backend):
- `SMART_ENABLED=true` (global), `SEARCH_ENABLED=true` (smart search), `OCR_ENABLED=true` (document OCR extract)

Notes:
- Fallback mode (no flags) still returns rich results using indexed ILIKE queries
- A performance migration adds GIN trigram indexes for speedy search

## Payment Lifecycle QA

Enterprise payment flow is validated by an automated lifecycle test:

- `Pending -> Verified -> Paid`
- receipt blocked before `Paid`
- clearance blocked before `Paid`
- double-approve blocked

Local run (from `backend/`):

```bash
npm run seed:admin
npm run db:migrate:payment-hardening
npm run test:payment-lifecycle
```

CI:

- GitHub Actions workflow: `.github/workflows/payment-lifecycle.yml`
- Runs on push/PR for backend and migration changes.

## Frontend Styling

For easier maintenance, all frontend UI styles are consolidated into a single file:

- rontend/src/styles/app.css`r

