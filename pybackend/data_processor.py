from datetime import datetime
from typing import List, Dict, Any


def get_time_key(ts: datetime, timeframe: str) -> datetime:
    d = ts.replace(microsecond=0)
    if timeframe == "1s":
        return d
    if timeframe == "1m":
        return d.replace(second=0)
    if timeframe == "5m":
        minute = (d.minute // 5) * 5
        return d.replace(second=0, minute=minute)
    # default to minute
    return d.replace(second=0)


def aggregate_ticks(ticks: List[Dict[str, Any]], timeframe: str) -> List[Dict[str, Any]]:
    grouped: Dict[datetime, List[Dict[str, Any]]] = {}
    for t in ticks:
        time_val = t.get("time") or t.get("ts")
        if not isinstance(time_val, datetime):
            continue
        key = get_time_key(time_val, timeframe)
        grouped.setdefault(key, []).append(t)

    result: List[Dict[str, Any]] = []
    for key in sorted(grouped.keys()):
        group = grouped[key]
        prices = [float(x["price"]) for x in group]
        sizes = [float(x.get("size", 0.0)) for x in group]
        result.append({
            "time": key,
            "open": prices[0],
            "high": max(prices),
            "low": min(prices),
            "close": prices[-1],
            "volume": sum(sizes),
            "count": len(group),
        })
    return result


