from typing import List, Dict, Any


class AlertsStore:
    def __init__(self) -> None:
        self._alerts: List[Dict[str, Any]] = []
        self._next_id: int = 1

    def add(self, cfg: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            "id": self._next_id,
            **cfg,
            "active": True,
        }
        self._next_id += 1
        self._alerts.append(item)
        return item

    def remove(self, alert_id: int) -> None:
        self._alerts = [a for a in self._alerts if a.get("id") != alert_id]

    def list(self) -> List[Dict[str, Any]]:
        return list(self._alerts)

    @staticmethod
    def _should_trigger(alert: Dict[str, Any], value: float) -> bool:
        op = alert.get("operator")
        threshold = float(alert.get("threshold", 0.0))
        if op == "gt":
            return value > threshold
        if op == "lt":
            return value < threshold
        if op == "gte":
            return value >= threshold
        if op == "lte":
            return value <= threshold
        if op == "eq":
            return value == threshold
        return False

    def check(self, data: Dict[str, Any], symbol_x: str, symbol_y: str) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        analytics = data if data.get("spread") else data.get("analytics")
        if not analytics or not analytics.get("spread"):
            return results
        latest = analytics["spread"][-1]
        latest_z = float(latest.get("zScore", 0.0))
        for a in self._alerts:
            if a.get("symbolX") == symbol_x and a.get("symbolY") == symbol_y:
                if self._should_trigger(a, latest_z):
                    results.append({**a, "currentValue": latest_z})
        return results


