# 🎨 LITHOS Frontend Developer Guide

> **Target Audience:** Frontend Engineers, UI/UX Developers, 3D WebGIS Developers  
> **Tech Stack:** React 18, Vite, TailwindCSS, CesiumJS, Leaflet / React-Leaflet, Plotly.js, Lucide Icons

---

## 1. Directory Structure (`phase7-webapp/frontend/`)

```
phase7-webapp/frontend/
├── index.html                  # HTML5 entrypoint & Google Fonts preloading (Inter)
├── vite.config.js              # Vite build configuration (Cesium plugin & static asset rules)
├── tailwind.config.js          # Tailwind CSS design system tokens (space palette, risk colors)
├── package.json                # Dependencies & script definitions
├── .env.example                # Template for frontend environment variables
│
├── public/                     # Static assets
│   ├── logo.png                # LITHOS platform brand identity
│   ├── manifest.json           # PWA Web Application manifest
│   ├── sw.js                   # Service Worker for offline capability
│   └── sensor.html             # Lightweight standalone phone sensor page
│
└── src/
    ├── main.jsx                # React root hydration & router provider
    ├── index.css               # Core CSS, glassmorphism utilities & animations
    ├── apiConfig.js            # Axios base URL & WebSocket endpoint resolver
    │
    ├── pages/                  # Route-level views
    │   ├── Home.jsx            # Multi-mode overview (2D Map, 3D PINN Heatmap, 3D Mesh)
    │   ├── HeatmapView.jsx     # Full-screen comparative viewer (3D Mesh / 3D Globe / 2D Swipe)
    │   ├── SafeRoute.jsx       # Dynamic A* evacuation routing & real-time guidance
    │   ├── Dashboard.jsx       # Macro-regional risk matrix & KPI analytics
    │   ├── EngineerPortal.jsx  # Geotechnical inspector & IS 14680 civil remediation toolkit
    │   ├── Forecast.jsx        # Rainfall clock & 72h monsoon exceedance predictions
    │   ├── Alerts.jsx          # Civil defence alert feed & emergency broadcast
    │   ├── PhoneSensor.jsx     # Device accelerometer/gyroscope slope tilt sensor
    │   ├── Regions.jsx         # Regional hazard selector & profile cards
    │   ├── Reports.jsx         # Field incident submission & community reports
    │   ├── AdminPortal.jsx     # Emergency services command console
    │   └── About.jsx           # Mission statement, architecture roadmap & citations
    │
    └── components/             # Reusable UI & Geospatial widgets
        ├── CesiumTerrain3D.jsx # Hardware-accelerated 3D Virtual Globe (CesiumJS)
        ├── Terrain3DHeatmap.jsx# Continuous 3D Topographic Mesh surface (Plotly.js)
        ├── RiskMap.jsx         # 2D Leaflet interactive tile map with GeoJSON polygons
        ├── SatelliteToggle.jsx # 2D map base layer switcher (Dark / Satellite / Street)
        ├── RainfallClock.jsx   # Circular countdown timer to critical rainfall thresholds
        ├── RainfallWidget.jsx  # Live precipitation gauge
        ├── RegionScanner.jsx   # Radar animation during spatial data fetch
        ├── RunoutPanel.jsx     # Debris flow runout risk indicator
        ├── BlockageReport.jsx  # Road obstruction modal
        ├── SOSButton.jsx       # Emergency distress beacon with GPS coordinates
        ├── Navbar.jsx          # Glassmorphic top navigation bar
        ├── AlertBanner.jsx     # Global hazard broadcast ticker
        ├── OfflineBanner.jsx   # Network loss detection banner
        ├── PrivacyConsent.jsx  # GDPR/data privacy modal
        └── Engineer/           # Specialized geotechnical inspection components
            ├── AnalysisPanels.jsx
            ├── HardwareHub.jsx
            ├── SlopeCrossSection.jsx
            └── EngineerAuth.jsx
```

---

## 2. Environment Setup & Execution

### 2.1 Node.js Version
Make sure you have **Node.js 18.0+** and `npm` installed:
```bash
node -v   # Should output v18.x.x or higher
npm -v
```

### 2.2 Install Dependencies
```bash
cd phase7-webapp/frontend
npm install
```

### 2.3 Configuration (`.env`)
Create your local environment file:
```bash
cp .env.example .env
```
Default parameters:
```env
VITE_API_URL=http://localhost:8000
VITE_CESIUM_TOKEN=your_public_cesium_ion_token
```
> **Cesium Token:** The application contains a default built-in token. If you wish to use your own Cesium Ion account, obtain a free access token from [cesium.com](https://cesium.com/ion/tokens) and set `VITE_CESIUM_TOKEN`.

### 2.4 Start Development Server
```bash
npm run dev
```
The app will launch at: **`http://localhost:5173/`**  
Vite Hot Module Replacement (HMR) is enabled; changes to `.jsx` or `.css` files update instantly in the browser.

### 2.5 Production Build
```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 3. Key 3D & Geospatial Components

### 3.1 `CesiumTerrain3D.jsx` (3D Virtual Globe)
- **Engine:** CesiumJS with `Cesium.createWorldTerrainAsync()`.
- **Layers:**
  1. **Photorealistic Base Imagery:** Sentinel-2 / Bing aerial tiles.
  2. **3D Buildings:** OpenStreetMap 3D building vector tiles (`Cesium.createOsmBuildingsAsync()`) rendered with natural urban clustering.
  3. **Continuous PINN Heatmap Drape:** Clamped to the 3D surface using an offscreen canvas texture with soft boundary feathering (`edgeDist` alpha fade).
  4. **Live Device GPS:** Synchronizes using the standard W3C Geolocation API (`navigator.geolocation.getCurrentPosition`), flying the camera to the user's coordinates and evaluating immediate slope hazard.
  5. **Controls:** Sleek floating glassmorphism HUD without casual emojis, featuring `3D HEATMAP`, `SATELLITE BASE`, `3D BUILDINGS`, `LIVE GPS`, and `SIKKIM BENCHMARK`.

### 3.2 `Terrain3DHeatmap.jsx` (Topographic Mesh)
- **Engine:** Plotly.js 3D Surface.
- **Features:** Continuous elevation matrix with embedded contour lines ($Z$), colored by failure probability ($P$). Provides interactive 3D rotation, pitch, and hover inspection of hazard metrics.

### 3.3 `SafeRoute.jsx` (Emergency Evacuation)
- **Engine:** React-Leaflet (2D) + CesiumJS (3D toggle).
- **Features:** Click-to-set start and destination markers, dynamic path calculation avoiding high hazard zones, and automated turn-by-turn navigation with real-time hazard ring warnings.

---

## 4. UI Style Guide & Design Standards

- **Theme:** Ultra-sleek dark mode (`bg-space-950` / `#07091A`) with glassmorphic cards (`backdrop-blur-xl`, `border-white/10`).
- **Typography:** Modern clean sans-serif (**Inter**) with uppercase tracked labels (`tracking-widest`).
- **Icons:** **Lucide React** vector icons (`<Layers />`, `<Globe />`, `<Sliders />`, `<Navigation />`, `<MapPin />`, `<AlertTriangle />`).  
  *Note:* No casual emojis (`🔥`, `📱`, `⛺`, `🏢`) should be used in UI headers or buttons to preserve a defense-grade and scientific standard.
- **Risk Color Tokens:**
  - **Critical / Very High ($\ge 0.80$):** `#dc2626` (Red)
  - **High ($0.60 - 0.79$):** `#f97316` (Orange)
  - **Moderate ($0.40 - 0.59$):** `#eab308` (Yellow)
  - **Low ($0.20 - 0.39$):** `#22c55e` (Green)
  - **Very Low ($< 0.20$):** `#3b82f6` (Blue)
