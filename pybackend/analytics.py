from typing import List, Dict, Any
import math


def _sum(arr: List[float]) -> float:
    return float(sum(arr))


def _mean(arr: List[float]) -> float:
    return _sum(arr) / len(arr) if arr else 0.0


def _sum_product(a: List[float], b: List[float]) -> float:
    return float(sum(x * y for x, y in zip(a, b)))


def _sum_squares(arr: List[float]) -> float:
    return float(sum(x * x for x in arr))


def _std(arr: List[float]) -> float:
    m = _mean(arr)
    return math.sqrt(sum((x - m) ** 2 for x in arr) / len(arr)) if arr else 0.0


def _r2(actual: List[float], predicted: List[float]) -> float:
    am = _mean(actual)
    total_ss = sum((y - am) ** 2 for y in actual)
    resid_ss = sum((y - yhat) ** 2 for y, yhat in zip(actual, predicted))
    if total_ss == 0:
        return 0.0
    return 1.0 - (resid_ss / total_ss)


def calculate_hedge_ratio(x: List[float], y: List[float]) -> Dict[str, float]:
    n = len(x)
    sum_x = _sum(x)
    sum_y = _sum(y)
    sum_xy = _sum_product(x, y)
    sum_x2 = _sum_squares(x)
    denom = (n * sum_x2 - sum_x * sum_x) or 1e-12
    slope = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n
    yhat = [slope * xi + intercept for xi in x]
    r2 = _r2(y, yhat)
    return {"slope": float(slope), "intercept": float(intercept), "rSquared": float(r2)}


def calculate_spread(x: List[float], y: List[float], hedge_ratio: float) -> List[float]:
    return [float(yi - hedge_ratio * xi) for xi, yi in zip(x, y)]


def calculate_correlation(x: List[float], y: List[float]) -> float:
    n = len(x)
    sum_x = _sum(x)
    sum_y = _sum(y)
    sum_xy = _sum_product(x, y)
    sum_x2 = _sum_squares(x)
    sum_y2 = _sum_squares(y)
    denom = math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y)) or 1e-12
    return float((n * sum_xy - sum_x * sum_y) / denom)


def _rolling_mean(arr: List[float], window: int) -> List[float]:
    out = []
    for i in range(len(arr)):
        start = max(0, i - window + 1)
        window_slice = arr[start : i + 1]
        out.append(_mean(window_slice))
    return out


def _rolling_std(arr: List[float], window: int) -> List[float]:
    out = []
    for i in range(len(arr)):
        start = max(0, i - window + 1)
        window_slice = arr[start : i + 1]
        out.append(_std(window_slice))
    return out


def _zscore(spread: List[float], mean_arr: List[float], std_arr: List[float]) -> List[float]:
    res = []
    for i, s in enumerate(spread):
        denom = std_arr[i] if std_arr[i] != 0 else 1.0
        res.append((s - mean_arr[i]) / denom)
    return res


def adf_test(series: List[float]) -> Dict[str, Any]:
    n = len(series)
    if n < 20:
        return {"testStatistic": None, "pValue": None, "isStationary": False}
    y = series[1:]
    x = series[:-1]
    dy = [y[i] - x[i] for i in range(len(x))]
    sum_x = _sum(x)
    sum_y = _sum(dy)
    sum_xy = _sum_product(x, dy)
    sum_x2 = _sum_squares(x)
    denom = (n * sum_x2 - sum_x * sum_x) or 1e-12
    beta = (n * sum_xy - sum_x * sum_y) / denom
    alpha = (sum_y - beta * sum_x) / n
    # simplified statistic
    r2 = _r2(dy, [alpha + beta * xi for xi in x])
    stat_denom = math.sqrt((1 - r2) / max(n - 2, 1)) or 1e-12
    test_stat = beta / stat_denom
    crit_5 = -2.86
    is_stationary = test_stat < crit_5
    return {"testStatistic": float(test_stat), "isStationary": bool(is_stationary)}


def compute_analytics(aligned_x: List[Dict[str, Any]], aligned_y: List[Dict[str, Any]], window: int) -> Dict[str, Any]:
    x_prices = [float(d["close"]) for d in aligned_x]
    y_prices = [float(d["close"]) for d in aligned_y]
    hr = calculate_hedge_ratio(x_prices, y_prices)
    spread = calculate_spread(x_prices, y_prices, hr["slope"])
    rmean = _rolling_mean(spread, window)
    rstd = _rolling_std(spread, window)
    z = _zscore(spread, rmean, rstd)
    corr = calculate_correlation(x_prices, y_prices)
    return {
        "hedgeRatio": hr["slope"],
        "hedgeR2": hr["rSquared"],
        "correlation": corr,
        "spread": [
            {"time": aligned_x[i]["time"].isoformat(), "spread": float(spread[i]), "zScore": float(z[i])}
            for i in range(len(spread))
        ],
        "rollingCorrelation": [
            {"index": i, "correlation": corr} for i in range(len(aligned_x))
        ],
    }


