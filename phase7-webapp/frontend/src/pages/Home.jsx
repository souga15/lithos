import React, { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
import RiskMap from '../components/RiskMap';
import RainfallWidget from '../components/RainfallWidget';
import AlertBanner from '../components/AlertBanner';
import SatelliteToggle from '../components/SatelliteToggle';
import RiskBadge from '../components/RiskBadge';
import RunoutPanel from '../components/RunoutPanel';
import EarthIntro from '../components/EarthIntro';
import RegionScanner from '../components/RegionScanner';
import { MapPin, Route, AlertTriangle, Globe, Layers, Map } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import API_BASE_URL from '../apiConfig';

import Terrain3DHeatmap from '../components/Terrain3DHeatmap';
import { getCachedRegion } from '../utils/offlineStorage';

const CesiumTerrain3DLazy = React.lazy(() =>
  import('../components/CesiumTerrain3D').catch((err) => {
    console.error('Home Cesium load error:', err);
    return { default: () => (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, background:'#050d1e' }}>
        <p style={{ color:'#FF9500', fontSize:13, fontWeight:900, letterSpacing:'0.15em', fontFamily:'monospace' }}>⚠ 3D TERRAIN UNAVAILABLE</p>
      </div>
    )};
  })
);

const Home = ({ setAlertCount }) => {
  const location = useLocation();
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const bypassIntro = location.state?.bypassIntro || false;
  const [showIntro, setShowIntro] = useState(!bypassIntro);
  const [showScanner, setShowScanner] = useState(bypassIntro);
  const [riskGrid, setRiskGrid] = useState(null);
  const [weather, setWeather] = useState(null);
  const [reports, setReports] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [mapMode, setMapMode] = useState('3d-cesium'); // Default: 3D Heatmap on home screen
  const [layerType, setLayerType] = useState('street');
  const [selectedCell, setSelectedCell] = useState(null);
  const [activeRunout, setActiveRunout] = useState(null);
  const [globalRunouts, setGlobalRunouts] = useState([]);
  const [showOverlays, setShowOverlays] = useState({
    grid: true,
    reports: true
  });
  const [downloadProgress, setDownloadProgress] = useState(null);

  useEffect(() => {
    fetchRegions();
    setupWebSocket();
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      fetchRiskGrid(selectedRegion.key);
      fetchWeather(selectedRegion.key);
      fetchReports();
      fetchGlobalRunouts(selectedRegion.key);
    }
  }, [selectedRegion]);

  useEffect(() => {
    console.log("Selected Cell:", selectedCell);
    if (selectedCell && (selectedCell.fos_seismic < 1.0 || selectedCell.risk_level === 'RED')) {
      fetchRunout(selectedCell.cell_id);
    } else {
      setActiveRunout(null);
    }
  }, [selectedCell]);

  const fetchRegions = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/regions`);
      setRegions(resp.data.regions);
      
      if (bypassIntro) {
        let defaultRegion = resp.data.regions[0];
        if (location.state?.regionKey) {
            defaultRegion = resp.data.regions.find(r => r.key === location.state.regionKey) || defaultRegion;
        }
        setSelectedRegion(defaultRegion);
      }
    } catch (err) { console.error(err); }
  };

  const handleIntroSelect = (region) => {
    setSelectedRegion(region);
    setMapMode('3d-cesium');
    setShowIntro(false);
    setShowScanner(true); // trigger scan animation
  };

  const handleScanDone = () => {
    setShowScanner(false);
  };

  const fetchRiskGrid = async (key) => {
    try {
      // 1. Check Offline Cache First (Instant Load)
      const cached = await getCachedRegion(key);
      if (cached) {
        setRiskGrid(cached);
        return;
      }
      
      // 2. Download and Cache with Progress Bar
      setDownloadProgress(1); // Start progress UI
      const success = await downloadAndCacheRegion(key, (p) => {
        setDownloadProgress(p);
      });
      
      if (success) {
        const newlyCached = await getCachedRegion(key);
        setRiskGrid(newlyCached);
      }
      setDownloadProgress(null);
    } catch (err) { 
      console.error(err); 
      setDownloadProgress(null);
    }
  };

  const fetchWeather = async (key) => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/weather/live?region=${key}`);
      setWeather(resp.data);
    } catch (err) { console.error(err); }
  };

  const fetchReports = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/reports/history`);
      setReports(resp.data.reports);
    } catch (err) { console.error(err); }
  };

  const fetchRunout = async (cellId) => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/runout/${cellId}`);
      setActiveRunout(resp.data);
    } catch (err) {
      console.error("Runout fetch failed", err);
      setActiveRunout(null);
    }
  };

  const fetchGlobalRunouts = async (regionKey) => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/active-runouts?region=${regionKey}`);
      setGlobalRunouts(resp.data);
    } catch (err) {
      console.error("Global runout fetch failed", err);
      setGlobalRunouts([]);
    }
  };

  const setupWebSocket = () => {
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/alerts`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'connected' || data.type === 'sensor_alert') return;
      setActiveAlert(data);
      setAlertCount(prev => prev + 1);
    };
    return () => ws.close();
  };

  // Show intro while regions haven't loaded yet OR user hasn't dismissed it
  if (showIntro) {
    return (
      <EarthIntro
        regions={regions}
        onSelect={handleIntroSelect}
      />
    );
  }

  if (!selectedRegion) return <div className="h-full flex items-center justify-center text-accent font-black animate-pulse uppercase tracking-widest">Initialising LITHOS Core...</div>;

  return (
    <div className="absolute inset-0 group">
      {/* Downloading Overlay for new regions */}
      {downloadProgress !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-bg/60">
          <div className="glass px-8 py-6 rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
            <div className="text-accent font-black tracking-widest text-sm animate-pulse">
              DOWNLOADING REGION DATA
            </div>
            <div className="w-48 bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-accent h-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <div className="text-[10px] text-white/50 font-mono">{downloadProgress}%</div>
          </div>
        </div>
      )}

      {/* Scanner overlay — plays on top of map during initial load */}
      {showScanner && (
        <RegionScanner region={selectedRegion} onDone={handleScanDone} />
      )}

      {/* Map Background — loads under scanner, revealed when scanner ends */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: showScanner ? 0 : 1,
        transition: 'opacity 0.6s ease',
      }}>
      {/* Map Background */}
      {mapMode === '3d-cesium' ? (
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-[#050d1e]">
            <p className="text-accent font-black animate-pulse uppercase tracking-widest text-sm">Loading 3D Terrain Heatmap…</p>
          </div>
        }>
          <CesiumTerrain3DLazy
            region={selectedRegion}
            riskGrid={riskGrid}
            routeResult={null}
            carPosition={null}
            start={null}
            end={null}
            isNavigating={false}
            nearbyHazards={[]}
            liveUsers={[]}
            showEvacuation={false}
          />
        </Suspense>
      ) : mapMode === '3d-mesh' ? (
        <Terrain3DHeatmap region={selectedRegion} />
      ) : (
        <RiskMap
          region={selectedRegion}
          riskData={riskGrid}
          reports={reports}
          onCellClick={setSelectedCell}
          activeRunout={activeRunout}
          globalRunouts={globalRunouts}
          layerType={layerType}
          showGrid={showOverlays.grid}
          showReports={showOverlays.reports}
          onMapClick={() => setSelectedCell(null)}
        />
      )}

      {/* Top Controls Overlay (Region Selector & 2D/3D Mode Switcher) */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-10">
        <div className="glass px-4 py-2 rounded-xl pointer-events-auto flex items-center gap-3 border-accent/20">
          <MapPin className="w-5 h-5 text-accent" />
          <select 
            className="bg-transparent border-none outline-none font-black text-sm uppercase tracking-tight text-white cursor-pointer"
            value={selectedRegion.key}
            onChange={(e) => setSelectedRegion(regions.find(r => r.key === e.target.value))}
          >
            {regions.map(r => <option key={r.key} value={r.key} className="bg-bg text-white">{r.name}</option>)}
          </select>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* Mode Switcher Group */}
          <div className="glass p-1 rounded-2xl flex items-center gap-1 border border-white/10 shadow-2xl backdrop-blur-xl">
            <button
              onClick={() => setMapMode('2d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mapMode === '2d'
                  ? 'bg-accent text-bg shadow-[0_0_15px_rgba(43,158,255,0.6)] font-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>2D MAP</span>
            </button>

            <button
              onClick={() => setMapMode('3d-cesium')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                mapMode === '3d-cesium'
                  ? 'bg-accent text-bg shadow-[0_0_15px_rgba(43,158,255,0.6)] font-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D PINN HEATMAP</span>
            </button>

          </div>

          {mapMode === '2d' && <SatelliteToggle active={layerType} onChange={setLayerType} />}
        </div>
      </div>

      {/* Left Panel Overlay (Shown in 2D mode) */}
      {mapMode === '2d' && (
        <div className="absolute top-20 left-4 w-72 pointer-events-none z-10 space-y-4">
          <div className="pointer-events-auto">
            <RainfallWidget weather={weather} regionName={selectedRegion.name} />
          </div>

          <div className="glass p-4 rounded-xl pointer-events-auto border-l-2 border-accent shadow-glow-sm">
            <h3 className="text-[10px] font-black tracking-widest text-white/40 uppercase mb-3">RISK DISTRIBUTION</h3>
            <div className="space-y-2">
              {[
                { label: 'RED', count: selectedRegion.red_count, color: 'risk-red' },
                { label: 'ORANGE', count: selectedRegion.orange_count, color: 'risk-orange' },
                { label: 'GREEN', count: selectedRegion.green_count, color: 'risk-green' }
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${item.color}`} />
                    <span className="text-[10px] font-bold opacity-80">{item.label}</span>
                  </div>
                  <span className="text-xs font-black font-mono">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cell Detail Modal (Conditional) */}
      {selectedCell && (
        <div className="absolute inset-0 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm bg-bg/20">
          <div className="bg-[#0c101c] border border-white/10 max-w-sm w-full p-5 rounded-2xl relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setSelectedCell(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-semibold text-white/90">Cell {selectedCell.cell_id}</h2>
                  <span className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono text-white/60 tracking-wider">PINN AI</span>
                </div>
                <p className="text-[10px] text-white/40 font-mono tracking-wider">{selectedCell.center_lat}, {selectedCell.center_lon}</p>
              </div>
              <RiskBadge level={selectedCell.risk_level} score={selectedCell.risk_score} />
            </div>

            {/* Warning for high risk cells */}
            {selectedCell.fos_seismic < 1.0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-[10px] font-semibold text-red-300 font-mono tracking-wider">
                  FoS {selectedCell.fos_seismic.toFixed(2)} — VERY HIGH RISK AREA
                </p>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Top Risk Factor</p>
                <p className="text-xs font-semibold text-white/90 uppercase">{selectedCell.top_risk_factor.replace('_',' ')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Slope',    val: selectedCell.slope_mean + '°' },
                  { label: 'Elevation', val: selectedCell.elevation_mean + 'm' },
                  { label: 'Rain (24h)', val: selectedCell.rainfall_24h + 'mm' },
                  { label: 'Soil Moisture', val: Math.round(selectedCell.soil_moisture * 100) + '%' }
                ].map(stat => (
                  <div key={stat.label} className="bg-white/[0.02] p-2 rounded-lg border border-white/5">
                    <p className="text-[8px] font-mono text-white/30 uppercase">{stat.label}</p>
                    <p className="text-xs font-medium text-white/80 font-mono">{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Runout analysis — only for high risk slopes */}
            {(selectedCell.fos_seismic < 1.0 || selectedCell.risk_level === 'RED') && (
              <RunoutPanel runoutData={activeRunout} cell={selectedCell} />
            )}

            <button className="w-full mt-4 bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2">
              <Route className="w-4 h-4 text-white/60" />
              Get Safe Route From Here
            </button>
          </div>
        </div>
      )}
      </div>{/* end map-content wrapper */}
    </div>
  );
};

export default Home;
