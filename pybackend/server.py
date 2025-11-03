from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, FileResponse, StreamingResponse, PlainTextResponse
from starlette.routing import Route, WebSocketRoute
from starlette.endpoints import WebSocketEndpoint
from starlette.staticfiles import StaticFiles
from typing import List, Dict, Any
from datetime import datetime
import asyncio
import json
import os
import io
import asyncio
import websockets

try:
    from .db import get_db
    from .data_processor import aggregate_ticks
    from .analytics import compute_analytics, adf_test, calculate_hedge_ratio, calculate_spread
    from .alerts import AlertsStore
except Exception:
    from db import get_db
    from data_processor import aggregate_ticks
    from analytics import compute_analytics, adf_test, calculate_hedge_ratio, calculate_spread
    from alerts import AlertsStore


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
alerts = AlertsStore()
connected_clients: List[Any] = []


async def health(request):
    return JSONResponse({"status": "ok", "time": datetime.utcnow().isoformat()})


async def index(request):
    index_path = os.path.join(PUBLIC_DIR, "index.html")
    if not os.path.exists(index_path):
        return PlainTextResponse("index.html not found", status_code=404)
    return FileResponse(index_path)


class WS(WebSocketEndpoint):
    encoding = "text"

    async def on_connect(self, websocket):
        await websocket.accept()
        connected_clients.append(websocket)

    async def on_receive(self, websocket, data):
        # Optional echo or ignore
        pass

    async def on_disconnect(self, websocket, close_code):
        try:
            connected_clients.remove(websocket)
        except ValueError:
            pass


def broadcast(payload: Dict[str, Any]):
    data = json.dumps(payload)
    for ws in list(connected_clients):
        try:
            asyncio.create_task(ws.send_text(data))
        except Exception:
            try:
                connected_clients.remove(ws)
            except ValueError:
                pass


async def upload_ndjson(request):
    form = await request.form()
    file = form.get("file")
    if not file:
        return JSONResponse({"error": "No file uploaded"}, status_code=400)
    filename = getattr(file, "filename", "") or ""
    if not (filename.lower().endswith(".ndjson") or filename.lower().endswith(".json")):
        return JSONResponse({"error": "Only NDJSON or JSON files are allowed"}, status_code=400)
    content = await file.read()
    text = content.decode("utf-8")
    lines = [ln for ln in text.splitlines() if ln.strip()]

    ticks = []
    symbols = set()
    for line in lines:
        t = json.loads(line)
        symbol = str(t.get("symbol"))
        ts_raw = t.get("ts")
        if isinstance(ts_raw, str):
            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        elif isinstance(ts_raw, (int, float)):
            ts = datetime.utcfromtimestamp((ts_raw / 1000.0) if ts_raw and ts_raw > 1e12 else (ts_raw or 0))
        else:
            ts = datetime.utcnow()
        price = float(t.get("price"))
        size = float(t.get("size") or t.get("qty") or 0.0)
        ticks.append({"symbol": symbol.upper(), "ts": ts, "price": price, "size": size})
        symbols.add(symbol.upper())

    if not ticks:
        return JSONResponse({"message": "No data", "count": 0, "symbols": []})

    db = get_db()
    coll = db["ticks"]
    coll.insert_many(ticks, ordered=False)
    return JSONResponse({"message": "File uploaded successfully", "count": len(ticks), "symbols": sorted(symbols)})


async def analyze(request):
    qp = request.query_params
    symbolX = qp.get("symbolX")
    symbolY = qp.get("symbolY")
    timeframe = qp.get("timeframe", "1m")
    window = int(qp.get("window", 30))
    startTime = qp.get("startTime")
    endTime = qp.get("endTime")
    if not symbolX or not symbolY:
        return JSONResponse({"error": "Both symbolX and symbolY are required"}, status_code=400)

    db = get_db()
    coll = db["ticks"]
    query: Dict[str, Any] = {}
    if startTime and endTime:
        start_dt = datetime.fromisoformat(startTime.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(endTime.replace("Z", "+00:00"))
        query["ts"] = {"$gte": start_dt, "$lte": end_dt}

    cur_x = coll.find({"symbol": symbolX.upper(), **query}).sort("ts", 1)
    cur_y = coll.find({"symbol": symbolY.upper(), **query}).sort("ts", 1)
    data_x = [{"time": d["ts"], "price": float(d["price"]), "size": float(d.get("size", 0))} for d in cur_x]
    data_y = [{"time": d["ts"], "price": float(d["price"]), "size": float(d.get("size", 0))} for d in cur_y]
    if not data_x or not data_y:
        return JSONResponse({"error": "No data found for the given symbols"}, status_code=404)

    agg_x = aggregate_ticks(data_x, timeframe)
    agg_y = aggregate_ticks(data_y, timeframe)
    x_index = {int(x["time"].timestamp() * 1000): i for i, x in enumerate(agg_x)}
    aligned_x = []
    aligned_y = []
    for y in agg_y:
        key = int(y["time"].timestamp() * 1000)
        idx = x_index.get(key)
        if idx is not None:
            aligned_x.append(agg_x[idx])
            aligned_y.append(y)
    if not aligned_x:
        return JSONResponse({"error": "No overlapping timestamps found"}, status_code=404)

    analytics = compute_analytics(aligned_x, aligned_y, int(window))
    triggers = alerts.check(analytics, symbolX.upper(), symbolY.upper())
    for trig in triggers:
        broadcast({"type": "alert", "message": trig["message"], "currentValue": trig.get("currentValue")})

    payload = {
        "symbolX": symbolX.upper(),
        "symbolY": symbolY.upper(),
        "timeframe": timeframe,
        "window": window,
        "dataPoints": len(aligned_x),
        "analytics": analytics,
        "priceData": {
            "times": [x["time"].isoformat() for x in aligned_x],
            "xPrices": [float(x["close"]) for x in aligned_x],
            "yPrices": [float(y["close"]) for y in aligned_y],
        },
    }
    return JSONResponse(payload)


async def adf_route(request):
    body = await request.json()
    symbolX = body.get("symbolX")
    symbolY = body.get("symbolY")
    timeframe = body.get("timeframe", "1m")
    startTime = body.get("startTime")
    endTime = body.get("endTime")
    db = get_db()
    coll = db["ticks"]
    query: Dict[str, Any] = {}
    if startTime and endTime:
        start_dt = datetime.fromisoformat(startTime.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(endTime.replace("Z", "+00:00"))
        query["ts"] = {"$gte": start_dt, "$lte": end_dt}
    cur_x = coll.find({"symbol": symbolX.upper(), **query}).sort("ts", 1)
    cur_y = coll.find({"symbol": symbolY.upper(), **query}).sort("ts", 1)
    data_x = [{"time": d["ts"], "price": float(d["price"]) } for d in cur_x]
    data_y = [{"time": d["ts"], "price": float(d["price"]) } for d in cur_y]
    agg_x = aggregate_ticks(data_x, timeframe)
    agg_y = aggregate_ticks(data_y, timeframe)
    x_index = {int(x["time"].timestamp() * 1000): i for i, x in enumerate(agg_x)}
    aligned_x = []
    aligned_y = []
    for y in agg_y:
        idx = x_index.get(int(y["time"].timestamp() * 1000))
        if idx is not None:
            aligned_x.append(agg_x[idx])
            aligned_y.append(y)
    if not aligned_x:
        return JSONResponse({"error": "No common data points found"}, status_code=404)
    x_prices = [float(d["close"]) for d in aligned_x]
    y_prices = [float(d["close"]) for d in aligned_y]
    hr = calculate_hedge_ratio(x_prices, y_prices)
    spread = calculate_spread(x_prices, y_prices, hr["slope"])
    adf_res = adf_test(spread)
    return JSONResponse({
        "symbolX": symbolX.upper(),
        "symbolY": symbolY.upper(),
        "hedgeRatio": hr["slope"],
        "samples": len(spread),
        "adfResult": {
            "adf": adf_res.get("testStatistic"),
            "pValue": adf_res.get("pValue", 0.0),
            "stationary": adf_res.get("isStationary", False),
            "message": "Stationary" if adf_res.get("isStationary") else "Non-stationary",
        },
    })


async def export_csv(request):
    qp = request.query_params
    symbolX = qp.get("symbolX")
    symbolY = qp.get("symbolY")
    timeframe = qp.get("timeframe", "1m")
    startTime = qp.get("startTime")
    endTime = qp.get("endTime")
    db = get_db()
    coll = db["ticks"]
    query: Dict[str, Any] = {}
    if startTime and endTime:
        start_dt = datetime.fromisoformat(startTime.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(endTime.replace("Z", "+00:00"))
        query["ts"] = {"$gte": start_dt, "$lte": end_dt}
    cur_x = coll.find({"symbol": symbolX.upper(), **query}).sort("ts", 1)
    cur_y = coll.find({"symbol": symbolY.upper(), **query}).sort("ts", 1)
    data_x = [{"time": d["ts"], "price": float(d["price"]) } for d in cur_x]
    data_y = [{"time": d["ts"], "price": float(d["price"]) } for d in cur_y]
    agg_x = aggregate_ticks(data_x, timeframe)
    agg_y = aggregate_ticks(data_y, timeframe)
    x_index = {int(x["time"].timestamp() * 1000): i for i, x in enumerate(agg_x)}
    aligned_x = []
    aligned_y = []
    for y in agg_y:
        idx = x_index.get(int(y["time"].timestamp() * 1000))
        if idx is not None:
            aligned_x.append(agg_x[idx])
            aligned_y.append(y)
    output = io.StringIO()
    output.write("Time,X_Close,Y_Close,Spread\n")
    for i, x in enumerate(aligned_x):
        y = aligned_y[i]
        spread = float(y["close"]) - float(x["close"])
        output.write(f"{x['time'].isoformat()},{x['close']},{y['close']},{spread}\n")
    output.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=\"{symbolX.upper()}_{symbolY.upper()}_data.csv\""}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)


async def list_alerts(request):
    return JSONResponse(alerts.list())


async def create_alert(request):
    body = await request.json()
    created = alerts.add({
        "symbolX": str(body.get("symbolX", "")).upper(),
        "symbolY": str(body.get("symbolY", "")).upper(),
        "metric": body.get("metric"),
        "operator": body.get("operator"),
        "threshold": float(body.get("threshold")),
        "message": body.get("message") or f"{body.get('metric')} {body.get('operator')} {body.get('threshold')}",
    })
    return JSONResponse(created)


async def delete_alert(request):
    alert_id = int(request.path_params.get("alert_id"))
    alerts.remove(alert_id)
    return JSONResponse({"message": "Alert removed successfully!"})


routes = [
    Route("/health", endpoint=health),
    Route("/", endpoint=index),
    WebSocketRoute("/", endpoint=WS),
    Route("/api/upload/upload", endpoint=upload_ndjson, methods=["POST"]),
    Route("/api/analytics/analyze", endpoint=analyze, methods=["GET"]),
    Route("/api/analytics/adf-test", endpoint=adf_route, methods=["POST"]),
    Route("/api/analytics/export", endpoint=export_csv, methods=["GET"]),
    Route("/api/alerts/", endpoint=list_alerts, methods=["GET"]),
    Route("/api/alerts/", endpoint=create_alert, methods=["POST"]),
    Route("/api/alerts/{alert_id:int}", endpoint=delete_alert, methods=["DELETE"]),
]

middleware = [
    Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
]

app = Starlette(routes=routes, middleware=middleware)
app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="static")


DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT"]


async def binance_tick_consumer(symbol: str):
    url = f"wss://fstream.binance.com/ws/{symbol.lower()}@trade"
    while True:
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=20) as ws:
                db = get_db()
                coll = db["ticks"]
                while True:
                    msg = await ws.recv()
                    try:
                        j = json.loads(msg)
                        if j.get("e") == "trade":
                            # Normalize tick
                            ts_ms = j.get("T") or j.get("E")
                            ts = datetime.utcfromtimestamp(ts_ms / 1000.0) if isinstance(ts_ms, (int, float)) else datetime.utcnow()
                            price = float(j.get("p"))
                            size = float(j.get("q") or 0.0)
                            doc = {
                                "symbol": str(j.get("s", symbol)).upper(),
                                "ts": ts,
                                "price": price,
                                "size": size,
                            }
                            try:
                                coll.insert_one(doc)
                            except Exception:
                                pass
                    except Exception:
                        # Ignore malformed messages and continue
                        pass
        except Exception:
            # Reconnect after brief delay
            await asyncio.sleep(2)


async def periodic_analytics(symbol_x: str, symbol_y: str, timeframe: str = "1m", window: int = 30):
    # Publish analytics every second using recent DB data
    while True:
        try:
            db = get_db()
            coll = db["ticks"]
            # Look back a reasonable horizon (e.g., 3 hours)
            lookback = datetime.utcnow().timestamp() - 3 * 60 * 60
            start_dt = datetime.utcfromtimestamp(lookback)
            query = {"ts": {"$gte": start_dt}}
            cur_x = coll.find({"symbol": symbol_x.upper(), **query}).sort("ts", 1)
            cur_y = coll.find({"symbol": symbol_y.upper(), **query}).sort("ts", 1)
            data_x = [{"time": d["ts"], "price": float(d["price"]), "size": float(d.get("size", 0))} for d in cur_x]
            data_y = [{"time": d["ts"], "price": float(d["price"]), "size": float(d.get("size", 0))} for d in cur_y]
            if data_x and data_y:
                agg_x = aggregate_ticks(data_x, timeframe)
                agg_y = aggregate_ticks(data_y, timeframe)
                x_index = {int(x["time"].timestamp() * 1000): i for i, x in enumerate(agg_x)}
                aligned_x = []
                aligned_y = []
                for y in agg_y:
                    key = int(y["time"].timestamp() * 1000)
                    idx = x_index.get(key)
                    if idx is not None:
                        aligned_x.append(agg_x[idx])
                        aligned_y.append(y)
                if aligned_x:
                    analytics = compute_analytics(aligned_x, aligned_y, int(window))
                    payload = {
                        "symbolX": symbol_x.upper(),
                        "symbolY": symbol_y.upper(),
                        "timeframe": timeframe,
                        "window": window,
                        "dataPoints": len(aligned_x),
                        "analytics": analytics,
                        "priceData": {
                            "times": [x["time"].isoformat() for x in aligned_x],
                            "xPrices": [float(x["close"]) for x in aligned_x],
                            "yPrices": [float(y["close"]) for y in aligned_y],
                        },
                    }
                    # Alerts
                    triggers = alerts.check(analytics, symbol_x.upper(), symbol_y.upper())
                    for trig in triggers:
                        broadcast({"type": "alert", "message": trig["message"], "currentValue": trig.get("currentValue")})
                    # Broadcast analytics
                    broadcast({"type": "analytics", "payload": payload})
        except Exception:
            # Swallow errors to keep loop alive
            pass
        await asyncio.sleep(1.0)


async def startup():
    # Launch collectors for default symbols and the analytics publisher
    app.state.tasks = []
    # collectors
    for sym in DEFAULT_SYMBOLS:
        app.state.tasks.append(asyncio.create_task(binance_tick_consumer(sym)))
    # analytics between first two symbols
    if len(DEFAULT_SYMBOLS) >= 2:
        app.state.tasks.append(asyncio.create_task(periodic_analytics(DEFAULT_SYMBOLS[0], DEFAULT_SYMBOLS[1])))


async def shutdown():
    tasks = getattr(app.state, "tasks", [])
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


app.add_event_handler("startup", startup)
app.add_event_handler("shutdown", shutdown)

