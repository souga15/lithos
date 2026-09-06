# 🛠️ LITHOS Backend Developer Guide

> **Target Audience:** Python Engineers, Geospatial Data Scientists, ML/AI Engineers  
> **Tech Stack:** Python 3.10+, FastAPI (ASGI), PyTorch, NumPy, Pandas, GeoPandas, GDAL, Uvicorn, WebSockets

---

## 1. Directory Structure (`phase7-webapp/backend/`)

```
phase7-webapp/backend/
├── main.py                     # Primary FastAPI application entrypoint (REST + WebSockets)
├── run_backend.py              # Lightweight server launcher (uvicorn runner)
├── requirements.txt            # Pinned Python package dependencies
├── .env.example                # Template for environment configuration
├── pinn_model_v2.pth           # Trained PyTorch PINN model weights (79,169 params)
├── pinn_model.py               # PyTorch PINN architecture definition (ResNet backbone)
├── priority_survey_sites.csv   # Top 100 prioritized exploration sites (IS 14680:1999)
│
├── routing_engine.py           # A* routing with geomechanical risk cost penalties
├── runout_engine.py            # Landslide debris flow runout estimation
├── deformation_service.py      # InSAR satellite ground deformation tracking
├── weather_service.py          # Real-time rainfall & IMD/Open-Meteo weather integration
├── proximity_service.py        # Spatial KD-Tree lookups for nearby hazards
├── report_engine.py            # PDF report generation for geotechnical engineers
├── news_scraper.py             # Automated hazard news aggregator
├── soil_classifier.py          # IS 1498 soil classification helpers
├── blockage_service.py         # Road blockage community reporting service
├── sos_service.py              # Emergency civilian SOS dispatch handler
├── user_tracking.py            # Real-time WebSocket multi-user GPS tracking
│
├── data/                       # Cached GeoJSON boundaries & terrain matrices
│   ├── sikkim.geojson
│   ├── arunachal.geojson
│   └── ...
└── Dockerfile                  # Container definition for cloud deployment
```

---

## 2. Environment Setup & Execution

### 2.1 Virtual Environment
Ensure you have **Python 3.10+** installed:
```bash
cd phase7-webapp/backend

# Create virtual environment
python -m venv .venv

# Activate environment:
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (CMD):
.venv\Scripts\activate.bat
# Linux / macOS:
source .venv/bin/activate
```

### 2.2 Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 2.3 Configuration (`.env`)
Copy the template and configure any optional external API keys:
```bash
cp .env.example .env
```
Key configuration parameters:
- `PORT`: Server port (default: `8000`).
- `HOST`: Server bind host (default: `0.0.0.0`).
- `ORS_API_KEY`: *(Optional)* OpenRouteService API key for road network routing. If omitted, the built-in synthetic A* routing engine operates seamlessly.

### 2.4 Start the Backend Server
```bash
# Option A: Using the provided launcher script
python run_backend.py

# Option B: Direct uvicorn with auto-reload
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Server verification:
- **API Health Check:** `http://localhost:8000/api/health`
- **Interactive Swagger Docs:** `http://localhost:8000/docs`
- **ReDoc Documentation:** `http://localhost:8000/redoc`

---

## 3. Core API Architecture & Endpoints

### 3.1 Geotechnical & PINN Hazard Prediction
* **`POST /api/predict`**
  - **Description:** Evaluates failure probability using the Phase 11 ResNet PINN model.
  - **Inputs:** 14 geotechnical/meteorological parameters (`slope_deg`, `aspect_deg`, `cohesion_kpa`, `friction_deg`, `rainfall_mm`, `pga`, `soil_moisture_index`, `ndvi`, etc.).
  - **Output:**
    ```json
    {
      "failure_probability": 0.842,
      "risk_level": "RED",
      "factor_of_safety": 0.68,
      "uncertainty": 0.082,
      "is14680_recommendation": "Series of check dams + lined chute spillways"
    }
    ```

### 3.2 Geospatial Grid & Digital Twin Draping
* **`GET /api/regions`**
  - Returns supported geographic bounding boxes (Sikkim, Arunachal Pradesh, Meghalaya, Manipur, Nagaland).
* **`GET /api/terrain/3d-heatmap-mesh?region={region}&grid_res=60`**
  - Returns a continuous elevation grid $Z(H \times W)$ and interpolated PINN risk matrix $P(H \times W)$ covering the entire regional bounding box for Cesium 3D and Plotly 3D draping.
* **`GET /api/heatmap-image?region={region}&mode={slope_units|smooth_field}&res=1024`**
  - High-speed dynamic PNG generator that rasterizes hundreds of thousands of slope units with natural edge feathering.

### 3.3 Dynamic Safe Route Engine
* **`POST /api/route`**
  - Computes pathfinding between start/end GPS coordinates, penalizing segments passing through high hazard zones ($\hat{p} > 0.60$).
  - Returns safe transit waypoints, hazard warnings, and nearby evacuation shelter coordinates.

### 3.4 Live WebSocket Dispatch
* **`WS /ws/alerts`**
  - Bi-directional WebSocket pipe broadcasting live rainfall exceedance alerts, active road blockages, and civilian SOS signals.

---

## 4. Key Engineering Notes

1. **Deterministic Fallbacks:** If external APIs (such as OpenSky aircraft or satellite feeds) rate-limit, the backend automatically serves pre-computed regional caches without crashing.
2. **Coordinate Reference Systems:** All API endpoints expect and output coordinates in standard **WGS84 (EPSG:4326)** (`[longitude, latitude]`).
3. **No Synthetic Label Leakage:** When retraining or modifying the PINN architecture, ensure empirical ground truth (`NASA GLC` / `GSI`) is used rather than hard analytical thresholding.
