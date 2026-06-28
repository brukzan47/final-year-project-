from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, Dict, List
import joblib
import os
import numpy as np
import shap

from feature_assembly import assemble_features


app = FastAPI()

MODEL_PATH = os.getenv("RISK_MODEL_PATH", os.path.join(os.path.dirname(__file__), "..", "models", "risk_model.lgbm"))
BG_PATH = os.getenv("RISK_SHAP_BG_PATH", os.path.join(os.path.dirname(__file__), "..", "models", "shap_bg.pkl"))
THRESHOLDS = {"green": 0.41, "yellow": 0.70}


class ScoreRequest(BaseModel):
    payload: Dict[str, Any]


class FeedbackRequest(BaseModel):
    declaration_id: str
    officer_label: str
    notes: str | None = None


def _load_model():
    try:
        model = joblib.load(MODEL_PATH)
        bg = joblib.load(BG_PATH)
        explainer = shap.TreeExplainer(model, bg)
        return model, explainer
    except Exception:
        return None, None


model, explainer = _load_model()


def _to_channel(p: float) -> str:
    if p < THRESHOLDS["green"]:
        return "green"
    if p <= THRESHOLDS["yellow"]:
        return "yellow"
    return "red"


@app.post("/score")
def score(payload: Dict[str, Any]):
    # Assemble features
    feats = assemble_features(payload)
    feat_names: List[str] = list(feats.keys())
    X = np.array([list(feats.values())])

    # If model available, predict and explain; otherwise simple heuristic
    if model is not None and explainer is not None:
        p = float(model.predict(X)[0])
        score = int(round(p * 100))
        shap_vals = explainer.shap_values(X)
        # shap_values returns [class0, class1] for binary; select class 1 if present
        sv = shap_vals[1][0] if isinstance(shap_vals, list) else shap_vals[0]
        top = sorted(zip(feat_names, sv), key=lambda t: abs(float(t[1])), reverse=True)[:5]
        reasons = [
            {"feature": f, "impact": round(float(v), 4), "direction": "up" if float(v) > 0 else "down"}
            for f, v in top
        ]
        return {"risk_score": score, "channel": _to_channel(p), "reasons": reasons, "model_version": "v1.0"}

    # Fallback heuristic if no model yet
    base = 0
    reasons = []
    if feats.get("value_per_unit_usd", 0) > 10000:
        base += 20
        reasons.append({"feature": "value_per_unit_usd", "impact": 20, "direction": "up"})
    if feats.get("goods_type_sensitive", 0) == 1:
        base += 15
        reasons.append({"feature": "goods_type_sensitive", "impact": 15, "direction": "up"})
    if feats.get("origin_watchlist_flag", 0) == 1:
        base += 20
        reasons.append({"feature": "origin_watchlist_flag", "impact": 20, "direction": "up"})
    if feats.get("importer_queries", 0) > 3:
        base += 10
        reasons.append({"feature": "importer_queries", "impact": 10, "direction": "up"})
    if feats.get("importer_penalties_flag", 0) == 1:
        base += 10
        reasons.append({"feature": "importer_penalties_flag", "impact": 10, "direction": "up"})
    if feats.get("importer_feedback_low", 0) == 1:
        base += 10
        reasons.append({"feature": "importer_feedback_low", "impact": 10, "direction": "up"})

    p = min(max(base / 100.0, 0.0), 1.0)
    score_int = int(round(p * 100))
    return {"risk_score": score_int, "channel": _to_channel(p), "reasons": reasons, "model_version": "fallback"}


@app.post("/feedback")
def feedback(payload: FeedbackRequest):
    # Placeholder: in a full setup, store to DB or a queue for retraining
    return {"ok": True}

