# Ethiopian Customs Legal Hierarchy

This document contains a concise legal-hierarchy diagram (Mermaid) and a short narrative mapping the main legal instruments from the 2017 Ethiopian Customs Guide.

## Diagram (Mermaid)

```mermaid
flowchart TB
  A[Customs Proclamation 859/2014]
  B[Council of Ministers Regulation 409/2017]
  C[Sector & Administrative Directives]
  D[Tax Proclamations & Regulations]
  E[NBE Foreign Exchange Directives]
  F[Customs Operational Procedures & Forms]
  G[Sector-specific Laws (Health, Agriculture, Radiation, etc.)]

  A --> B
  B --> C
  C --> F
  C --> G
  C --> D
  C --> E

  subgraph Examples
    H1[IM4, EX1, IM5, IM6, IM7, IM8-EX8]
    H2[Goods Released Under Security Dir. No.13/2002]
    H3[Customs Warehouse Dir. No.40/2002]
    H4[AEO Dir. No.65/2004]
  end

  F --> H1
  C --> H2
  C --> H3
  C --> H4
```

## Short narrative

- `Customs Proclamation 859/2014` is the primary legal foundation establishing customs powers, duties, offences and administrative framework.
- `Council of Ministers Regulation 409/2017` provides implementing rules and detailed procedures required by the Proclamation.
- Sector and Administrative Directives (ERCA/ECC directives) supply operational guidance: customs warehouses, goods release under security, AEO, declaration forms and procedures.
- Tax proclamations (VAT, Excise, Income Tax, Surtax) and NBE foreign-exchange directives intersect with customs for valuation, duties, and forex controls.
- Sector-specific laws (veterinary, food & drug, radiation, communication equipment controls) may impose additional permits, inspections, or restrictions that customs enforces at the border.

## Quick references (from the 2017 guide)

- Core: `Customs Proclamation 859/2014` → `Regulation 409/2017`
- Key directives: Goods Released Under Security No.13/2002; Customs Warehouse Dir. No.40/2002; AEO Dir. No.65/2004; Disposal of Abandoned Goods Dir. No.56/2003
- Forms: `IM4` (import for home consumption), `EX1` (export), `IM5` (temporary import), `IM6` (re-import), `IM7` (export for inward processing), `IM8-EX8` (transit)

---

If you want, I can:
- produce an SVG/PNG export of the Mermaid diagram,
- expand into a full legal hierarchy PDF or slide, or
- start mapping article-level references to database schema (next: Database schema mapped to legal articles).
