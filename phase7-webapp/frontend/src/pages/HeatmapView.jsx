import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, Crosshair, Sparkles, Layers, Sliders, Mountain, Globe } from 'lucide-react';
import API_BASE_URL from '../apiConfig';
import Terrain3DHeatmap from '../components/Terrain3DHeatmap';

const CesiumTerrain3DLazy = React.lazy(() =>
  import('../components/CesiumTerrain3D').catch((err) => {
    console.error('Failed to load Cesium component', err);
    return { default: () => <div className="p-8 text-center text-white/60">Cesium 3D Globe loading...</div> };
  })
);

/* ── Risk label & color helpers ───────────────────────────────── */
const riskLabel = (score) => {
  if (score >= 0.80) return 'Very High';
  if (score >= 0.60) return 'High';
  if (score >= 0.40) return 'Moderate';
  if (score >= 0.20) return 'Low';
  return 'Very Low';
};

const riskColor = (score) => {
  if (score >= 0.80) return '#dc2626';
  if (score >= 0.60) return '#f97316';
  if (score >= 0.40) return '#eab308';
  if (score >= 0.20) return '#22c55e';
  return '#3b82f6';
};

/* ── Recenter helper ─────────────────────────────────────────── */
const FlyTo = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 11, { duration: 1 });
  }, [center, zoom, map]);
  return null;
};

/* ── Heatmap image overlay (Accurate Slope Units or Smooth Field) ── */
const HeatmapImageOverlay = ({ regionKey, renderMode, opacity }) => {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map || !regionKey || renderMode === 'polygons') return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const backendMode = renderMode === 'smooth' ? 'smooth_field' : 'slope_units';
    const url = `${API_BASE_URL}/api/heatmap-image?region=${regionKey}&mode=${backendMode}&res=1024`;

    fetch(url)
      .then(async (resp) => {
        if (!resp.ok) throw new Error('Heatmap fetch failed');
        const south = parseFloat(resp.headers.get('X-Bounds-South'));
        const north = parseFloat(resp.headers.get('X-Bounds-North'));
        const west  = parseFloat(resp.headers.get('X-Bounds-West'));
        const east  = parseFloat(resp.headers.get('X-Bounds-East'));
        const blob  = await resp.blob();
        const imgUrl = URL.createObjectURL(blob);

        const bounds = [[south, west], [north, east]];
        const overlay = L.imageOverlay(imgUrl, bounds, {
          opacity: opacity || 0.88,
          interactive: false,
        });
        overlay.addTo(map);
        layerRef.current = overlay;
      })
      .catch(err => console.error('Heatmap overlay error:', err));

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, regionKey, renderMode, opacity]);

  return null;
};

/* ── Cursor tracker ──────────────────────────────────────────── */
const Tracker = ({ onMove }) => {
  useMapEvents({ mousemove: (e) => onMove(e.latlng) });
  return null;
};

/* ═══════════════════════════════════════════════════════════════ */
const HeatmapView = () => {
  const [regions, setRegions] = useState([]);
  const [regionKey, setRegionKey] = useState('sikkim');
  const [viewDimension, setViewDimension] = useState('3d'); // '3d' (3D Mesh) | '2d' (Satellite Swipe)
  const [geojson, setGeojson] = useState(null);
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renderMode, setRenderMode] = useState('slope_units'); // 'slope_units' | 'smooth' | 'polygons'
  const [cursor, setCursor] = useState({ lat: '—', lng: '—', risk: '—', score: 0 });
  const [sliderPos, setSliderPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef(null);

  /* Fetch region list */
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/regions`).then(r => {
      setRegions(r.data.regions || []);
    }).catch(() => {});
  }, []);

  /* Fetch risk grid GeoJSON for cursor inspector & polygon mode */
  useEffect(() => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/risk-grid?region=${regionKey}`)
      .then(r => {
        setGeojson(r.data);
        const feats = r.data.features || [];
        setCells(feats.map(f => f.properties));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [regionKey]);

  /* GeoJSON style for vector polygon mode */
  const polyStyle = useCallback((feature) => {
    const s = feature.properties.risk_score || 0;
    return {
      fillColor: riskColor(s),
      fillOpacity: 0.65,
      weight: 0.5,
      color: 'rgba(255, 255, 255, 0.25)',
    };
  }, []);

  const onEachFeature = useCallback((feature, layer) => {
    const p = feature.properties;
    layer.bindTooltip(
      `<b>${p.cell_id}</b><br/>PINN Risk: ${(p.risk_score * 100).toFixed(1)}%<br/>FoS: ${p.fos_seismic}<br/>Slope: ${p.slope_mean}°`,
      { sticky: true, className: 'lithos-tooltip' }
    );
  }, []);

  /* Cursor inspector — find nearest slope unit */
  const handleMove = useCallback((latlng) => {
    if (!cells.length) return;
    let best = null, bestDist = Infinity;
    for (const c of cells) {
      const d = Math.abs(c.center_lat - latlng.lat) + Math.abs(c.center_lon - latlng.lng);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    if (best) {
      setCursor({
        lat: latlng.lat.toFixed(4),
        lng: latlng.lng.toFixed(4),
        risk: riskLabel(best.risk_score),
        score: best.risk_score,
      });
    }
  }, [cells]);

  /* Divider drag handlers */
  const startDrag = () => setDragging(true);
  const stopDrag  = () => setDragging(false);
  const onDrag = useCallback((e) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    setSliderPos(Math.max(2, Math.min(98, (x / rect.width) * 100)));
  }, [dragging]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('touchmove', onDrag);
      window.addEventListener('touchend', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchmove', onDrag);
      window.removeEventListener('touchend', stopDrag);
    };
  }, [dragging, onDrag]);

  const curRegion = regions.find(r => r.key === regionKey);
  const center = curRegion ? curRegion.center : [27.55, 88.45];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[#07091a] text-white select-none overflow-hidden">

      {/* Top Header Bar */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-white/5 bg-[#090d24] z-30 shrink-0">
        <div>
          <h1 className="text-base font-black tracking-tight flex items-center gap-2">
            <span>Heatmap View</span>
          </h1>
          <p className="text-[10px] text-white/40">Satellite Image vs PINN Risk Heatmap</p>
        </div>

        {/* View Mode Selector Tabs + Region Dropdown */}
        <div className="flex items-center gap-3">
          {/* Primary Dimension Switcher (3D Mesh vs Cesium 3D Globe vs 2D Curtain) */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs gap-1">
            <button
              onClick={() => setViewDimension('3d')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewDimension === '3d'
                  ? 'bg-accent text-bg shadow-[0_0_15px_rgba(43,158,255,0.5)] font-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Continuous 3D Surface Elevation Mesh with Topographic Contours"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>3D MESH</span>
            </button>
            <button
              onClick={() => setViewDimension('cesium')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewDimension === 'cesium'
                  ? 'bg-gradient-to-r from-cyan-600 via-blue-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Real-life 3D Virtual Globe with Photorealistic Satellite Imagery, 3D Buildings & Live GPS"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D SATELLITE GLOBE</span>
            </button>
            <button
              onClick={() => setViewDimension('2d')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewDimension === '2d'
                  ? 'bg-accent text-white shadow-lg shadow-accent/25'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="2D Split-Screen Satellite Swipe"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>2D SWIPE</span>
            </button>
          </div>

          {/* 2D Sub-Mode Tabs (only shown when 2D is selected) */}
          {viewDimension === '2d' && (
            <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button
                onClick={() => setRenderMode('slope_units')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  renderMode === 'slope_units'
                    ? 'bg-accent text-white shadow-lg shadow-accent/25'
                    : 'text-white/60 hover:text-white'
                }`}
                title="100% Accurate Slope Units Rasterized Without Vector Borders"
              >
                Slope Units
              </button>
              <button
                onClick={() => setRenderMode('smooth')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  renderMode === 'smooth'
                    ? 'bg-accent text-white shadow-lg shadow-accent/25'
                    : 'text-white/60 hover:text-white'
                }`}
                title="Continuous Spatial Gradient Field"
              >
                Smooth Field
              </button>
              <button
                onClick={() => setRenderMode('polygons')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  renderMode === 'polygons'
                    ? 'bg-accent text-white shadow-lg shadow-accent/25'
                    : 'text-white/60 hover:text-white'
                }`}
                title="Individual Vector Slope Polygons with Tooltips"
              >
                Vector Polygons
              </button>
            </div>
          )}

          {/* Region Dropdown */}
          <div className="relative">
            <select
              value={regionKey}
              onChange={e => setRegionKey(e.target.value)}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-white outline-none cursor-pointer pr-7 appearance-none transition-all"
            >
              {regions.map(r => (
                <option key={r.key} value={r.key} className="bg-[#0b102b]">{r.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Display Area: 3D Mesh vs Cesium 3D Globe vs 2D Satellite Swipe */}
      {viewDimension === '3d' ? (
        <div className="relative flex-1 overflow-hidden">
          <Terrain3DHeatmap region={{ key: regionKey, name: curRegion?.name }} />
        </div>
      ) : viewDimension === 'cesium' ? (
        <div className="relative flex-1 overflow-hidden">
          <React.Suspense fallback={
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#07091a] text-white/60 gap-3">
              <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs uppercase tracking-widest text-cyan-300">Loading Cesium 3D Globe & Satellite Imagery...</span>
            </div>
          }>
            <CesiumTerrain3DLazy
              region={curRegion || { key: regionKey, center: center }}
              riskGrid={geojson}
            />
          </React.Suspense>
        </div>
      ) : (
        /* 2D Leaflet Split Map Area */
        <div ref={containerRef} className="relative flex-1 overflow-hidden">

          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#07091a]/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] uppercase tracking-widest text-white/50">Computing PINN Heatmap...</span>
              </div>
            </div>
          )}

          {/* 1. Underlying Base Map Container (Satellite + Heatmap Layer) */}
          <MapContainer
            center={center}
            zoom={11}
            zoomControl={false}
            className="w-full h-full z-0"
            style={{ background: '#07091a' }}
          >
            {/* Satellite Layer */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
            />
            {/* Place Labels Layer */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
            />

            {/* Raster Heatmap Image Overlay (Modes: slope_units or smooth) */}
            {renderMode !== 'polygons' && (
              <HeatmapImageOverlay
                regionKey={regionKey}
                renderMode={renderMode}
                opacity={0.88}
              />
            )}

            {/* Vector Slope Polygons (Mode: polygons) */}
            {renderMode === 'polygons' && geojson && (
              <GeoJSON
                key={`${regionKey}-poly`}
                data={geojson}
                style={polyStyle}
                onEachFeature={onEachFeature}
              />
            )}

            <FlyTo center={center} zoom={11} />
            <Tracker onMove={handleMove} />
          </MapContainer>
        </div>
      )}
    </div>
  );
};

export default HeatmapView;
