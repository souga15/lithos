"""
LITHOS Phase 7 — FastAPI Backend
All REST endpoints + WebSocket alert streams.
"""
import os
import asyncio
import json
import random
import math
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import uuid
import sys
from io import BytesIO

import numpy as np
from scipy.interpolate import griddata
from PIL import Image as PILImage, ImageDraw, ImageFilter

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger("lithos-api")


from mock_data import (
    ALL_REGIONS, CELLS, ALERTS, REPORTS, FORECASTS, FRESHNESS,
    generate_global_stats, ALL_ALERTS, ALL_CELLS_FLAT, REGION_COUNTS, _iso, _now
)
from routing_engine import find_safe_route
from report_engine import (
    submit_report, confirm_report, resolve_report,
    get_nearby_reports, get_all_reports
)
from weather_service import get_live_weather, get_weather_history
from runout_engine import estimate_runout, find_cascade_impacts, recommended_action
from proximity_service import get_nearby_critical_slopes
import engineer_service
from sos_service import log_sos_event, get_sos_log
from blockage_service import add_blockage, get_active_blockages, get_blockages_geojson, confirm_blockage
from user_tracking import update_position, get_active_positions, get_zone_counts
from pinn_model import dummy_train_model, calculate_fos
import torch

from mock_data import ALL_REPORTS

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize runout fans for routing engine
    from routing_engine import initialize_runout_fans
    initialize_runout_fans()
    
    asyncio.create_task(_broadcast_loop())
    from news_scraper import run_scraper_loop
    asyncio.create_task(run_scraper_loop())
    from sar_updater import run_updater_loop
    asyncio.create_task(run_updater_loop())
    
    # Init PINN model
    app.state.pinn_model = dummy_train_model()
    yield

app = FastAPI(
    title="LITHOS API",
    description="Landslide Intelligence using Temporal & Hyperlocal Observation System",
    version="7.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── WebSocket Manager ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


alert_manager  = ConnectionManager()
report_manager = ConnectionManager()
user_manager   = ConnectionManager()


# ─── Background Alert Broadcaster ────────────────────────────────────────────
_WS_EVENTS = [
    {
        "type": "risk_alert",
        "region": "cherrapunji", "cell_id": 342,
        "risk_level": "RED", "risk_score": 0.91,
        "message": "Rainfall threshold crossed — Proceed cautiously and watch for debris",
        "coordinates": [25.27, 91.73], "rainfall_24h": 187.3,
        "top_factor": "rainfall_72h",
    },
    {
        "type": "community_report",
        "report_id": "rpt_live_001", "region": "manipur_nh2",
        "lat": 24.82, "lon": 93.95,
        "report_type": "road_blocked", "severity": "serious",
        "confirm_count": 2, "verified": True,
        "message": "Caution: Debris reported on NH6. Please slow down.",
        "distance_km": 8.3,
    },
    {
        "type": "weather_alert",
        "region": "assam_hills",
        "message": "Intense rainfall detected in Dima Hasao (42mm/hr). Please drive safely and maintain visibility.",
        "rainfall_1h": 42.1, "risk_change": "ORANGE → RED",
    },
    {
        "type": "risk_alert",
        "region": "sikkim", "cell_id": 117,
        "risk_level": "RED", "risk_score": 0.87,
        "message": "Unstable terrain detected ahead on NH10. High caution advised.",
        "coordinates": [27.55, 88.45], "rainfall_24h": 143.0,
        "top_factor": "deformation_proxy",
    },
    {
        "type": "community_report",
        "report_id": "rpt_live_002", "region": "nagaland",
        "lat": 25.67, "lon": 94.11,
        "report_type": "active_landslide", "severity": "life_threatening",
        "confirm_count": 3, "verified": True,
        "message": "Community report: Mudslide on Kohima–Dimapur bypass. Consider alternative routes.",
        "distance_km": 4.1,
    },
    {
        "type": "weather_alert",
        "region": "arunachal_w",
        "message": "72hr cumulative rainfall: 389mm — extreme saturation in West Kameng corridor",
        "rainfall_1h": 28.5, "risk_change": "ORANGE → RED",
    },
]
_ws_idx = 0


async def _broadcast_loop():
    global _ws_idx
    await asyncio.sleep(5)
    while True:
        event = dict(_WS_EVENTS[_ws_idx % len(_WS_EVENTS)])
        event["timestamp"] = _iso(_now())
        await alert_manager.broadcast(event)
        _ws_idx += 1
        await asyncio.sleep(10)

SENSOR_NODES = [
    {"sensor_id": "SN-001", "lat": 25.27, "lon": 91.73, "type": "tilt", "status": "online", "battery": 92, "last_seen": "2 mins ago"},
    {"sensor_id": "SN-002", "lat": 25.31, "lon": 91.71, "type": "moisture", "status": "online", "battery": 78, "last_seen": "15 mins ago"},
    {"sensor_id": "SN-003", "lat": 24.81, "lon": 93.94, "type": "vibration", "status": "online", "battery": 45, "last_seen": "1 hour ago"},
]


# startup task handled by lifespan event


# ─── WebSocket Endpoints ──────────────────────────────────────────────────────
@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await alert_manager.connect(websocket)
    try:
        # Send welcome ping
        await websocket.send_text(json.dumps({
            "type": "connected",
            "message": "LITHOS alert stream connected",
            "active_regions": list(ALL_REGIONS.keys()),
            "timestamp": _iso(_now()),
        }))
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=60)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        alert_manager.disconnect(websocket)


@app.websocket("/ws/reports")
async def ws_reports(websocket: WebSocket):
    await report_manager.connect(websocket)
    try:
        await websocket.send_text(json.dumps({"type": "connected", "message": "LITHOS report stream"}))
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=60)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        report_manager.disconnect(websocket)


# ─── Root ─────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "name": "LITHOS API",
        "version": "7.0.0",
        "status": "running",
        "regions": list(ALL_REGIONS.keys()),
        "endpoints": [
            "/api/regions", "/api/risk-grid", "/api/risk-grid/all",
            "/api/cell/{cell_id}", "/api/stats", "/api/freshness",
            "/api/weather/live", "/api/weather/history",
            "/api/route", "/api/forecast", "/api/forecast/summary",
            "/api/alerts", "/api/alerts/active", "/api/alerts/subscribe",
            "/api/reports/submit", "/api/reports/nearby",
            "/api/reports/confirm/{id}", "/api/reports/resolve/{id}",
            "/api/reports/history",
            "/ws/alerts", "/ws/reports",
        ],
    }


# ─── RISK ─────────────────────────────────────────────────────────────────────
@app.get("/api/regions")
def get_regions():
    result = []
    for key, info in ALL_REGIONS.items():
        counts = REGION_COUNTS.get(key, {"total": 0, "red": 0, "orange": 0, "green": 0})
        total = counts["total"]
        red = counts["red"]
        orange = counts["orange"]
        green = counts["green"]
        result.append({
            "key": key,
            "name": info["name"],
            "state": info["state"],
            "zone": info["zone"],
            "description": info["description"],
            "bbox": info["bbox"],
            "center": info["center"],
            "cell_count": total,
            "red_count": red,
            "orange_count": orange,
            "green_count": green,
            "red_pct": round(100 * red / max(total, 1), 1),
            "status": "ACTIVE",
        })
    return {"regions": result}


@app.get("/api/risk-grid")
def get_risk_grid(region: str = Query("cherrapunji")):
    if region not in CELLS:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found")
    cells = CELLS[region]
    features = []
    for c in cells:
        # Phase 9: Real Slope Unit Polygons loaded from GPKG
        if "polygon" in c and len(c["polygon"]) > 0:
            coordinates = [c["polygon"]]
        else:
            # Fallback for old square logic (if ever needed)
            step = 0.009
            coordinates = [[
                [c["center_lon"] - step, c["center_lat"] - step],
                [c["center_lon"] + step, c["center_lat"] - step],
                [c["center_lon"] + step, c["center_lat"] + step],
                [c["center_lon"] - step, c["center_lat"] + step],
                [c["center_lon"] - step, c["center_lat"] - step],
            ]]

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": coordinates,
            },
            "properties": c,
        })
    return {
        "type": "FeatureCollection",
        "region": region,
        "feature_count": len(features),
        "features": features,
    }


@app.get("/api/risk-grid/all")
def get_risk_grid_all():
    summary = []
    for key in ALL_REGIONS:
        counts = REGION_COUNTS.get(key, {"total": 0, "red": 0, "orange": 0, "green": 0})
        summary.append({
            "region": key,
            "name": ALL_REGIONS[key]["name"],
            "total": counts["total"],
            "red": counts["red"],
            "orange": counts["orange"],
            "green": counts["green"],
        })
    return {"regions": summary}


@app.get("/api/cell/{cell_id}")
def get_cell(cell_id: str):
    for c in ALL_CELLS_FLAT:
        if c["cell_id"] == cell_id:
            # Assuming fos_static and fos_seismic are available in 'c' or can be derived
            # For this example, we'll use placeholder values if not present
            fos_static = c.get("fos_static", 1.5)
            fos_seismic = c.get("fos_seismic", 1.2)
            return {
                **c,
                "rainfall_72h": round(c["rainfall_72h"], 1),
                "soil_moisture": round(c.get("soil_moisture", 0.5), 2),
                "fos_static": round(fos_static, 2),
                "fos_seismic": round(fos_seismic, 2),
                "top_risk_factor": "rainfall" if c["rainfall_72h"] > 150 else "slope",
                "shap_explanation": {
                    "top_factors": [
                        {"feature": c["top_risk_factor"], "impact": 0.38},
                        {"feature": "rainfall_72h", "impact": 0.27},
                        {"feature": "soil_moisture", "impact": 0.18},
                        {"feature": "slope_mean", "impact": 0.12},
                        {"feature": "ndwi", "impact": 0.05},
                    ],
                    "base_score": 0.12,
                    "model": "XGBoost + CNN + LSTM Fusion",
                },
            }
    raise HTTPException(status_code=404, detail=f"Cell '{cell_id}' not found")


class PINNRequest(BaseModel):
    slope: float
    cohesion: float
    friction: float
    depth: float
    saturation: float
    pga: float = 0.20
    ndvi: float = 0.5
    soil_type: float = 0.5
    rainfall_72h: float = 0.0

@app.post("/api/pinn/predict")
def pinn_predict(req: PINNRequest):
    model = app.state.pinn_model
    x = [req.slope, req.cohesion, req.friction, req.depth, req.saturation,
         req.pga, req.ndvi, req.soil_type, req.rainfall_72h]
    
    # Calculate FoS statically
    fos_static, fos_seismic = calculate_fos(x)
    
    # Convert to tensor for model inferencing
    x_tensor = torch.tensor([x], dtype=torch.float32)
    
    # Predict with Uncertainty (MC Dropout)
    try:
        mean_prob, std_prob = model.predict_with_uncertainty(x_tensor, n_samples=30)
        prob = mean_prob.item()
        uncertainty = std_prob.item()
    except Exception as e:
        # Fallback if uncertainty fails
        prob = model(x_tensor).item()
        uncertainty = 0.05
        
    risk_level = "GREEN"
    score = prob
    if score > 0.75:
        risk_level = "RED"
    elif score > 0.40:
        risk_level = "ORANGE"
        
    return {
        "failure_probability": round(prob, 4),
        "confidence_low": round(max(0, prob - 2*uncertainty), 4),
        "confidence_high": round(min(1, prob + 2*uncertainty), 4),
        "fos_static": round(fos_static, 3),
        "fos_seismic": round(fos_seismic, 3),
        "risk_level": risk_level
    }


# ─── SMOOTH CONTINUOUS HEATMAP IMAGE ─────────────────────────────────────────
from fastapi.responses import Response
import numpy as np
from scipy.interpolate import griddata
from io import BytesIO


@app.get("/api/heatmap-image")
def get_heatmap_image(region: str = Query("sikkim"), mode: str = Query("slope_units"), res: int = Query(1024)):
    """Generate an accurate physical heatmap PNG from real PINN slope units or continuous grid.

    - mode="slope_units": Rasterizes the exact DEM slope-unit polygons with PINN risk scores,
      zero artificial borders, and subtle anti-aliased edge blending for 100% geographical accuracy.
    - mode="smooth_field": Continuous cubic spline field interpolation.
    """
    if region not in CELLS:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found")

    cells = CELLS[region]
    if not cells:
        raise HTTPException(status_code=404, detail="No cells for region")

    reg = ALL_REGIONS[region]
    south, north = reg["bbox"][1], reg["bbox"][3]
    west, east   = reg["bbox"][0], reg["bbox"][2]
    res = min(max(res, 512), 2048)

    from PIL import Image as PILImage, ImageDraw, ImageFilter

    if mode == "slope_units":
        img = PILImage.new('RGBA', (res, res), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        def score_to_rgba(score):
            if score >= 0.80:
                t = min(1.0, (score - 0.80) / 0.20)
                return (235, int(40 - t*25), int(40 - t*25), 215)
            elif score >= 0.60:
                t = (score - 0.60) / 0.20
                return (245, int(135 - t*45), int(25 - t*10), 205)
            elif score >= 0.40:
                t = (score - 0.40) / 0.20
                return (int(220 + t*25), int(190 - t*55), 20, 190)
            elif score >= 0.20:
                t = (score - 0.20) / 0.20
                return (int(45 + t*145), int(185 + t*15), int(85 - t*65), 170)
            else:
                t = score / 0.20
                return (int(20 + t*25), int(95 + t*90), int(210 - t*25), 150)

        for c in cells:
            poly = c.get('polygon', [])
            if not poly or len(poly) < 3:
                step = 0.009
                lat, lon = c['center_lat'], c['center_lon']
                poly = [
                    [lon - step, lat - step],
                    [lon + step, lat - step],
                    [lon + step, lat + step],
                    [lon - step, lat + step]
                ]

            pts = []
            for lon, lat in poly:
                px = int((lon - west) / (east - west) * (res - 1))
                py = int((north - lat) / (north - south) * (res - 1))
                pts.append((px, py))

            if len(pts) >= 3:
                col = score_to_rgba(c['risk_score'])
                draw.polygon(pts, fill=col)

        # Subtle edge anti-aliasing to make slope transitions smooth while keeping 100% boundary accuracy
        final_img = img.filter(ImageFilter.GaussianBlur(radius=1.0))

    else:
        # Continuous interpolation field
        lats   = np.array([c["center_lat"] for c in cells], dtype=np.float64)
        lons   = np.array([c["center_lon"] for c in cells], dtype=np.float64)
        scores = np.array([c["risk_score"]  for c in cells], dtype=np.float64)

        grid_lon = np.linspace(west, east, res)
        grid_lat = np.linspace(south, north, res)
        glon, glat = np.meshgrid(grid_lon, grid_lat)

        try:
            grid_risk = griddata((lons, lats), scores, (glon, glat), method='linear', fill_value=np.nan)
        except Exception:
            grid_risk = griddata((lons, lats), scores, (glon, glat), method='nearest')

        nan_mask = np.isnan(grid_risk)
        if nan_mask.any():
            nearest = griddata((lons, lats), scores, (glon, glat), method='nearest')
            grid_risk[nan_mask] = nearest[nan_mask]

        grid_risk = np.clip(grid_risk, 0.0, 1.0)[::-1]

        v = grid_risk
        rgba = np.zeros((res, res, 4), dtype=np.uint8)

        m0 = v < 0.20
        t0 = v[m0] / 0.20
        rgba[m0, 0] = (20 + t0 * 25).astype(np.uint8)
        rgba[m0, 1] = (95 + t0 * 90).astype(np.uint8)
        rgba[m0, 2] = (210 - t0 * 25).astype(np.uint8)
        rgba[m0, 3] = (150 + t0 * 20).astype(np.uint8)

        m1 = (v >= 0.20) & (v < 0.40)
        t1 = (v[m1] - 0.20) / 0.20
        rgba[m1, 0] = (45 + t1 * 145).astype(np.uint8)
        rgba[m1, 1] = (185 + t1 * 15).astype(np.uint8)
        rgba[m1, 2] = (85 - t1 * 65).astype(np.uint8)
        rgba[m1, 3] = (170 + t1 * 20).astype(np.uint8)

        m2 = (v >= 0.40) & (v < 0.60)
        t2 = (v[m2] - 0.40) / 0.20
        rgba[m2, 0] = (220 + t2 * 25).astype(np.uint8)
        rgba[m2, 1] = (190 - t2 * 55).astype(np.uint8)
        rgba[m2, 2] = 20
        rgba[m2, 3] = (190 + t2 * 15).astype(np.uint8)

        m3 = (v >= 0.60) & (v < 0.80)
        t3 = (v[m3] - 0.60) / 0.20
        rgba[m3, 0] = 245
        rgba[m3, 1] = (135 - t3 * 45).astype(np.uint8)
        rgba[m3, 2] = (25 - t3 * 10).astype(np.uint8)
        rgba[m3, 3] = (205 + t3 * 10).astype(np.uint8)

        m4 = v >= 0.80
        t4 = np.clip((v[m4] - 0.80) / 0.20, 0, 1)
        rgba[m4, 0] = 235
        rgba[m4, 1] = (40 - t4 * 25).astype(np.uint8)
        rgba[m4, 2] = (40 - t4 * 25).astype(np.uint8)
        rgba[m4, 3] = (215 + t4 * 20).astype(np.uint8)

        final_img = PILImage.fromarray(rgba, 'RGBA')
        final_img = final_img.filter(ImageFilter.GaussianBlur(radius=2.0))

    # Mask heatmap image strictly to official state boundary polygon so zero pixels bleed outside
    boundary_file = os.path.join(os.path.dirname(__file__), "data", "ne_state_boundaries.json")
    if os.path.exists(boundary_file):
        try:
            with open(boundary_file, 'r', encoding='utf-8') as bf:
                boundaries = json.load(bf)
            if region in boundaries:
                coords = boundaries[region]
                poly_px = [
                    (int((lon - west) / (east - west) * (res - 1)),
                     int((north - lat) / (north - south) * (res - 1)))
                    for lon, lat in coords
                ]
                if len(poly_px) >= 3:
                    mask = PILImage.new('L', (res, res), 0)
                    mask_draw = ImageDraw.Draw(mask)
                    mask_draw.polygon(poly_px, fill=255)
                    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.5))
                    r, g, b, a = final_img.split()
                    a = PILImage.composite(a, PILImage.new('L', (res, res), 0), mask)
                    final_img = PILImage.merge('RGBA', (r, g, b, a))
        except Exception as e:
            logger.warning(f"Failed to mask heatmap to boundary for {region}: {e}")

    buf = BytesIO()
    final_img.save(buf, format='PNG', optimize=True)
    buf.seek(0)


    return Response(
        content=buf.read(),
        media_type="image/png",
        headers={
            "X-Bounds-South": str(round(south, 6)),
            "X-Bounds-North": str(round(north, 6)),
            "X-Bounds-West":  str(round(west, 6)),
            "X-Bounds-East":  str(round(east, 6)),
            "X-Cell-Count":   str(len(cells)),
            "Cache-Control":  "public, max-age=300",
            "Access-Control-Expose-Headers": "X-Bounds-South,X-Bounds-North,X-Bounds-West,X-Bounds-East,X-Cell-Count",
        },
    )


@app.get("/api/stats")
def get_stats():
    # Calculate real community reports for the last 24 hours
    now = _now()
    yesterday_iso = _iso(now - timedelta(days=1))
    
    # We load real reports using the dynamic getter rather than static var
    all_reports = get_all_reports()
    
    reports_last_24h = sum(
        1 for r in all_reports 
        if r.get("timestamp") and r["timestamp"] > yesterday_iso
    )
    
    dynamic_stats = generate_global_stats(CELLS)
    dynamic_stats["community_reports_today"] = reports_last_24h
    dynamic_stats["active_alerts"] = sum(1 for a in ALL_ALERTS if a.get("is_active", False))
    return dynamic_stats


@app.get("/api/timeline")
def get_timeline():
    # Return 7 days of historical stats
    now = _now()
    labels = []
    rainfall = []
    risk = []
    for d in range(6, -1, -1):
        t = now - timedelta(days=d)
        labels.append(t.strftime("%a"))
        # Simulate historical fluctuation based on current cell average
        # In a real app this would query a historical database
        base_rain = sum(c["rainfall_24h"] for c in ALL_CELLS_FLAT) / max(len(ALL_CELLS_FLAT), 1)
        base_risk = sum(c["risk_score"] for c in ALL_CELLS_FLAT) / max(len(ALL_CELLS_FLAT), 1)
        
        # Add some pseudo-random historical curve
        fade = math.sin((6-d) * math.pi / 6) 
        rain_val = base_rain * (0.3 + fade * 1.5)
        risk_val = base_risk * (0.6 + fade * 0.8)
        
        rainfall.append(round(rain_val, 1))
        risk.append(round(risk_val, 2))
        
    return {
        "labels": labels,
        "rainfall": rainfall,
        "risk_score": risk
    }


@app.get("/api/freshness")
def get_freshness():
    return {"sources": FRESHNESS}


# ─── WEATHER ──────────────────────────────────────────────────────────────────
@app.get("/api/weather/live")
def weather_live(region: str = Query("cherrapunji")):
    if region not in ALL_REGIONS:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found")
    return get_live_weather(region)


@app.get("/api/weather/history")
def weather_history(region: str = Query("cherrapunji")):
    if region not in ALL_REGIONS:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found")
    return get_weather_history(region)


# ─── ROUTING ──────────────────────────────────────────────────────────────────
class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    region: str = "cherrapunji"


@app.post("/api/route")
def get_route(req: RouteRequest):
    result = find_safe_route(req.start_lat, req.start_lon, req.end_lat, req.end_lon, req.region)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ─── FORECAST ─────────────────────────────────────────────────────────────────
@app.get("/api/forecast")
def get_forecast(region: str = Query("cherrapunji")):
    if region not in FORECASTS:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found")
    return {"region": region, "region_name": ALL_REGIONS[region]["name"], "forecast": FORECASTS[region]}


@app.get("/api/forecast/summary")
def get_forecast_summary(region: str = Query("cherrapunji")):
    if region not in FORECASTS:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found")
    fc = FORECASTS[region]
    def _window(start_h, end_h):
        window = fc[start_h:end_h]
        max_score = max(h["predicted_risk_score"] for h in window)
        avg_rain = sum(h["rainfall_mm"] for h in window) / len(window)
        from mock_data import _risk_level
        lvl = _risk_level(max_score)
        driver = window[window.index(max(window, key=lambda h: h["predicted_risk_score"]))]["key_driver"]
        conf = round(sum(h["confidence_pct"] for h in window) / len(window), 1)
        msgs = {
            "GREEN": "Low risk — conditions look safe",
            "ORANGE": "Moderate risk — monitor closely",
            "RED": "HIGH RISK — avoid travel if possible",
        }
        return {"level": lvl, "max_score": round(max_score, 3), "avg_rainfall_mm": round(avg_rain, 1),
                "key_driver": driver, "confidence_pct": conf, "message": msgs[lvl]}
    return {
        "region": region,
        "next_6h": _window(0, 6),
        "next_24h": _window(0, 24),
        "next_72h": _window(0, 72),
    }


# ─── ALERTS ───────────────────────────────────────────────────────────────────
@app.get("/api/alerts")
def get_alerts(region: Optional[str] = None):
    alerts = ALERTS.get(region, []) if region else ALL_ALERTS
    return {"alerts": sorted(alerts, key=lambda a: a["triggered_at"], reverse=True)}


@app.get("/api/alerts/active")
def get_active_alerts():
    active = [a for a in ALL_ALERTS if a.get("is_active", False)]
    return {"active_alerts": active, "count": len(active)}


class SubscribeRequest(BaseModel):
    email: str
    regions: List[str] = []


@app.post("/api/alerts/subscribe")
def subscribe(req: SubscribeRequest):
    return {
        "success": True,
        "message": f"✅ Subscribed! You'll receive alerts for {len(req.regions) or 'all'} region(s).",
        "email": req.email,
        "regions": req.regions or list(ALL_REGIONS.keys()),
    }

# ─── RUNOUT ANALYSIS ──────────────────────────────────────────────────────────
@app.get("/api/runout/{cell_id}")
@app.get("/api/runout")
def get_runout(cell_id: str = None):
    """Estimate debris runout zone and cascade impacts for a failing slope unit."""
    source = next((c for c in ALL_CELLS_FLAT if c["cell_id"] == cell_id), None)
    if source is None:
        raise HTTPException(status_code=404, detail=f"Cell '{cell_id}' not found")

    runout = estimate_runout(source, ALL_CELLS_FLAT)
    impacts = find_cascade_impacts(
        source, ALL_CELLS_FLAT,
        runout["fan_polygon"],
        runout["runout_distance_m"],
        runout["aspect_deg"],
    )
    action = recommended_action(runout["runout_distance_m"], impacts, source)

    return {
        "source_cell_id":     cell_id,
        "region":             source.get("region", ""),
        "fos_seismic":        round(source.get("fos_seismic", 4.0), 2),
        "slope_mean":         source.get("slope_mean", 0),
        "soil_type":          source.get("soil_type", ""),
        "H_m":                runout["H_m"],
        "travel_angle_deg":   runout["travel_angle_deg"],
        "runout_distance_m":  runout["runout_distance_m"],
        "aspect_deg":         runout["aspect_deg"],
        "debris_volume_m3":   runout["debris_volume_m3"],
        "fan_polygon":        runout["fan_polygon"],
        "impacts":            impacts,
        "cascade_risk":       impacts["cascade_risk"],
        "recommended_action": action,
    }


@app.get("/api/proximity-alerts")
def proximity_alerts(lat: float, lon: float, radius: float = 6.0):
    """Find nearby critical hazards for live navigation."""
    hazards = get_nearby_critical_slopes(lat, lon, radius)
    return {
        "user_lat": lat,
        "user_lon": lon,
        "radius_km": radius,
        "hazard_count": len(hazards),
        "hazards": hazards
    }


@app.get("/api/active-runouts")
def get_active_runouts(region: Optional[str] = None):
    """Return all pre-calculated runout fans (global or for a specific region)."""
    from routing_engine import ACTIVE_RUNOUT_FANS
    if region and region.lower() != "all":
        reg_clean = region.strip().lower()
        matched = [
            f for f in ACTIVE_RUNOUT_FANS 
            if f.get("region") == reg_clean or f["cell_id"].lower().startswith(reg_clean)
        ]
        return matched
    return ACTIVE_RUNOUT_FANS


# ─── REPORTS ──────────────────────────────────────────────────────────────────
class ReportSubmit(BaseModel):
    lat: float
    lon: float
    type: str
    severity: str
    user_id: str = "anonymous"
    photo_base64: Optional[str] = None
    description: Optional[str] = None


@app.post("/api/reports/submit")
async def submit_report_endpoint(req: ReportSubmit):
    result = submit_report(req.lat, req.lon, req.type, req.severity, req.user_id,
                           req.photo_base64, req.description)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    # Broadcast to report stream
    await report_manager.broadcast({
        "type": "new_report",
        "lat": req.lat, "lon": req.lon,
        "report_type": req.type, "severity": req.severity,
        "verified": result.get("verified", False),
        "timestamp": _iso(_now()),
    })
    return result


@app.get("/api/reports/nearby")
def reports_nearby(lat: float, lon: float, radius_km: float = 10):
    return {"reports": get_nearby_reports(lat, lon, radius_km)}


class ConfirmRequest(BaseModel):
    user_id: str


@app.post("/api/reports/confirm/{report_id}")
def confirm(report_id: str, req: ConfirmRequest):
    return confirm_report(report_id, req.user_id)


@app.post("/api/reports/resolve/{report_id}")
def resolve(report_id: str):
    return resolve_report(report_id)


@app.get("/api/reports/history")
def reports_history():
    return {"reports": get_all_reports()}


# ─── ENGINEER PORTAL APIS ─────────────────────────────────────────────────────
class AuthReq(BaseModel):
    email: str
    password: str
    mode: str
    access_code: Optional[str] = None

@app.post("/api/engineer/auth")
def engineer_auth(req: AuthReq):
    res = engineer_service.verify_engineer_auth(req.email, req.password, req.mode, req.access_code)
    if not res.get("success"):
        raise HTTPException(status_code=401, detail=res["error"])
    return res

class SimulateEqReq(BaseModel):
    fos_static: float
    slope_mean: float
    magnitude: float

@app.post("/api/engineer/simulate-earthquake")
def sim_earthquake(req: SimulateEqReq):
    return engineer_service.simulate_earthquake(req.fos_static, req.slope_mean, req.magnitude)

class PostDisasterReq(BaseModel):
    deformation_proxy: float
    slope_mean: float

@app.post("/api/engineer/post-disaster-assessment")
def pd_assessment(req: PostDisasterReq):
    return engineer_service.post_disaster_assessment(req.deformation_proxy, req.slope_mean)

class CostBenefitReq(BaseModel):
    slope_mean: float
    road_class: str

@app.post("/api/engineer/cost-benefit")
def cost_benefit(req: CostBenefitReq):
    return engineer_service.calculate_cost_benefit(req.slope_mean, req.road_class)

# ─── IOT COMMUNITY SENSOR API ─────────────────────────────────────────────────
class SensorReport(BaseModel):
    sensor_id: str
    lat: float
    lon: float
    type: str
    value: float
    battery: int

@app.post("/api/sensor/report")
async def receive_sensor_data(data: SensorReport):
    # Log to console for debugging
    print(f"📡 IoT EVENT: {data.sensor_id} | Type: {data.type} | Value: {data.value}")
    
    # Trigger a real-time WebSocket alert
    alert_msg = {
        "type": "sensor_alert",
        "sensor_id": data.sensor_id,
        "lat": data.lat, "lon": data.lon,
        "sensor_type": data.type,
        "value": data.value,
        "message": f"GROUND MOVEMENT: {data.type.upper()} trigger at {data.sensor_id}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    await alert_manager.broadcast(alert_msg)
    
    return {"status": "success", "alert_broadcasted": True}

@app.get("/api/sensor/nodes")
def get_sensor_nodes():
    return {"nodes": SENSOR_NODES}


# ─── LIVE USER TRACKING WebSocket ────────────────────────────────────────────
@app.websocket("/ws/users")
async def ws_users(websocket: WebSocket):
    await user_manager.connect(websocket)
    try:
        await websocket.send_text(json.dumps({"type": "connected", "message": "LITHOS user tracker"}))
        while True:
            try:
                positions = get_active_positions()
                await websocket.send_text(json.dumps({"type": "positions", "users": positions}))
                await asyncio.sleep(5)
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        user_manager.disconnect(websocket)


# ─── SOS ──────────────────────────────────────────────────────────────────────
class SOSRequest(BaseModel):
    lat:     float
    lon:     float
    region:  str = "unknown"
    message: str = "EMERGENCY SOS"

@app.post("/api/sos")
async def receive_sos(req: SOSRequest):
    event = log_sos_event(req.lat, req.lon, req.region, req.message)
    await alert_manager.broadcast({
        "type":      "sos_alert",
        "sos_id":    event["sos_id"],
        "lat":       req.lat,
        "lon":       req.lon,
        "region":    req.region,
        "message":   req.message,
        "timestamp": event["timestamp"],
    })
    return {"status": "broadcast", "sos_id": event["sos_id"]}


# ─── BLOCKAGES ────────────────────────────────────────────────────────────────
class BlockageRequest(BaseModel):
    lat:     float
    lon:     float
    message: str = "Road blocked"

@app.post("/api/blockage")
async def report_blockage(req: BlockageRequest):
    entry = add_blockage(req.lat, req.lon, req.message)
    await alert_manager.broadcast({
        "type":    "blockage_alert",
        "lat":     req.lat,
        "lon":     req.lon,
        "message": req.message,
        "id":      entry["id"],
    })
    return {"status": "reported", "blockage_id": entry["id"], "expires_at": entry["expires_at"]}

@app.get("/api/blockages")
def get_blockages():
    return get_blockages_geojson()

@app.post("/api/blockage/{blockage_id}/confirm")
def confirm_blockage_endpoint(blockage_id: str):
    ok = confirm_blockage(blockage_id)
    return {"confirmed": ok}


# ─── USER POSITION ────────────────────────────────────────────────────────────
class PositionRequest(BaseModel):
    session_id: str
    lat:        float
    lon:        float
    risk:       str = "GREEN"

@app.post("/api/users/position")
def post_user_position(req: PositionRequest):
    update_position(req.session_id, req.lat, req.lon, req.risk)
    return {"status": "ok"}

@app.get("/api/users/positions")
def get_user_positions():
    return {"users": get_active_positions()}


# ─── ADMIN ────────────────────────────────────────────────────────────────────
@app.get("/api/admin/sos-log")
def admin_sos_log():
    return {"events": get_sos_log(50)}

@app.get("/api/admin/user-counts")
def admin_user_counts():
    return get_zone_counts()

class EvacuationRequest(BaseModel):
    message: str = "CRITICAL: Mass evacuation order. Move to nearest assembly point."

@app.post("/api/admin/evacuation")
async def admin_evacuation(req: EvacuationRequest):
    await alert_manager.broadcast({
        "type":    "mass_evacuation",
        "message": req.message,
        "timestamp": _iso(_now()),
    })
    return {"status": "broadcast", "recipients": len(alert_manager.active)}


_ENRICHED_DF = None

def _get_enriched_df():
    global _ENRICHED_DF
    if _ENRICHED_DF is None:
        import os
        csv_path = os.path.join(os.path.dirname(__file__), "units_enriched.csv")
        if os.path.exists(csv_path):
            try:
                import pandas as pd
                _ENRICHED_DF = pd.read_csv(csv_path, usecols=['center_lat', 'center_lon', 'elevation_m', 'pred_probability', 'region'])
                print(f"[3D Mesh] Loaded {len(_ENRICHED_DF):,} real units from units_enriched.csv")
            except Exception as e:
                print(f"[3D Mesh] Could not load units_enriched.csv ({e})")
    return _ENRICHED_DF


@app.get("/api/terrain/3d-heatmap-mesh")
def get_3d_heatmap_mesh(region: str = Query(default="sikkim"), grid_res: int = Query(default=60)):
    import numpy as np
    import torch
    from scipy.interpolate import griddata
    from mock_data import _PINN, _SLOPE_UNITS_GDF

    reg = ALL_REGIONS.get(region, ALL_REGIONS["sikkim"])
    csv_region = reg.get("csv_region")
    bbox = reg.get("bbox")
    if bbox:
        w_w, w_s, w_e, w_n = bbox
    else:
        c_lat, c_lon = reg["center"]
        d_lat, d_lon = 0.55, 0.55
        w_s, w_n = c_lat - d_lat, c_lat + d_lat
        w_w, w_e = c_lon - d_lon, c_lon + d_lon

    enriched_df = _get_enriched_df()
    used_enriched = False
    
    if enriched_df is not None:
        if csv_region and "region" in enriched_df.columns:
            sub = enriched_df[enriched_df["region"] == csv_region]
        else:
            sub = enriched_df[
                (enriched_df.center_lat >= w_s) & (enriched_df.center_lat <= w_n) &
                (enriched_df.center_lon >= w_w) & (enriched_df.center_lon <= w_e)
            ]
        if len(sub) >= 10:
            used_enriched = True
            w_w = float(sub["center_lon"].min())
            w_e = float(sub["center_lon"].max())
            w_s = float(sub["center_lat"].min())
            w_n = float(sub["center_lat"].max())

            lon_vec = np.linspace(w_w, w_e, grid_res)
            lat_vec = np.linspace(w_s, w_n, grid_res)
            lon_mesh, lat_mesh = np.meshgrid(lon_vec, lat_vec)

            sample_sub = sub if len(sub) <= 15000 else sub.sample(15000, random_state=42)
            pts = np.column_stack([sample_sub["center_lon"].to_numpy(), sample_sub["center_lat"].to_numpy()])
            elev_pts = sample_sub["elevation_m"].to_numpy()
            probs = sample_sub["pred_probability"].to_numpy()
            
            z_grid = griddata(pts, elev_pts, (lon_mesh, lat_mesh), method='linear')
            nan_m = np.isnan(z_grid)
            if nan_m.any():
                z_grid[nan_m] = griddata(pts, elev_pts, (lon_mesh[nan_m], lat_mesh[nan_m]), method='nearest')
                
            risk_grid = griddata(pts, probs, (lon_mesh, lat_mesh), method='linear')
            nan_r = np.isnan(risk_grid)
            if nan_r.any():
                risk_grid[nan_r] = griddata(pts, probs, (lon_mesh[nan_r], lat_mesh[nan_r]), method='nearest')

    if not used_enriched:
        lon_vec = np.linspace(w_w, w_e, grid_res)
        lat_vec = np.linspace(w_s, w_n, grid_res)
        lon_mesh, lat_mesh = np.meshgrid(lon_vec, lat_vec)
        df = _SLOPE_UNITS_GDF[_SLOPE_UNITS_GDF["region"] == region] if _SLOPE_UNITS_GDF is not None else None
        if df is not None and not df.empty:
            pts = np.column_stack([df["center_lon"].to_numpy(), df["center_lat"].to_numpy()])
            elev_pts = df["elevation_m"].to_numpy() if "elevation_m" in df.columns else np.random.uniform(500, 2500, len(df))
            
            feats = []
            for _, row in df.iterrows():
                slope = row.get("slope_degrees", 28.0)
                c, phi = 18.0, 26.0
                z = row.get("depth_real", 1.5)
                sat = row.get("saturation_real", 0.55)
                pga = 0.24 if reg.get("zone") == "northeast" else 0.16
                ndvi = row.get("ndvi_real", 0.65)
                soil_f = 0.4
                rf72 = row.get("rain72h_climatic", 90.0)
                feats.append([slope, c, phi, z, sat, pga, ndvi, soil_f, rf72])
                
            xt = torch.tensor(feats, dtype=torch.float32)
            with torch.no_grad():
                if _PINN:
                    probs = _PINN(xt).squeeze().cpu().numpy()
                else:
                    probs = np.random.uniform(0.1, 0.9, len(df))
            if np.ndim(probs) == 0:
                probs = np.array([probs.item()])
                
            z_grid = griddata(pts, elev_pts, (lon_mesh, lat_mesh), method='linear')
            nan_m = np.isnan(z_grid)
            if nan_m.any():
                z_grid[nan_m] = griddata(pts, elev_pts, (lon_mesh[nan_m], lat_mesh[nan_m]), method='nearest')
                
            risk_grid = griddata(pts, probs, (lon_mesh, lat_mesh), method='linear')
            nan_r = np.isnan(risk_grid)
            if nan_r.any():
                risk_grid[nan_r] = griddata(pts, probs, (lon_mesh[nan_r], lat_mesh[nan_r]), method='nearest')
        else:
            z_grid = 800 + 1200 * np.sin(lat_mesh * 20) * np.cos(lon_mesh * 20)
            risk_grid = np.clip(0.3 + 0.5 * np.sin(lat_mesh * 15 + lon_mesh * 10)**2, 0.05, 0.95)
        
    return {
        "region": region,
        "region_name": reg.get("name", region.capitalize()),
        "bounds": { "south": round(w_s, 3), "north": round(w_n, 3), "west": round(w_w, 3), "east": round(w_e, 3) },
        "x": [round(float(v), 5) for v in lon_vec],
        "y": [round(float(v), 5) for v in lat_vec],
        "z": [[round(float(val), 1) for val in row] for row in z_grid],
        "risk": [[round(float(val), 4) for val in row] for row in risk_grid],
        "stats": {
            "min_elev": round(float(np.min(z_grid)), 1),
            "max_elev": round(float(np.max(z_grid)), 1),
            "mean_risk": round(float(np.mean(risk_grid)), 3),
            "max_risk": round(float(np.max(risk_grid)), 3),
            "high_risk_cells": int(np.sum(risk_grid > 0.6))
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

