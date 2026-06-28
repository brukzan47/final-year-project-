-- HS and route priors calculated from inspections (smoothed)
-- Positive inspection outcomes that indicate risk
-- Adjust values to match your actual inspection_result strings if needed.

CREATE OR REPLACE VIEW risk_hs_priors AS
WITH base AS (
  SELECT s.hs_code,
         COUNT(*) AS n,
         SUM(CASE WHEN i.inspection_result IN ('Penalty','Seizure','Violation','Adjustment') THEN 1 ELSE 0 END) AS bad
  FROM declarations d
  JOIN shipments s ON d.shipment_id = s.shipment_id
  LEFT JOIN inspections i ON i.declaration_id = d.declaration_id
  GROUP BY s.hs_code
)
SELECT hs_code,
       n,
       bad,
       (bad + 1.0) / (n + 2.0) AS bad_rate
FROM base;

CREATE OR REPLACE VIEW risk_route_priors AS
WITH base AS (
  SELECT s.origin_country, s.destination_port, s.mode_of_transport,
         COUNT(*) AS n,
         SUM(CASE WHEN i.inspection_result IN ('Penalty','Seizure','Violation','Adjustment') THEN 1 ELSE 0 END) AS bad
  FROM declarations d
  JOIN shipments s ON d.shipment_id = s.shipment_id
  LEFT JOIN inspections i ON i.declaration_id = d.declaration_id
  GROUP BY s.origin_country, s.destination_port, s.mode_of_transport
)
SELECT origin_country, destination_port, mode_of_transport,
       n, bad,
       (bad + 1.0) / (n + 2.0) AS bad_rate
FROM base;

