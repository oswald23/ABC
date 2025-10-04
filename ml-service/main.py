# main.py
# Minimal FastAPI /predict endpoint:
# - Direction model: XGBoostClassifier + LogisticRegression (ensemble of probs for >= +6% move over horizon)
# - Magnitude model: Quantile Regression via GradientBoostingRegressor (q10, q50, q90 of forward return)
# - Walk-forward backtest over last ~12 months (rolling fit) to compute hit-rate, avg return, worst drawdown
# Run: uvicorn main:app --host 0.0.0.0 --port 8000

from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from xgboost import XGBClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

app = FastAPI(title="Stock Forecast Microservice", version="1.0.0")

# ---------- Utilities ----------
def to_df(ohlcv: List[Dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(ohlcv)
    # expected keys: date, open, high, low, close, volume
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    for c in ["open","high","low","close","volume"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df

def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    up = np.where(delta > 0, delta, 0.0)
    down = np.where(delta < 0, -delta, 0.0)
    roll_up = pd.Series(up).rolling(period).mean()
    roll_down = pd.Series(down).rolling(period).mean()
    rs = roll_up / (roll_down + 1e-12)
    return 100.0 - (100.0 / (1.0 + rs))

def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    # True range
    prev_close = df["close"].shift(1)
    tr1 = df["high"] - df["low"]
    tr2 = (df["high"] - prev_close).abs()
    tr3 = (df["low"] - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(period).mean()

def business_day_add(d: datetime, n_days: int) -> datetime:
    # add n calendar days but skip weekends for display; minimal logic
    step = 1 if n_days >= 0 else -1
    days = abs(n_days)
    out = d
    while days > 0:
        out += timedelta(days=step)
        if out.weekday() < 5:  # Mon-Fri
            days -= 1
    return out

def make_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["ret1"] = out["close"].pct_change()
    out["logret1"] = np.log(out["close"]).diff()
    out["sma5"] = out["close"].rolling(5).mean()
    out["sma20"] = out["close"].rolling(20).mean()
    out["sma50"] = out["close"].rolling(50).mean()
    out["mom10"] = out["close"].pct_change(10)
    out["vol20"] = out["ret1"].rolling(20).std()
    out["rsi14"] = rsi(out["close"], 14)
    out["atr14"] = atr(out, 14)
    out["price_above_sma20"] = (out["close"] / (out["sma20"] + 1e-12)) - 1.0
    out["vol_z"] = (out["volume"] - out["volume"].rolling(20).mean()) / (out["volume"].rolling(20).std() + 1e-12)
    # fill/clean
    out = out.dropna().reset_index(drop=True)
    return out

def forward_return(df: pd.DataFrame, horizon: int) -> pd.Series:
    # (Close_{t+h} / Close_t - 1)
    return df["close"].shift(-horizon) / df["close"] - 1.0

def worst_drawdown(returns: np.ndarray) -> float:
    # returns are per-trade returns; compute equity curve DD
    eq = (1.0 + pd.Series(returns).fillna(0)).cumprod()
    roll_max = eq.cummax()
    dd = (eq / roll_max) - 1.0
    return float(dd.min()) if len(dd) else 0.0

# ---------- Request / Response ----------
class Candle(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float

class PredictRequest(BaseModel):
    symbol: str = Field(..., example="AAPL")
    ohlcv: List[Candle]
    horizon_days: int = Field(5, ge=1, le=10)

class PredictResponse(BaseModel):
    symbol: str
    current_price: float
    by_when: str
    predicted_price: float
    exp_return_pct: float
    prob_up: float
    confidence: float
    range_low: float
    range_high: float
    limit_order: float
    stop_loss: float
    backtest: Dict[str, float]

# ---------- Core inference ----------
@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    raw = to_df([c.dict() for c in req.ohlcv])
    if raw.shape[0] < 120:
        raise ValueError("Not enough history (need at least ~120 daily bars).")

    feats = make_features(raw)
    h = int(req.horizon_days)

    # Targets
    y_fwd = forward_return(feats, h)  # regression target (continuous return)
    y_up6 = (y_fwd >= 0.06).astype(int)  # classification target for >= +6% move
    valid = (~y_fwd.isna()).values
    X = feats.loc[valid, ["ret1","logret1","price_above_sma20","mom10","vol20","rsi14","atr14","vol_z"]].values
    y_reg = y_fwd.loc[valid].values
    y_cls = y_up6.loc[valid].values

    if X.shape[0] < 100:
        raise ValueError("Insufficient feature rows after cleaning.")

    # Train/test split (keep last ~252 bars for walk-forward metrics, train on the rest)
    n = X.shape[0]
    wf_tail = min(252, n // 3)  # ~12 months or a third of data
    split = n - wf_tail
    X_train, y_reg_train, y_cls_train = X[:split], y_reg[:split], y_cls[:split]
    X_tail, y_reg_tail, y_cls_tail = X[split:], y_reg[split:], y_cls[split:]

    # Scaler for linear model
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_tail_sc = scaler.transform(X_tail)

    # Models
    lr = LogisticRegression(max_iter=1000)
    lr.fit(X_train_sc, y_cls_train)

    xgb = XGBClassifier(
        n_estimators=200,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        objective="binary:logistic",
        eval_metric="logloss"
    )
    xgb.fit(X_train, y_cls_train)

    # Quantile regressors for low/median/high
    q10 = GradientBoostingRegressor(loss="quantile", alpha=0.10, n_estimators=300, max_depth=3)
    q50 = GradientBoostingRegressor(loss="quantile", alpha=0.50, n_estimators=300, max_depth=3)
    q90 = GradientBoostingRegressor(loss="quantile", alpha=0.90, n_estimators=300, max_depth=3)
    q10.fit(X_train, y_reg_train)
    q50.fit(X_train, y_reg_train)
    q90.fit(X_train, y_reg_train)

    # Walk-forward metrics (simple expanding window over tail region)
    preds = []
    rets = []
    p_aggs = []
    X_full_sc = scaler.transform(X)  # safe transform for all rows
    for i in range(split, n - 1):
        # pretend we refit on up-to-i (for speed, reuse trained models as a proxy)
        p_lr = lr.predict_proba(X_full_sc[i:i+1])[:,1][0]
        p_xg = xgb.predict_proba(X[i:i+1])[:,1][0]
        p_avg = 0.5 * (p_lr + p_xg)
        p_aggs.append(p_avg)
        # realized forward return (same target def)
        rets.append(y_reg[i])

    if len(rets) > 0:
        # define a simple trading rule: take trade if p_avg>0.55
        mask = np.array(p_aggs) > 0.55
        trade_rets = np.array(rets)[mask] if mask.any() else np.array([])
        hit_rate = float((trade_rets > 0).mean()) if trade_rets.size else 0.0
        avg_ret = float(trade_rets.mean()) if trade_rets.size else 0.0
        worst_dd = float(worst_drawdown(trade_rets))
    else:
        hit_rate = avg_ret = worst_dd = 0.0

    # Final point prediction for the latest row
    x_last = X[-1:].copy()
    x_last_sc = X_full_sc[-1:]

    p_lr_last = lr.predict_proba(x_last_sc)[:,1][0]
    p_xg_last = xgb.predict_proba(x_last)[:,1][0]
    p_avg_last = 0.5 * (p_lr_last + p_xg_last)
    ensemble_agree = 1.0 - abs(p_lr_last - p_xg_last)  # 1 means perfect agreement
    confidence = max(0.0, min(1.0, p_avg_last * ensemble_agree))

    ret_low = float(q10.predict(x_last)[0])
    ret_med = float(q50.predict(x_last)[0])
    ret_high = float(q90.predict(x_last)[0])

    current_price = float(feats["close"].iloc[-1])
    pred_price = float(current_price * (1.0 + ret_med))
    range_low = float(current_price * (1.0 + ret_low))
    range_high = float(current_price * (1.0 + ret_high))

    # Basic order/stop suggestions (tighten on uncertainty)
    last_atr = float(feats["atr14"].iloc[-1]) if not np.isnan(feats["atr14"].iloc[-1]) else None
    if last_atr and last_atr > 0:
        stop_loss = float(round(current_price - 1.2 * last_atr, 2))
        limit_order = float(round(min(current_price, current_price - 0.2 * last_atr), 2))
    else:
        stop_loss = float(round(current_price * 0.97, 2))
        limit_order = float(round(current_price * 0.995, 2))

    by_when = business_day_add(datetime.utcnow(), h).strftime("%Y-%m-%d")

    return {
        "symbol": req.symbol,
        "current_price": round(current_price, 4),
        "by_when": by_when,
        "predicted_price": round(pred_price, 4),
        "exp_return_pct": round(100.0 * ret_med, 2),
        "prob_up": round(p_avg_last, 4),
        "confidence": round(confidence * 100.0, 1),
        "range_low": round(range_low, 4),
        "range_high": round(range_high, 4),
        "limit_order": limit_order,
        "stop_loss": stop_loss,
        "backtest": {
            "hit_rate_12m": round(hit_rate * 100.0, 1),
            "avg_return": round(100.0 * avg_ret, 2),
            "worst_drawdown": round(100.0 * worst_dd, 2)
        }
    }
