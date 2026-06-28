-- Feature view assembling data from core tables
-- This supports training and audit. Keep deterministic and reproducible.

CREATE OR REPLACE VIEW risk_features AS
SELECT 
  d.declaration_id,
  d.declaration_no,
  d.declaration_date,
  d.created_at AS declaration_created_at,
  s.shipment_id,
  s.importer_id,
  s.hs_code,
  s.goods_type,
  s.description_of_goods,
  s.quantity,
  s.unit_of_measure,
  s.cif_value_usd,
  s.origin_country,
  s.destination_port,
  s.mode_of_transport,
  p.invoice_value_usd,
  p.exchange_rate,
  p.cif_etb,
  p.duty_paid,
  p.vat_paid,
  p.excise_paid,
  p.total_payable,
  p.payment_status,
  p.paid_amount,
  p.payment_date,
  perf.number_of_queries,
  perf.penalties,
  perf.feedback_score,
  i.release_date,
  i.storage_days,
  -- Derived features
  CASE WHEN NULLIF(s.quantity,0) IS NULL THEN NULL ELSE s.cif_value_usd / NULLIF(s.quantity,0) END AS value_per_unit_usd,
  CASE WHEN rp.p50_value_usd IS NULL OR NULLIF(s.quantity,0) IS NULL THEN NULL
       ELSE (s.cif_value_usd / NULLIF(s.quantity,0)) / NULLIF(rp.p50_value_usd,0) END AS value_ratio_vs_hs_p50,
  CASE WHEN rp.p50_value_usd IS NULL OR NULLIF(s.quantity,0) IS NULL THEN 0
       WHEN (s.cif_value_usd / NULLIF(s.quantity,0)) < 0.7 * rp.p50_value_usd THEN 1 ELSE 0 END AS undervaluation_flag,
  CASE WHEN rp.p50_value_usd IS NULL OR NULLIF(s.quantity,0) IS NULL THEN 0
       WHEN (s.cif_value_usd / NULLIF(s.quantity,0)) > 2.0 * rp.p50_value_usd THEN 1 ELSE 0 END AS overvaluation_flag,
  CASE WHEN LOWER(s.goods_type) IN ('chemicals','pharmaceuticals','electronics') THEN 1 ELSE 0 END AS goods_type_sensitive,
  EXTRACT(HOUR FROM d.created_at) BETWEEN 0 AND 6 AS night_submission,
  CASE WHEN p.total_payable IS NULL OR p.total_payable=0 THEN NULL ELSE (p.duty_paid + p.vat_paid + p.excise_paid) / NULLIF(p.total_payable,0) END AS duty_density,
  CASE p.payment_status WHEN 'Verified' THEN 2 WHEN 'Pending' THEN 1 WHEN 'Failed' THEN -1 ELSE 0 END AS payment_status_flag,
  CASE WHEN p.total_payable IS NULL OR p.total_payable=0 THEN NULL ELSE p.paid_amount / NULLIF(p.total_payable,0) END AS partial_paid_ratio,
  CASE WHEN p.payment_date IS NULL OR d.declaration_date IS NULL THEN NULL ELSE (p.payment_date - d.declaration_date) END AS payment_delay_days,
  COALESCE(hp.bad_rate, 0.0) AS hs_prior_risk,
  COALESCE(rp2.bad_rate, 0.0) AS route_prior_risk,
  CASE WHEN LOWER(s.origin_country) IN ('somalia','yemen','afghanistan','syria','libya') THEN 1 ELSE 0 END AS origin_watchlist_flag,
  -- Label (only present if inspected)
  CASE WHEN i.inspection_result IN ('Penalty','Seizure','Violation','Adjustment') THEN 1
       WHEN i.inspection_result IS NULL THEN NULL
       ELSE 0 END AS label_risk_event
FROM declarations d
JOIN shipments s ON d.shipment_id = s.shipment_id
LEFT JOIN payments p ON p.declaration_id = d.declaration_id
LEFT JOIN inspections i ON i.declaration_id = d.declaration_id
LEFT JOIN performance perf ON perf.importer_id = s.importer_id
LEFT JOIN reference_prices rp ON rp.hs_code = s.hs_code AND rp.origin_country = COALESCE(s.origin_country,'') AND rp.unit_of_measure = COALESCE(s.unit_of_measure,'')
LEFT JOIN risk_hs_priors hp ON hp.hs_code = s.hs_code
LEFT JOIN risk_route_priors rp2 ON rp2.origin_country = s.origin_country AND rp2.destination_port = s.destination_port AND rp2.mode_of_transport = s.mode_of_transport;

