from typing import Dict, Any


SENSITIVE_GOODS = {"chemicals", "pharmaceuticals", "electronics"}
WATCHLIST_ORIGINS = {"somalia", "yemen", "afghanistan", "syria", "libya"}


def assemble_features(payload: Dict[str, Any]) -> Dict[str, float]:
    shipment = payload.get("shipment", {}) or {}
    performance = payload.get("performance", {}) or {}

    qty = _to_float(shipment.get("quantity"))
    cif = _to_float(shipment.get("cif_value_usd"))
    value_per_unit = (cif / qty) if (qty and qty != 0) else None

    goods = str(shipment.get("goods_type", "")).lower()
    origin = str(shipment.get("origin_country", "")).lower()

    # Aggregate goods items if present
    items = payload.get("goods_items") or []
    items_count = len(items)
    items_total_value = 0.0
    items_sensitive = 0
    for it in items:
        try:
            items_total_value += float(it.get("value_usd") or 0.0)
        except Exception:
            pass
        try:
            gt = str(it.get("description") or "") + " " + str(it.get("hs_code") or "")
            if any(k in gt.lower() for k in SENSITIVE_GOODS):
                items_sensitive += 1
        except Exception:
            pass

    feats = {
        "value_per_unit_usd": value_per_unit or 0.0,
        "goods_type_sensitive": 1.0 if goods in SENSITIVE_GOODS else 0.0,
        "origin_watchlist_flag": 1.0 if origin in WATCHLIST_ORIGINS else 0.0,
        "importer_queries": float(_to_int(performance.get("number_of_queries")) or 0),
        "importer_penalties_flag": 1.0 if str(performance.get("penalties", "")).strip().lower() not in ("", "none", "null") else 0.0,
        "importer_feedback_low": 1.0 if _to_float(performance.get("feedback_score")) and _to_float(performance.get("feedback_score")) < 3 else 0.0,
        "items_count": float(items_count),
        "items_total_value_usd": float(items_total_value),
        "items_sensitive_count": float(items_sensitive),
    }
    return feats


def _to_float(v):
    try:
        return float(v)
    except Exception:
        return None


def _to_int(v):
    try:
        return int(v)
    except Exception:
        return None
