# LITHOS — Backend System & Geospatial Engine Report
**Document Code:** LITHOS-TR-BE-01  
**Project:** LITHOS (Terrain Intelligence Platform)  
**Domain:** High-Performance Geospatial Backend, Asynchronous APIs, InSAR/Weather Integration, Spatial Routing  
**Author:** LITHOS Backend Engineering Team  
**Status:** Production / Field-Deployable  

---

## Executive Summary

The **LITHOS Backend Subsystem** is an asynchronous geospatial intelligence engine built on **FastAPI**, **GeoPandas**, **PyTorch**, and **GDAL/Pyogrio**. It operates as the mission-critical server responsible for spatial data management, real-time multi-source telemetry fusion, analytical and PINN inference execution, dynamic heatmap rasterization, and safe evacuation route planning.

The backend processes over **45,137 high-resolution DEM slope-unit polygons** covering all eight Northeast Indian states and high-hazard corridors of the Western Ghats. It guarantees sub-100ms API response times through intelligent in-memory indexing, threaded background elevation warming, and pre-compiled spatial bounds.

---

## 1. System Architecture & Component Diagram

```
                              CLIENT APPS
              (React 18 + CesiumJS 3D / MapLibre 2D / Mobile)
                                   │
                                   ▼
                   Uvicorn / FastAPI ASGI Server
            ┌──────────────────────┴──────────────────────┐
            ▼                                             ▼
   RESTful API Endpoints                         WebSocket Engine
 (/api/risk-grid, /api/heatmap-image,         (/ws/alerts real-time push)
  /api/safe-route, /api/reports)                          │
            │                                             │
            ├─────────────────────────────────────────────┤
            ▼                                             ▼
  Geospatial Storage Layer                     Data Fusion Services
  - lithos_all_slope_units_final.gpkg          - Open-Meteo Weather API
  - Pyogrio / GeoPandas In-Memory Spatial DB   - Sentinel-1 InSAR Deformation
  - Survey of India Boundary Masks             - GSI Soil Classification Engine
            │                                             │
            └──────────────────────┬──────────────────────┘
                                   │
                                   ▼
                       Analytical & AI Engines
                       - PINN PyTorch Inference (ResNet-9D)
                       - Limit Equilibrium Solver (IS 14458 / IS 1893)
                       - Voellmy Debris Runout Simulator
                       - A* Evacuation Routing Engine
```

---

## 2. Spatial Data Management & The Slope-Unit Model

A defining architectural strength of LITHOS is the abandonment of arbitrary square pixel grids in favor of **hydrological and geomorphological slope units**.

### 2.1 The GeoPackage Datastore
* **File:** `lithos_all_slope_units_final.gpkg` (OpenGIS GeoPackage format).
* **Layer:** `lithos_all_slope_units_final` (Total units: 45,137).
* **Spatial Reference System:** EPSG:4326 (WGS 84).
* **Engine:** `pyogrio` with C-level GDAL bindings for sub-second reading of large polygon layers.
* **Unit Attributes per Feature:**
  * `unit_id`: Unique identifier
  * `region`: Region key (`sikkim`, `arunachal_w`, `cherrapunji`, `assam_hills`, `manipur_nh2`, `nagaland`, `mizoram`, `tripura`, `wayanad`, `idukki`)
  * `geometry`: Irregular multi-vertex polygon capturing natural ridge-and-channel divides (average $115 - 312$ exterior vertices per unit)
  * `slope_degrees`: True average topographic inclination
  * `elevation_m`: Mean elevation above mean sea level
  * `center_lat`, `center_lon`: Centroid coordinates
  * `area_km2`: Catchment surface area
  * `rain_72h`: Antecedent rainfall accumulation
  * `fos`: Static and pseudo-static Factor of Safety
  * `risk_level`: Calibrated classification (`GREEN`, `ORANGE`, `RED`)
  * `pred_probability`: Model failure probability

### 2.2 Quality Gates
To prevent geometric distortions, all slope units pass rigorous geometry validation:
* **Average Vertices Gate:** $\ge 15$ vertices per polygon (rules out artificial rectangles).
* **Aspect Ratio Gate:** 99th percentile aspect ratio ($w/h$) $\le 20.0$, eliminating narrow slivers while preserving elongated river gorges.

---

## 3. Real-Time Telemetry & Data Fusion Pipeline

The backend continuously ingests and harmonizes three independent streams of physical data:

### 3.1 Live Meteorological Integration (`weather_service.py`)
* Connects directly to the **Open-Meteo Historical & Forecast Weather API**.
* Retrieves real-time $24\text{h}$ precipitation, $72\text{h}$ accumulated rainfall, and topsoil relative moisture.
* **Orographic Lapse Rate Correction:** Rainfall in mountain catchments increases significantly with altitude. LITHOS applies an elevation-dependent orographic multiplier:
  $$P_{\text{corrected}} = P_{\text{station}} \times \left(1.0 + \frac{\text{Elevation}}{5000.0} + \Delta_{\text{coord}}\right)$$

### 3.2 Satellite InSAR Ground Deformation Service (`deformation_service.py`)
* Integrates Sentinel-1 C-band synthetic aperture radar interferometry line-of-sight (LOS) displacement maps.
* Monitors millimeter-scale creeping ground deformation ($v_{\text{LOS}} \text{ mm/yr}$).
* Injected into the risk pipeline as a deformation proxy parameter, boosting hazard scores if active downslope creep is detected even before major rainfall begins.

### 3.3 GSI Lithological Classification Engine (`soil_classifier.py`)
* Maps geographic coordinates and elevation bands to authentic Geological Survey of India (GSI) published district resource maps.
* Resolves site-specific geotechnical parameters:
  * **Arunachal High Himalayas ($>2,800\text{ m}$):** Crystalline Regolith ($c=24\text{ kPa}, \phi=35^\circ, \gamma=19.5\text{ kN/m}^3$).
  * **Arunachal Middle Himalayas ($1,000 - 2,800\text{ m}$):** Bomdila Gneiss Residual ($c=26\text{ kPa}, \phi=34^\circ, \gamma=19.0\text{ kN/m}^3$).
  * **Arunachal Foothills / Valleys ($<1,000\text{ m}$):** Siwalik Sandstone ($c=18\text{ kPa}, \phi=31^\circ, \gamma=18.5\text{ kN/m}^3$).
  * **Meghalaya (Cherrapunji Plateau):** Granite Gneiss ($c=22\text{ kPa}, \phi=35^\circ$) and Shillong Sandy Loam.
  * **Sikkim:** Phyllite Schist Residual ($c=22\text{ kPa}, \phi=32^\circ$) and Glacial Moraine.
  * **Kerala (Western Ghats):** Charnockite Residual ($c=18\text{ kPa}, \phi=32^\circ$) and Deep Laterite.

---

## 4. Dynamic Rasterization & Image Generation (`/api/heatmap-image`)

Rendering 45,000 vector polygons directly on the client side at 60 FPS can overwhelm web browsers. LITHOS solves this by implementing an ultra-fast, server-side rasterization pipeline returning hardware-optimized PNGs draped directly onto 3D Cesium terrain.

### 4.1 Mode A: 2D Exact Slope-Unit Vector Rasterizer
* Takes the exact multi-vertex boundaries of every slope unit in the active bounding box.
* Projects coordinates into high-resolution pixel space ($(x, y) \in [0, \text{res}]$).
* Fills each polygon using a calibrated RGBA hazard palette:
  * Safe (Green): $(20, 95, 210) \to (45, 185, 85)$
  * Moderate (Yellow/Orange): $(220, 190, 20) \to (245, 135, 25)$
  * Critical Hazard (Red): $(235, 40, 40, 215)$
* Applies subtle anti-aliasing Gaussian smoothing ($\sigma = 1.0$) to guarantee clean polygon interfaces without pixelated stepping.

### 4.2 Mode B: 3D Continuous Gradient Field
* Extracts spatial centroids $(x_i, y_i)$ and continuous risk scores $s_i$.
* Builds a continuous 2D cubic spline field using `scipy.interpolate.griddata` with linear and nearest-neighbor fallback interpolation.
* Generates a smooth, continuous scalar potential field visualizing regional stress concentrations.

### 4.3 Official Survey of India Boundary Masking
* Prevents the heatmap from bleeding over national or state boundaries.
* Loads official multi-polygon borders from `ne_state_boundaries.json`.
* Applies an alpha-channel clip mask so that exactly zero pixels render outside state boundaries.

---

## 5. Safe Route Planning & Evacuation Engine (`routing_engine.py`)

During monsoon crises, conventional navigation services (like Google Maps) routinely route vehicles through critical failure zones because they only optimize for travel time. The LITHOS Safe Route Engine optimizes for **life safety and hazard avoidance**.

### 5.1 Dynamic Hazard Cost Function
The road network is modeled as a weighted directed graph $G = (V, E)$, where edge weights are penalized by the geotechnical failure probability of intersecting slope units:

$$W(e) = \text{Length}(e) \times \left(1.0 + \alpha \cdot [P_{\text{failure}}(e)]^3\right) + \beta \cdot \text{RoadblockPenalty}(e)$$

Where:
* $\alpha = 15.0$: Severe cubic penalty ensuring routes detour around high-hazard cliffs even if it adds extra distance.
* $\beta$: Infinite cost penalty if a road segment intersects an active debris flow runout or a verified roadblock report.
* Algorithm: Modified Dijkstra / A* with Haversine distance heuristic.

---

## 6. Real-Time Alerting, Reports & Infrastructure

* **WebSocket Alert Channel (`/ws/alerts`):** Asynchronous push notification system notifying connected incident command centers of sudden telemetry spikes (e.g., rainfall exceeding $150\text{ mm}$ in $24\text{h}$).
* **Automated News Scraping (`news_scraper.py`):** Background crawler indexing official disaster bulletins, NHAI highway advisories, and local press reports.
* **Engineering Audit Engine (`report_engine.py`):** Produces formal PDF and JSON geotechnical compliance certificates documenting slope stability, seismic compliance (IS 1893), and drainage mitigation recommendations.
