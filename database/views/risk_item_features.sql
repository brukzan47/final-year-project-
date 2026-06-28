-- Item-level features derived from goods_items + reference and priors

CREATE OR REPLACE VIEW risk_item_features AS
SELECT 
  gi.goods_item_id,
  gi.declaration_id,
  gi.hs_code,
  gi.description,
  gi.quantity,
  gi.unit_of_measure,
  gi.value_usd,
  COALESCE(NULLIF(gi.origin_country,''), s.origin_country) AS origin_country,
  s.destination_port,
  s.mode_of_transport,
  d.declaration_date,
  -- Derived
  CASE WHEN NULLIF(gi.quantity,0) IS NULL THEN NULL ELSE gi.value_usd / NULLIF(gi.quantity,0) END AS value_per_unit_usd,
  CASE WHEN rp.p50_value_usd IS NULL OR NULLIF(gi.quantity,0) IS NULL THEN NULL
       ELSE (gi.value_usd / NULLIF(gi.quantity,0)) / NULLIF(rp.p50_value_usd,0) END AS value_ratio_vs_hs_p50,
  CASE WHEN rp.p50_value_usd IS NULL OR NULLIF(gi.quantity,0) IS NULL THEN 0
       WHEN (gi.value_usd / NULLIF(gi.quantity,0)) < 0.7 * rp.p50_value_usd THEN 1 ELSE 0 END AS undervaluation_flag,
  CASE WHEN rp.p50_value_usd IS NULL OR NULLIF(gi.quantity,0) IS NULL THEN 0
       WHEN (gi.value_usd / NULLIF(gi.quantity,0)) > 2.0 * rp.p50_value_usd THEN 1 ELSE 0 END AS overvaluation_flag,
  COALESCE(hp.bad_rate, 0.0) AS hs_prior_risk,
  COALESCE(rp2.bad_rate, 0.0) AS route_prior_risk,
  CASE WHEN LOWER(COALESCE(NULLIF(gi.origin_country,''), s.origin_country)) IN ('somalia','yemen','afghanistan','syria','libya') THEN 1 ELSE 0 END AS origin_watchlist_flag
FROM goods_items gi
JOIN declarations d ON d.declaration_id = gi.declaration_id
JOIN shipments s ON s.shipment_id = d.shipment_id
LEFT JOIN reference_prices rp ON rp.hs_code = gi.hs_code AND rp.origin_country = COALESCE(NULLIF(gi.origin_country,''), s.origin_country, '') AND rp.unit_of_measure = COALESCE(gi.unit_of_measure,'')
LEFT JOIN risk_hs_priors hp ON hp.hs_code = gi.hs_code
LEFT JOIN risk_route_priors rp2 ON rp2.origin_country = COALESCE(NULLIF(gi.origin_country,''), s.origin_country) AND rp2.destination_port = s.destination_port AND rp2.mode_of_transport = s.mode_of_transport;

