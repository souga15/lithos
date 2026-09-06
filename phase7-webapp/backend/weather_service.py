"""
LITHOS Phase 7 — Weather Service
Fetches live weather from Open-Meteo API (free, no key needed).
Falls back to mock data if the API is unavailable.
Caches responses for 30 minutes to avoid rate limiting.
"""
import time
import random
import requests
from datetime import datetime, timezone
from typing import Dict, Optional
from mock_data import ALL_REGIONS

_cache: Dict[str, Dict] = {}
CACHE_TTL = 1800  # 30 minutes


def _region_center(region_key: str):
    reg = ALL_REGIONS.get(region_key)
    if not reg:
        return (25.3, 91.73)  # default: cherrapunji
    return reg["center"]


def _mock_weather(region_key: str) -> Dict:
    """Realistic mock weather data per region."""
    rng = random.Random(hash(region_key + str(int(time.time() / 1800))))
    base_rains = {
        "cherrapunji": (40, 180),
        "wayanad": (20, 120),
        "sikkim": (10, 80),
        "manipur_nh2": (15, 100),
        "munnar": (15, 90),
        "idukki": (20, 110),
        "arunachal_w": (12, 85),
        "nagaland": (10, 70),
        "assam_hills": (18, 95),
    }
    lo, hi = base_rains.get(region_key, (5, 60))
    rf24 = round(rng.uniform(lo, hi), 1)
    return {
        "region": region_key,
        "rainfall_1h":    round(rng.uniform(0, rf24 / 12), 2),
        "rainfall_6h":    round(rf24 / 4, 1),
        "rainfall_24h":   rf24,
        "rainfall_72h":   round(rf24 * rng.uniform(2.0, 3.5), 1),
        "soil_moisture":  round(rng.uniform(0.3, 0.95), 2),
        "humidity":       round(rng.uniform(60, 98), 1),
        "temperature":    round(rng.uniform(14, 32), 1),
        "wind_speed":     round(rng.uniform(5, 45), 1),
        "source":         "mock (Open-Meteo unavailable)",
        "fetched_at":     datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def get_live_weather(region_key: str) -> Dict:
    """Fetch live weather. Returns cached if fresh, else fetches from Open-Meteo."""
    cache_key = region_key
    cached = _cache.get(cache_key)
    if cached and (time.time() - cached["_ts"]) < CACHE_TTL:
        result = {k: v for k, v in cached.items() if k != "_ts"}
        result["cached"] = True
        return result

    lat, lon = _region_center(region_key)
    try:
        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            "&hourly=precipitation,soil_moisture_0_1cm,relativehumidity_2m,"
            "temperature_2m,windspeed_10m"
            "&past_days=2&forecast_days=2&timezone=UTC"
        )
        resp = requests.get(url, timeout=8)
        resp.raise_for_status()
        data = resp.json()
        hourly = data.get("hourly", {})

        # Take the latest available hour
        precip = hourly.get("precipitation", [0])
        soil = hourly.get("soil_moisture_0_1cm", [0.5])
        humid = hourly.get("relativehumidity_2m", [80])
        temp = hourly.get("temperature_2m", [25])
        wind = hourly.get("windspeed_10m", [10])

        result = {
            "region": region_key,
            "rainfall_1h":    round(float(precip[-1] if precip else 0), 2),
            "rainfall_6h":    round(sum(precip[-6:]) if len(precip) >= 6 else sum(precip), 1),
            "rainfall_24h":   round(sum(precip[-24:]) if len(precip) >= 24 else sum(precip), 1),
            "rainfall_72h":   round(sum(precip[-72:]) if len(precip) >= 72 else sum(precip), 1),
            "soil_moisture":  round(float(soil[-1] if soil else 0.5), 2),
            "humidity":       round(float(humid[-1] if humid else 80), 1),
            "temperature":    round(float(temp[-1] if temp else 25), 1),
            "wind_speed":     round(float(wind[-1] if wind else 10), 1),
            "source":         "Open-Meteo (live)",
            "fetched_at":     datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "cached":         False,
        }
        _cache[cache_key] = {**result, "_ts": time.time()}
        return result

    except Exception as e:
        result = _mock_weather(region_key)
        result["error"] = str(e)
        result["source"] = "mock (Open-Meteo error)"
        return result


def get_weather_history(region_key: str) -> Dict:
    """Return 7 days of mock hourly rainfall history."""
    rng = random.Random(hash(region_key + "history"))
    hours = []
    from datetime import timedelta
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    for h in range(168):
        t = now - timedelta(hours=167 - h)
        rain = max(0, rng.gauss(8, 15))
        hours.append({
            "timestamp": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "rainfall_mm": round(rain, 1),
            "hour": h,
        })
    return {
        "region": region_key,
        "hours": hours,
        "total_7day_mm": round(sum(h["rainfall_mm"] for h in hours), 1),
    }
