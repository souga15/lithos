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
import { MapPin, Route, AlertTriangle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import API_BASE_URL from '../apiConfig';

// 3D terrain — loaded lazily to avoid crashing if Cesium not built yet
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
  const [layerType, setLayerType] = useState('street');
  const [mapMode, setMapMode] = useState('2d'); // '2d' | '3d'
  const [selectedCell, setSelectedCell] = useState(null);
  const [activeRunout, setActiveRunout] = useState(null);
  const [globalRunouts, setGlobalRunouts] = useState([]);
  const [showOverlays, setShowOverlays] = useState({
    grid: true,
    reports: true
  });

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
    setShowIntro(false);
    setShowScanner(true); // trigger scan animation
  };

  const handleScanDone = () => {
    setShowScanner(false);
  };

  const fetchRiskGrid = async (key) => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/risk-grid?region=${key}`);
      setRiskGrid(resp.data);
    } catch (err) { console.error(err); }
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
      if (data.type === 'connected') return;
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
      {mapMode === '3d' ? (
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-[#050d1e]">
            <p className="text-accent font-black animate-pulse uppercase tracking-widest text-sm">Loading 3D Terrain…</p>
          </div>
        }>
          <CesiumTerrain3DLazy
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

      {/* Top Controls Overlay */}
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
          {/* 2D / 3D toggle */}
          <button
            onClick={() => setMapMode(mapMode === '3d' ? '2d' : '3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-all ${
              mapMode === '3d'
                ? 'bg-accent text-bg border-accent shadow-glow'
                : 'bg-black/40 text-white/60 border-white/20 hover:border-white/40 hover:text-white'
            }`}
          >
            <span>{mapMode === '3d' ? '🌐 3D' : '🗺 2D'}</span>
          </button>
          {mapMode === '2d' && <SatelliteToggle active={layerType} onChange={setLayerType} />}
        </div>
      </div>

      {/* Left Panel Overlay */}
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

      {/* Cell Detail Modal (Conditional) */}
      {selectedCell && (
        <div className="absolute inset-0 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm bg-bg/20">
          <div className="glass max-w-sm w-full p-6 rounded-3xl relative border-accent/30 shadow-glow overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setSelectedCell(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-black italic tracking-tighter">CELL {selectedCell.cell_id}</h2>
                <p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">{selectedCell.center_lat}, {selectedCell.center_lon}</p>
              </div>
              <RiskBadge level={selectedCell.risk_level} score={selectedCell.risk_score} />
            </div>

            {/* FoS Warning for failing cells */}
            {selectedCell.fos_seismic < 1.0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-risk-red/10 border border-risk-red/40 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-risk-red shrink-0" />
                <p className="text-[10px] font-black text-risk-red uppercase tracking-widest">
                  FoS {selectedCell.fos_seismic.toFixed(2)} — SLOPE FAILURE IMMINENT
                </p>
              </div>
            )}

            <div className="space-y-2 mb-6">
              <div className="p-3 bg-white/5 rounded-xl border border-accent/10">
                <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">Top Risk Factor</p>
                <p className="text-sm font-bold uppercase">{selectedCell.top_risk_factor.replace('_',' ')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Slope',    val: selectedCell.slope_mean + '°' },
                  { label: 'Elev',     val: selectedCell.elevation_mean + 'm' },
                  { label: 'Rain 24h', val: selectedCell.rainfall_24h + 'mm' },
                  { label: 'Moisture', val: Math.round(selectedCell.soil_moisture * 100) + '%' }
                ].map(stat => (
                  <div key={stat.label} className="bg-white/3 p-2 rounded-lg border border-white/5">
                    <p className="text-[8px] font-black opacity-30 uppercase">{stat.label}</p>
                    <p className="text-xs font-bold font-mono">{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Runout analysis — only for failing slopes */}
            {(selectedCell.fos_seismic < 1.0 || selectedCell.risk_level === 'RED') && (
              <RunoutPanel runoutData={activeRunout} cell={selectedCell} />
            )}

            <button className="w-full mt-4 bg-accent text-bg font-black py-3 rounded-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
              <Route className="w-5 h-5" />
              GET SAFE ROUTE FROM HERE
            </button>
          </div>
        </div>
      )}

      {/* Alert Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-nav/95 border-t border-white/10 backdrop-blur-md z-30 transition-transform group-hover:translate-y-0 translate-y-full hover:translate-y-0">
        <AlertBanner alert={activeAlert} />
      </div>
      </div>{/* end map-content wrapper */}
    </div>
  );
};

export default Home;
