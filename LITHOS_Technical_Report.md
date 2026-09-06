# LITHOS — Technical Report

**Landslide Intelligence using Temporal & Hyperlocal Observation System**

---

| Field | Value |
|---|---|
| **Version** | Phase 9 (Final) |
| **Author** | Sougata |
| **Date** | March 2026 |
| **Stack** | Python (FastAPI) + React (Vite) |
| **Regions Covered** | 9 landslide-prone zones across India |
| **Total Slope Units** | ~10,000+ real DEM-derived polygons |

---

## 1. Executive Summary

LITHOS is a real-time landslide early-warning and decision-support system designed for India's most vulnerable regions. It combines **satellite radar imagery**, **real digital elevation models**, **live weather data**, **geotechnical soil classification**, and **physics-based slope stability analysis** into a single full-stack web application.

The system monitors over **10,000 topographic slope units** across 9 regions, computes **Factor of Safety (FoS)** for each unit using the infinite slope model with seismic loading, and provides:

- Real-time risk colour-coding (RED / ORANGE / GREEN)
- Debris runout zone estimation using the fahrböschung travel-angle model
- Safe route navigation that avoids high-risk and active runout zones
- Community reporting with trust-based verification
- Live news scraping from Google News RSS feeds
- 72-hour risk forecasting
- Engineer-grade geotechnical analysis portal

---

## 2. Monitored Regions

| # | Region Key | Name | State | Terrain |
|---|---|---|---|---|
| 1 | `cherrapunji` | Cherrapunji, Meghalaya | Meghalaya | Wettest place on Earth — extreme rainfall |
| 2 | `sikkim` | Sikkim | Sikkim | High-altitude glacial terrain with GLOF risk |
| 3 | `manipur_nh2` | Manipur NH2 Corridor | Manipur | Highway corridor through fragile flysch |
| 4 | `arunachal_w` | Arunachal Pradesh (West) | Arunachal Pradesh | Himalayan colluvium slopes |
| 5 | `nagaland` | Nagaland | Nagaland | Naga Hills sandstone residual |
| 6 | `assam_hills` | Assam Hills | Assam | Karbi Anglong hills + Brahmaputra plains |
| 7 | `wayanad` | Wayanad, Kerala | Kerala | Western Ghats laterite over gneiss |
| 8 | `idukki` | Idukki, Kerala | Kerala | Tea estate slopes — deep laterite |
| 9 | `munnar` | Munnar, Kerala | Kerala | High-altitude charnockite terrain |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ Home    │ │Dashboard │ │SafeRoute │ │EngineerPort.│  │
│  │ (Map)   │ │(Stats)   │ │(OSRM Nav)│ │(Geotech)    │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └─────┬───────┘  │
│       │           │            │              │          │
│  ┌────┴───────────┴────────────┴──────────────┴───────┐  │
│  │         Axios HTTP + WebSocket (ws://alerts)       │  │
│  └────────────────────────┬───────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │ REST API (port 8000)
┌───────────────────────────┼──────────────────────────────┐
│                    BACKEND (FastAPI)                      │
│  ┌────────────────────────┴───────────────────────────┐  │
│  │                  main.py (API Server)              │  │
│  │  30+ endpoints  •  WebSocket alerts  •  CORS       │  │
│  └─┬──────┬──────┬──────┬──────┬──────┬──────┬───────┘  │
│    │      │      │      │      │      │      │          │
│  ┌─┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐     │
│  │Terr││Soil ││Weath││Defor││Runout│ │Route││News │     │
│  │ain ││Class││er   ││m.   ││Eng. ││Eng. ││Scrap│     │
│  └─┬──┘└──┬──┘└──┬──┘└──┬──┘└──┬──┘└──┬──┘└──┬──┘     │
│    │      │      │      │      │      │      │         │
│  SRTM   GSI   Open   S1-SAR  Physics OSRM  Google     │
│  30m    Maps  Meteo  GeoTIFF  Model  API   News RSS    │
└────────────────────────────────────────────────────────┘
```

---

## 4. Data Sources

### 4.1 Digital Elevation Model (DEM)
- **Source**: NASA SRTM 30m via Open Topo Data API (`api.opentopodata.org/v1/srtm30m`)
- **Resolution**: 30 metres
- **Usage**: Real elevation for each cell centroid + 4-point gradient for slope calculation
- **Caching**: `terrain_cache.json` (2.4 MB, ~50,000 cached elevations)
- **Implementation**: `terrain_service.py` → `TerrainService` singleton

### 4.2 Slope Unit Polygons
- **Source**: WhiteboxTools slope-unit extraction run on SRTM tiles in Google Colab
- **Format**: GeoPackage (`lithos_all_slope_units_final.gpkg`)
- **Quality Gate**: Regions pass only if avg exterior vertices ≥ 20 AND max aspect ratio ≤ 8.0
- **Fallback**: 2 km grid generation for regions that fail the quality gate
- **Implementation**: `mock_data.py` → `generate_cells()` with GPKG/hybrid/grid paths

### 4.3 Sentinel-1 SAR Imagery
- **Source**: Copernicus S1_GRD via Google Earth Engine
- **Polarisation**: VV (Vertical-Vertical)
- **Processing**: Pre/post-event backscatter change → deformation proxy (0–1)
- **Files**: `S1_pre_event.tif` + `S1_post_event.tif` (~2 GB combined)
- **Caching**: `deform_cache.json` (5.7 MB, avoids repeated rasterio disk I/O)
- **Implementation**: `deformation_service.py` → `DeformationService` singleton
- **Live Update**: `sar_updater.py` → downloads latest GEE image + shifts temporal baseline

### 4.4 Weather Data
- **Source**: Open-Meteo API (free, no API key)
- **Parameters**: Precipitation (1h/6h/24h/72h), soil moisture, humidity, temperature, wind speed
- **Cache TTL**: 30 minutes
- **Fallback**: Region-calibrated mock weather if API fails
- **Implementation**: `weather_service.py` → `get_live_weather()`

### 4.5 Soil Classification
- **Source**: GSI (Geological Survey of India) District Resource Maps
- **Citations**: Sajinkumar et al. (2011), Nair (2006), Sattar et al. (2024), IS 14458:1998
- **Parameters per region**: Soil type, cohesion (kPa), friction angle (°), unit weight (kN/m³), failure depth (m), rainfall threshold (72h mm)
- **Implementation**: `soil_classifier.py` → `classify_soil(lat, lon, elevation, region)`

### 4.6 Live News
- **Source**: Google News RSS feed (search queries: "landslide road blocked India", etc.)
- **Scrape frequency**: Every 15 minutes (async background task)
- **Deduplication**: `seen_titles.json` (persistent across restarts)
- **Geo-tagging**: Keyword-to-coordinate mapping for 20+ Indian towns/highways
- **Implementation**: `news_scraper.py` → `run_scraper_loop()` (async)

---

## 5. Scientific Models

### 5.1 Factor of Safety (FoS) — Infinite Slope Model

The core risk metric. Computed per slope unit using the IS 1893/IS 14458 standard:

```
FoS_static = [c + (γ - m·γ_w)·z·cos²β·tan(φ)] / [γ·z·sinβ·cosβ]

FoS_seismic = [c + (γ - m·γ_w)·z·cos²β·tan(φ)] / [γ·z·sinβ·cosβ + k_h·γ·z·cos²β]
```

| Symbol | Meaning | Source |
|---|---|---|
| c | Cohesion (kPa) | GSI soil classification |
| φ | Friction angle (°) | GSI soil classification |
| γ | Unit weight (kN/m³) | GSI soil classification |
| γ_w | Water unit weight (9.81 kN/m³) | Constant |
| z | Failure depth (m) | GSI soil classification |
| β | Slope angle (°) | SRTM DEM gradient |
| m | Saturation ratio (0–1) | rainfall_72h / threshold_72h |
| k_h | Seismic coefficient | 0.12 (NE India) / 0.05 (elsewhere) |

**Risk Score**:
```
physics_score = max(0.01, min(0.99, 1.25 - FoS_seismic × 0.5))
final_score   = min(0.99, physics_score + SAR_deformation × 0.4)
```

**Classification**: RED (≥ 0.7) | ORANGE (0.4–0.7) | GREEN (< 0.4)

### 5.2 Runout Zone Estimation — Fahrböschung Model

When a slope fails (FoS < 1.0), the debris travel distance is estimated:

```
L = H / tan(α)
```

| Parameter | Value | Description |
|---|---|---|
| H | Elevation drop to valley floor | Computed from neighbouring cells |
| α (soft soil) | 8° | Alluvial / colluvium debris flows |
| α (rock/residual) | 11° | Soil slides on residual material |
| Fan spread | ±20° | Either side of downslope aspect |
| Max L | 15 km | Safety cap |

**Cascade Impact Classification**:
- **Chain Slopes**: FoS < 1.5 AND slope > 20° within the fan
- **Road Risk**: Elevation drop > 50m AND highway region
- **River Risk**: Cell elevation < 15% above valley floor

### 5.3 Safe Route Navigation

- **Primary routing**: OSRM public API (`router.project-osrm.org`) for real road-snapped routes
- **Risk overlay**: Each route segment is annotated with the underlying cell's risk level
- **Runout avoidance**: Routes that pass through active debris runout fans are flagged RED
- **Alternative routes**: 2 alternatives generated via intermediate waypoints with varying detour offsets
- **Safe score**: `1.0 - (RED_cells × 1.0 + ORANGE_cells × 0.3) / total_cells`

---

## 6. Backend Architecture

### 6.1 API Server (`main.py`)
- **Framework**: FastAPI with async support
- **30+ REST endpoints** covering risk grids, weather, alerts, routing, forecasts, reports, runout analysis
- **2 WebSocket streams**: Real-time alert broadcasting + community report broadcasting
- **Background tasks**: News scraper loop (every 15 min) + runout fan pre-calculation at startup
- **CORS**: Configured for localhost development

### 6.2 Key API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/regions` | GET | List all 9 monitored regions |
| `/api/risk-grid?region=X` | GET | GeoJSON FeatureCollection of slope units with risk data |
| `/api/cell/{cell_id}` | GET | Detailed geotechnical analysis for a single cell |
| `/api/runout/{cell_id}` | GET | Runout zone estimation + cascade impact analysis |
| `/api/active-runouts` | GET | All pre-calculated runout fans for routing overlay |
| `/api/weather/live?region=X` | GET | Live rainfall, soil moisture, temperature |
| `/api/weather/history?region=X` | GET | 7-day hourly rainfall history |
| `/api/forecast?region=X` | GET | 72-hour risk forecast |
| `/api/forecast/summary?region=X` | GET | Condensed 6h/24h/72h risk windows |
| `/api/route` | POST | Safe route with risk-annotated segments |
| `/api/alerts` | GET | All triggered alerts |
| `/api/alerts/active` | GET | Currently active alerts |
| `/api/alerts/subscribe` | POST | Email subscription for region alerts |
| `/api/reports/submit` | POST | Submit a community report |
| `/api/reports/confirm/{id}` | POST | Confirm another user's report |
| `/api/reports/resolve/{id}` | POST | Mark a report as resolved |
| `/api/reports/nearby` | GET | Reports within radius of coordinates |
| `/api/reports/history` | GET | All reports (sorted by recency) |
| `/api/stats` | GET | Global system statistics |
| `/api/timeline` | GET | 7-day historical trend data |
| `ws://ws/alerts` | WS | Real-time alert WebSocket stream |
| `ws://ws/reports` | WS | Real-time report WebSocket stream |

### 6.3 Module Summary

| Module | Lines | Role |
|---|---|---|
| `main.py` | 568 | FastAPI server, all endpoints, WebSocket |
| `mock_data.py` | 809 | Cell generation from GPKG, FoS calculation, alerts, forecasts |
| `runout_engine.py` | 335 | Fahrböschung runout model, fan geometry, cascade impacts |
| `routing_engine.py` | 285 | OSRM-based safe routing with runout avoidance |
| `news_scraper.py` | 211 | Google News RSS scraper → live reports |
| `report_engine.py` | 192 | Community report submission, trust scoring, verification |
| `soil_classifier.py` | 150 | GSI-based geotechnical soil classification |
| `deformation_service.py` | 137 | Sentinel-1 SAR backscatter change analysis |
| `weather_service.py` | 129 | Open-Meteo live weather + fallback mocks |
| `terrain_service.py` | 136 | SRTM 30m DEM elevation + slope calculation |
| `sar_updater.py` | 110 | Google Earth Engine live SAR image downloader |

---

## 7. Frontend Architecture

### 7.1 Technology Stack
- **Framework**: React 18 + Vite
- **Styling**: TailwindCSS with custom design tokens (glassmorphism theme)
- **Maps**: React-Leaflet with CartoDB Dark Matter tiles
- **Icons**: Lucide React
- **HTTP**: Axios
- **Routing**: React Router v6

### 7.2 Design System
- **Theme**: Dark glassmorphism (`bg: #0A0E1A`, glass panels with `backdrop-blur`)
- **Accent**: Cyan (`#00C2FF`)
- **Risk colours**: RED (`#FF3B30`), ORANGE (`#FF9500`), GREEN (`#30D158`)
- **Typography**: System font stack with black weight headings
- **Animations**: CSS pulse, fade-in, slide-up

### 7.3 Pages

| Page | File | Description |
|---|---|---|
| **Home** | `Home.jsx` | Main map view with region selector, rainfall widget, risk distribution, cell click → runout modal |
| **Dashboard** | `Dashboard.jsx` | Global statistics, timeline charts, data freshness indicators |
| **Safe Route** | `SafeRoute.jsx` | Point-to-point navigation with risk-aware routing, turn-by-turn, GPS tracking |
| **Forecast** | `Forecast.jsx` | 72-hour risk prediction with hourly rainfall/risk graphs |
| **Alerts** | `Alerts.jsx` | Live alert feed with WebSocket updates, severity filtering |
| **Reports** | `Reports.jsx` | Community report submission form, report history, photo upload |
| **Regions** | `Regions.jsx` | Region comparison cards with risk distribution bars |
| **About** | `About.jsx` | Project description, methodology, team information |
| **Engineer Portal** | `EngineerPortal.jsx` | Full geotechnical analysis: FoS calculations, IS compliance, SHAP explanations, soil profiles |

### 7.4 Key Components

| Component | Description |
|---|---|
| `RiskMap.jsx` | Leaflet map with GeoJSON risk polygons, runout fan overlays (heatmap + circle fallback), global influence areas |
| `RunoutPanel.jsx` | Detailed runout analysis display: drop height, runout distance, debris volume, downstream impacts, cascade risk level |
| `RainfallWidget.jsx` | Live rainfall intensity display with 6h/24h/72h accumulation, soil moisture bar, MODIS LST |
| `Navbar.jsx` | Navigation bar with live alert count badge, offline indicator, report button |
| `AlertBanner.jsx` | Scrolling alert ticker at the bottom of the home page |
| `SatelliteToggle.jsx` | Map layer switcher: Street / Satellite / SAR |
| `RiskBadge.jsx` | Colour-coded risk level pill (RED/ORANGE/GREEN) |
| `OfflineBanner.jsx` | Offline mode indicator |
| `InstallPrompt.jsx` | PWA install prompt |

---

## 8. Key Achievements

### 8.1 Scientific Rigour
- ✅ Factor of Safety computed using the **infinite slope stability model** (IS 1893 / IS 14458 compliant)
- ✅ Seismic loading coefficient calibrated per seismic zone (k_h = 0.12 for NE India)
- ✅ Soil parameters sourced from **published GSI geological surveys** with academic citations
- ✅ Runout estimation using the **fahrböschung (travel-angle) empirical model** used internationally
- ✅ Real SRTM 30m elevation data (not random numbers)
- ✅ Real Sentinel-1 SAR radar imagery for ground deformation detection

### 8.2 Real-Time Capabilities
- ✅ **Live weather** from Open-Meteo (rainfall, soil moisture, temperature)
- ✅ **Live news scraping** from Google News RSS feeds (auto-classified by severity)
- ✅ **WebSocket** real-time alert and report broadcasting
- ✅ **Community reporting** with trust-based verification and rate limiting
- ✅ **GPS tracking** in safe route navigation

### 8.3 Engineering Quality
- ✅ **9 regions** with genuine DEM-derived topographic slope unit polygons
- ✅ **Polygon quality gate** (vertex count + aspect ratio check) prevents low-quality data
- ✅ **Multi-layer caching** (terrain, deformation, weather) for fast startup
- ✅ **Error boundaries** on every React component — crash isolation
- ✅ **Lazy loading** of all pages — fast initial bundle
- ✅ **Offline awareness** with OfflineBanner and cached data fallbacks
- ✅ **OSRM integration** for real road-snapped navigation routes

### 8.4 User Experience
- ✅ Premium **glassmorphism dark theme** with animated risk visualisations
- ✅ **Interactive map** with click-to-analyse for any slope unit
- ✅ **Runout heatmap fan** with directional gradient (red → orange → yellow)
- ✅ **Circle fallback** when slope aspect is unknown (worst-case radius)
- ✅ **Global influence overlay** showing all active runout zones simultaneously
- ✅ **Engineer Portal** with full geotechnical data, SHAP explanations, and IS code compliance checks

---

## 9. File Structure

```
LITHOS/
├── phase7-webapp/
│   ├── backend/
│   │   ├── main.py                  # FastAPI server (30+ endpoints)
│   │   ├── mock_data.py             # Cell generation + FoS physics
│   │   ├── runout_engine.py         # Fahrböschung runout model
│   │   ├── routing_engine.py        # OSRM safe routing
│   │   ├── terrain_service.py       # SRTM 30m DEM fetcher
│   │   ├── soil_classifier.py       # GSI geotechnical classification
│   │   ├── deformation_service.py   # Sentinel-1 SAR analysis
│   │   ├── weather_service.py       # Open-Meteo live weather
│   │   ├── news_scraper.py          # Google News RSS → reports
│   │   ├── report_engine.py         # Community reports + trust
│   │   ├── sar_updater.py           # GEE live SAR downloader
│   │   ├── terrain_cache.json       # Cached SRTM elevations
│   │   └── deform_cache.json        # Cached SAR deformation
│   │
│   └── frontend/
│       └── src/
│           ├── App.jsx              # Router + Error Boundaries
│           ├── main.jsx             # React entry point
│           ├── index.css            # Global styles + design tokens
│           ├── components/          # 9 reusable UI components
│           └── pages/               # 9 application pages
│
├── colab files/
│   ├── Phase2_data/sentinel1/       # Sentinel-1 SAR GeoTIFFs
│   └── phase9/new all slope/        # DEM slope unit GPKG
│
└── LITHOS_Technical_Report.md       # This document
```

---

## 10. How to Run

### Backend
```bash
cd phase7-webapp/backend
pip install -r requirements.txt
python main.py
# Server starts on http://localhost:8000
```

### Frontend
```bash
cd phase7-webapp/frontend
npm install
npm run dev
# App opens on http://localhost:5173
```

### Dependencies
- **Python**: FastAPI, uvicorn, geopandas, rasterio, numpy, requests
- **Node.js**: React 18, Vite, react-leaflet, axios, lucide-react, tailwindcss

---

## 11. Future Scope

| Enhancement | Description |
|---|---|
| **Full India Coverage** | Extend from 9 to 30+ regions covering all landslide-prone zones |
| **Real ML Model** | Replace physics-based scoring with trained XGBoost/LSTM model on historical landslide records |
| **PostgreSQL/PostGIS** | Migrate from in-memory storage to spatial database for scalability |
| **Mobile APK** | Capacitor wrapper for Android Play Store distribution |
| **Offline-first PWA** | Service worker + IndexedDB for full offline operation |
| **Multi-temporal SAR** | Automated InSAR processing for millimetre-precision ground deformation |
| **Alert Routing** | Push notifications via Firebase Cloud Messaging |
| **Cloud Deployment** | Railway/Render/GCP deployment with CI/CD pipeline |

---

*LITHOS — Because every slope tells a story. We listen before it speaks.*
