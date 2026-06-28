import os
import pandas as pd
import lightgbm as lgb
import shap
import joblib
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import roc_auc_score


def load_training_frame(path: str) -> pd.DataFrame:
    # Expect a parquet or CSV extracted from database/views/risk_features.sql
    if path.endswith(".parquet"):
        return pd.read_parquet(path)
    return pd.read_csv(path)


def main():
    data_path = os.getenv("RISK_TRAIN_DATA", "./risk_features.parquet")
    out_dir = os.getenv("RISK_MODELS_OUT", os.path.join(os.path.dirname(__file__), "..", "models"))
    os.makedirs(out_dir, exist_ok=True)

    df = load_training_frame(data_path).sort_values("declaration_date")
    features = [
        c for c in df.columns
        if c not in ["label_risk_event", "declaration_id", "declaration_no", "declaration_date", "declaration_created_at"]
    ]
    df = df.dropna(subset=["label_risk_event"])  # keep rows with labels

    pos = (df.label_risk_event == 1).sum()
    neg = (df.label_risk_event == 0).sum()
    scale_pos_weight = float(neg) / float(pos) if pos else 1.0

    params = dict(
        objective="binary",
        metric="auc",
        learning_rate=0.05,
        num_leaves=63,
        feature_fraction=0.8,
        bagging_fraction=0.8,
        bagging_freq=1,
        min_child_samples=40,
        scale_pos_weight=scale_pos_weight,
    )

    tscv = TimeSeriesSplit(n_splits=5)
    best_model, best_auc = None, 0.0
    for tr_idx, va_idx in tscv.split(df):
        tr, va = df.iloc[tr_idx], df.iloc[va_idx]
        dtr = lgb.Dataset(tr[features], label=tr["label_risk_event"])
        dva = lgb.Dataset(va[features], label=va["label_risk_event"])  # noqa
        m = lgb.train(params, dtr, valid_sets=[dva], num_boost_round=2000, early_stopping_rounds=100, verbose_eval=False)
        p = m.predict(va[features])
        auc = roc_auc_score(va["label_risk_event"], p)
        if auc > best_auc:
            best_auc, best_model = auc, m

    if best_model is None:
        raise RuntimeError("Training failed: no model produced")

    joblib.dump(best_model, os.path.join(out_dir, "risk_model.lgbm"))
    bg = shap.sample(df[features], 1000, random_state=42)
    joblib.dump(bg, os.path.join(out_dir, "shap_bg.pkl"))
    print({"auc": best_auc, "features": len(features)})


if __name__ == "__main__":
    main()

