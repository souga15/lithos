
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from routing_engine import LITHOSRouter
import os

app = FastAPI(title="LITHOS Routing API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                  allow_methods=["*"], allow_headers=["*"])

router = LITHOSRouter(
    roads_dir  = os.getenv("ROADS_DIR",  "lithos_data/roads/"),
    grid_path  = os.getenv("GRID_PATH",
                 "lithos_data/phase4/lithos_phase4_master_grid.gpkg")
)


class RouteRequest(BaseModel):
    region:    str
    start_lat: float
    start_lon: float
    end_lat:   float
    end_lon:   float


@app.get("/")
def root():
    return {
        "status":  "LITHOS Routing API running",
        "regions": list(router.graphs.keys()),
        "endpoints": ["/route", "/regions", "/health"]
    }


@app.get("/health")
def health():
    return {"status": "ok", "graphs_loaded": len(router.graphs)}


@app.get("/regions")
def get_regions():
    from routing_engine import ALL_REGIONS
    return {
        "regions": [
            {"key": k, "name": v["name"],
             "bbox": v["bbox"],
             "has_graph": k in router.graphs}
            for k, v in ALL_REGIONS.items()
        ]
    }


@app.post("/route")
def get_safe_route(req: RouteRequest):
    """
    Find the safest route from A to B in a LITHOS region.

    Example request:
        POST /route
        {
          "region":    "wayanad",
          "start_lat":  11.5,
          "start_lon":  75.8,
          "end_lat":    11.85,
          "end_lon":    76.2
        }
    """
    if req.region not in router.graphs:
        raise HTTPException(
            status_code=404,
            detail=f"Region '{req.region}' not found. "
                   f"Available: {list(router.graphs.keys())}"
        )
    result = router.find_safe_route(
        req.region,
        req.start_lat, req.start_lon,
        req.end_lat,   req.end_lon
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
