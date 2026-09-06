import React, { useState, useEffect, Suspense } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents, GeoJSON } from 'react-leaflet';
import { Route as RouteIcon, AlertTriangle, Search, Navigation, Map as MapIcon, Layers, Globe } from 'lucide-react';
import L from 'leaflet';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import RiskMap from '../components/RiskMap';
import RiskBadge from '../components/RiskBadge';
import SOSButton from '../components/SOSButton';
import BlockageReport from '../components/BlockageReport';
import RainfallClock from '../components/RainfallClock';

// CesiumTerrain3D loaded lazily so 2D map still works if cesium pkg not yet installed
const CesiumTerrain3DLazy = React.lazy(() =>
  import('../components/CesiumTerrain3D').catch((err) => {
    console.error("LITHOS Cesium Load Error:", err);
    return {
      default: () => (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
          height:'100%', flexDirection:'column', gap:12, background:'#050d1e' }}>
        <p style={{ color:'#FF9500', fontSize:13, fontWeight:900, letterSpacing:'0.15em', fontFamily:'monospace' }}>
          ⚠ 3D TERRAIN UNAVAILABLE
        </p>
        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:700, textAlign:'center', maxWidth:320 }}>
          Run this in the frontend folder:<br/>
          <code style={{ color:'#00C2FF' }}>npm install resium cesium vite-plugin-cesium --legacy-peer-deps</code>
        </p>
      </div>
    )
    };
  })
);

const SafeRoute = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [riskGrid, setRiskGrid] = useState(null);

  // Live Navigation Data State
  const [weather, setWeather] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const [latestReport, setLatestReport] = useState(null);

  // Geocoding State
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [focusPoint, setFocusPoint] = useState(null);

  // Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const [carPosition, setCarPosition] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const prevRisk = React.useRef('GREEN');
  const lastProximityCheck = React.useRef({ lat: 0, lng: 0, time: 0 });
  const lastAlertedHazard = React.useRef(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [mapStyle, setMapStyle]       = useState(() => localStorage.getItem('lithos_mapstyle') || 'street');
  const [nearbyHazards, setNearbyHazards] = useState([]);
  const [liveUsers,    setLiveUsers]   = useState([]);
  const [showEvacuation, setShowEvacuation] = useState(false);
  const sessionId = React.useRef(`lithos_${Math.random().toString(36).slice(2)}`);


  // Screen Wake Lock Reference
  const wakeLockRef = React.useRef(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) { console.log('Wake lock failed', err); }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Voice Synthesis Helper
  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    fetchRegions();
    try {
      const cached = localStorage.getItem('active_route_full');
      if (cached) {
        const parsed = JSON.parse(cached);
        setRouteResult(parsed);
      }
    } catch (e) { console.error("Cache load failed", e); }

    // Always clear the speech queue when this page loads or unloads
    window.speechSynthesis.cancel();
    return () => window.speechSynthesis.cancel();
  }, []);

  // Reset map state only when the region changes
  useEffect(() => {
    if (selectedRegion && regions.length > 0) {
      fetchRiskGrid(regions);
      setStart(null);
      setEnd(null);
      setRouteResult(null);
      setStartQuery('');
      setEndQuery('');
      setIsNavigating(false);
      setCarPosition(null);
      setShowCertificate(false);
    }
  }, [selectedRegion?.key, regions]); // intentionally not observing isOffline to prevent reset on reconnection

  // Fetch weather separately when region changes or connection returns
  useEffect(() => {
    if (selectedRegion && !isOffline) {
      fetchLiveWeather(selectedRegion.key);
    }
  }, [selectedRegion, isOffline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (navigator.geolocation && !isNavigating) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            console.log("Network restored. Current GPS location:", loc);
            // Only sync start point if we aren't already navigating a route!
            setStart(prev => prev || loc);
            setStartQuery(prev => prev || 'Current GPS Location');
            if (isNavigating) speak("Network restored. Connection active.");
          },
          (err) => console.log("GPS Error:", err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Requests hybrid GPS + Cell Tower / Wi-Fi
        );
      } else {
        if (isNavigating) speak("Network restored. Live alerts resumed.");
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      if (isNavigating) speak("Connection lost. Operating in offline mode.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isNavigating]);

  useEffect(() => {
    // Setup Websockets for live driving mode updates only when online
    if (!isOffline) {
      const wsBase = API_BASE_URL.replace('http', 'ws');
      const wsAlerts = new WebSocket(`${wsBase}/ws/alerts`);
      wsAlerts.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type !== 'connected') setActiveAlert(data);
      };

      const wsReports = new WebSocket(`${wsBase}/ws/reports`);
      wsReports.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type !== 'connected') {
          setLatestReport(data);
          
          // Voice alerts temporarily disabled by user request
          // if (isNavigating) {
          //   speak(`Community alert — ${(data.report_type || 'hazard').replace(/_/g, ' ')} reported ahead.`);
          // }
          
          // Automatically hide report popup after 10 seconds
          setTimeout(() => setLatestReport(null), 10000);
        }
      };

      return () => {
        wsAlerts.close();
        wsReports.close();
      };
    }
  }, [isOffline, isNavigating]);

  // ── Live user positions: subscribe + broadcast ────────────────────────────
  useEffect(() => {
    if (isOffline) return;
    const wsBase = API_BASE_URL.replace('http', 'ws');
    let ws;
    try {
      ws = new WebSocket(`${wsBase}/ws/users`);
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.type === 'positions') setLiveUsers(d.users || []);
      };
    } catch (_) {}
    return () => ws?.close();
  }, [isOffline]);

  // Broadcast own position every 5s during navigation
  useEffect(() => {
    if (!isNavigating || !carPosition || isOffline) return;
    const id = setInterval(() => {
      axios.post(`${API_BASE_URL}/api/users/position`, {
        session_id: sessionId.current,
        lat:  carPosition.lat,
        lon:  carPosition.lng,
        risk: carPosition.risk || 'GREEN',
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [isNavigating, carPosition, isOffline]);


  const fetchLiveWeather = async (key) => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/weather/live?region=${key}`);
      setWeather(resp.data);
      try {
        localStorage.setItem(`weather_cache_${key}`, JSON.stringify(resp.data));
      } catch (e) {
        console.warn('LocalStorage quota exceeded for weather');
      }
    } catch (err) {
      const cached = localStorage.getItem(`weather_cache_${key}`);
      if (cached) setWeather(JSON.parse(cached));
    }
  };

  const fetchRegions = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/regions`);
      setRegions(resp.data.regions);
      setSelectedRegion(resp.data.regions[0]);
      try {
        localStorage.setItem('regions_cache', JSON.stringify(resp.data.regions));
      } catch (e) {
        console.warn('LocalStorage quota exceeded for regions');
      }
    } catch (err) {
      const cached = localStorage.getItem('regions_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setRegions(parsed);
        setSelectedRegion(parsed[0]);
      }
    }
  };

  const fetchRiskGrid = async (allRegions) => {
    try {
      if (!allRegions || allRegions.length === 0) return;

      // ── Phase 1: Load selected region immediately so map is usable right away
      const primaryRegion = selectedRegion || allRegions[0];
      try {
        const resp = await axios.get(`${API_BASE_URL}/api/risk-grid?region=${primaryRegion.key}`);
        if (resp.data.features) {
          setRiskGrid({
            type: 'FeatureCollection',
            features: resp.data.features,
          });
        }
      } catch (e) {
        const cached = localStorage.getItem('grid_cache_global');
        if (cached) setRiskGrid(JSON.parse(cached));
      }

      // ── Phase 2: Fetch all other regions in parallel in the background
      const remainingRegions = allRegions.filter(r => r.key !== primaryRegion.key);
      if (remainingRegions.length === 0) return;

      const results = await Promise.allSettled(
        remainingRegions.map(reg =>
          axios.get(`${API_BASE_URL}/api/risk-grid?region=${reg.key}`)
            .then(r => r.data.features || [])
            .catch(() => [])
        )
      );

      const extraFeatures = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      if (extraFeatures.length === 0) return;

      setRiskGrid(prev => {
        const combined = {
          type: 'FeatureCollection',
          features: [...(prev?.features || []), ...extraFeatures],
        };
        try {
          localStorage.setItem('grid_cache_global', JSON.stringify(combined));
        } catch (e) {
          console.warn('LocalStorage quota exceeded for grid_cache_global');
        }
        return combined;
      });

    } catch (err) {
      const cached = localStorage.getItem('grid_cache_global');
      if (cached) setRiskGrid(JSON.parse(cached));
    }
  };

  const calculateRoute = async () => {
    if (!start || !end || !selectedRegion) return;
    setLoading(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/api/route`, {
        start_lat: start.lat,
        start_lon: start.lng,
        end_lat: end.lat,
        end_lon: end.lng,
        region: selectedRegion.key // Passed for legacy UI state logging, but backend now uses global coords
      });
      setRouteResult(resp.data);
      try {
        localStorage.setItem('active_route_full', JSON.stringify(resp.data));
      } catch (e) {
        console.warn('LocalStorage quota exceeded for active_route_full');
      }
    } catch (err) {
      console.error(err);
      alert('Error calculating route. Please ensure points are within the selected region.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query, setPointFunc, setQueryFunc) => {
    if (!query) return;
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
      if (res.data && res.data.length > 0) {
        const { lat, lon, display_name } = res.data[0];
        const newPoint = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setPointFunc(newPoint);
        setQueryFunc(display_name.split(',')[0]);
        setFocusPoint(newPoint);
      } else {
        alert("Location not found");
      }
    } catch (err) {
      console.error("Geocoding error", err);
    }
  };

  const getClosestSegmentIndex = (lat, lng, segments) => {
    let minDistance = Infinity;
    let closestIndex = 0;
    const currentPoint = L.latLng(lat, lng);
    segments.forEach((seg, i) => {
      const dist = currentPoint.distanceTo(L.latLng(seg.lat, seg.lon));
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    });
    return { index: closestIndex, distance: minDistance };
  };

  useEffect(() => {
    let watchId;
    if (isNavigating && routeResult && routeResult.route.segments.length > 0) {
      speak("Starting live navigation. Please ensure your map area is loaded before entering offline regions.");
      requestWakeLock();

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const { index, distance } = getClosestSegmentIndex(latitude, longitude, routeResult.route.segments);

          if (distance > 150) {
            if (!isOffRoute) {
              setIsOffRoute(true);
              speak("You are off route. Please return to the safe path.");
            }
          } else {
            setIsOffRoute(false);
          }

          setNavIndex(index);
          const currentSeg = routeResult.route.segments[index];
          setCarPosition({ lat: latitude, lng: longitude, risk: currentSeg ? currentSeg.risk_level : 'GREEN' });

          if (index >= routeResult.route.segments.length - 1 && distance < 50) {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            setIsNavigating(false);
            setShowCertificate(true);
            speak("You have reached your destination securely.");
          }
        },
        (err) => {
          console.error("GPS Tracking Error:", err);
          speak("GPS signal lost. Attempting to track network position.");
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    } else {
      releaseWakeLock();
    }
    return () => {
      releaseWakeLock();
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isNavigating, routeResult]);

  // Proximity Alerts for critical slopes
  useEffect(() => {
    if (!isNavigating || !carPosition) return;
    if (isOffline) { setNearbyHazards([]); return; }

    const now = Date.now();
    const distSinceLast = L.latLng(carPosition.lat, carPosition.lng).distanceTo(L.latLng(lastProximityCheck.current.lat, lastProximityCheck.current.lng));

    // Check every 500m or every 30 seconds
    if (distSinceLast > 500 || (now - lastProximityCheck.current.time) > 30000) {
      lastProximityCheck.current = { lat: carPosition.lat, lng: carPosition.lng, time: now };

      axios.get(`${API_BASE_URL}/api/proximity-alerts?lat=${carPosition.lat}&lon=${carPosition.lng}&radius=6`)
        .then(res => {
          const hazards = res.data.hazards || [];
          // Store top 3 hazards in state for visual display
          setNearbyHazards(hazards.slice(0, 3));

          if (hazards.length > 0) {
            const topHazard = hazards[0];
            if (topHazard.distance_km >= 2 && topHazard.distance_km <= 6) {
              if (lastAlertedHazard.current !== topHazard.cell_id) {
                speak(`Caution: Critical slope detected ${topHazard.distance_km} kilometers to your ${topHazard.direction}.`);
                lastAlertedHazard.current = topHazard.cell_id;
              }
            }
          } else {
            lastAlertedHazard.current = null;
          }
        })
        .catch(err => console.error("Proximity check failed", err));
    }
  }, [carPosition, isNavigating, isOffline]);

  useEffect(() => {
    if (isNavigating && routeResult && routeResult.route.segments[navIndex]) {
      const seg = routeResult.route.segments[navIndex];

      // Voice Alerts for Risk Transfer
      if (seg.risk_level !== prevRisk.current) {
        if (seg.risk_level === 'RED') {
          speak("Warning — entering high risk landslide zone. Consider alternative route.");
        } else if (seg.risk_level === 'GREEN' && prevRisk.current === 'RED') {
          speak("Leaving danger zone — route is now safe.");
        }
        prevRisk.current = seg.risk_level;
      }
    }
  }, [navIndex, isNavigating, routeResult]);

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (!start) {
          setStart(e.latlng);
          setStartQuery(`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
        } else if (!end) {
          setEnd(e.latlng);
          setEndQuery(`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
        }
      },
    });
    return null;
  };

  const MapUpdater = () => {
    const map = useMapEvents({});
    useEffect(() => {
      if (isNavigating && carPosition) {
        map.panTo([carPosition.lat, carPosition.lng], { animate: true, duration: 0.8 });
      } else if (!isNavigating && routeResult) {
        // Fit bounds to route
        const bounds = routeResult.route.segments.map(s => [s.lat, s.lon]);
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
      } else if (focusPoint) {
        map.flyTo([focusPoint.lat, focusPoint.lng], 14, { animate: true, duration: 1 });
        setFocusPoint(null);
      }
    }, [carPosition, isNavigating, routeResult, focusPoint, map]);
    return null;
  };

  return (
    <div className="absolute inset-0 flex flex-col lg:flex-row animate-fade-in overflow-hidden">
      {/* Sidebar Panel - Hidden during Navigation */}
      {!isNavigating && (
        <div className="w-full lg:w-[400px] h-[40%] lg:h-full glass border-r border-white/10 z-20 flex flex-col p-6 overflow-y-auto shrink-0 transition-all duration-500">
          {/* ... existing sidebar content ... */}
          <h1 className="text-xl font-black italic tracking-tighter mb-1 uppercase flex items-center gap-2">
            <RouteIcon className="w-6 h-6 text-accent" /> Safe Route Finder
          </h1>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">AI-Powered Risk Avoidance</p>

          {/* Rainfall Monitor */}
          {selectedRegion && <RainfallClock region={selectedRegion.key} />}

          <div className="space-y-4 flex-grow">
            <div>
              <label className="text-[10px] font-black text-accent uppercase tracking-widest mb-1.5 block">SELECT REGION</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold appearance-none outline-none focus:border-accent transition-all"
                value={selectedRegion?.key}
                onChange={(e) => setSelectedRegion(regions.find(r => r.key === e.target.value))}
              >
                {regions.map(r => <option key={r.key} value={r.key} className="bg-bg">{r.name}</option>)}
              </select>
            </div>

            {/* ── Map Style Toggle ─────────────────────────── */}
            <div>
              <label className="text-[10px] font-black text-accent uppercase tracking-widest mb-1.5 block">MAP VIEW</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'dark',   label: '2D Dark',    icon: '🗺' },
                  { id: 'street', label: '2D Street',  icon: '🛣' },
                  { id: '3d',     label: '3D Terrain', icon: '🌐' },
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setMapStyle(mode.id);
                      localStorage.setItem('lithos_mapstyle', mode.id);
                    }}
                    className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex flex-col items-center gap-0.5 ${
                      mapStyle === mode.id
                        ? 'bg-accent text-bg border-accent shadow-glow scale-[1.04]'
                        : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <span className="text-base">{mode.icon}</span>
                    <span className="leading-none">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-xl border transition-all ${start ? 'bg-[#FFD60A]/10 border-[#FFD60A]/30' : 'bg-white/3 border-white/10'}`}>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[8px] font-black uppercase opacity-60">POINT A (START)</p>
                  {!start && <span className="text-[8px] font-bold text-[#FFD60A] animate-pulse">Click map to drop pin</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={startQuery}
                    onChange={e => setStartQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch(startQuery, setStart, setStartQuery)}
                    placeholder={start ? `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}` : "Enter location or click map"}
                    className="w-full bg-transparent outline-none text-[10px] font-bold"
                    disabled={loading}
                  />
                  <button onClick={() => handleSearch(startQuery, setStart, setStartQuery)} disabled={loading} className="opacity-50 hover:opacity-100"><Search className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className={`p-3 rounded-xl border transition-all ${end ? 'bg-risk-red/10 border-risk-red/30' : 'bg-white/3 border-white/10'}`}>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[8px] font-black uppercase opacity-60">POINT B (END)</p>
                  {start && !end && <span className="text-[8px] font-bold text-risk-red animate-pulse">Click map to drop pin</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={endQuery}
                    onChange={e => setEndQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch(endQuery, setEnd, setEndQuery)}
                    placeholder={end ? `${end.lat.toFixed(4)}, ${end.lng.toFixed(4)}` : "Enter destination or click map"}
                    className="w-full bg-transparent outline-none text-[10px] font-bold"
                    disabled={loading}
                  />
                  <button onClick={() => handleSearch(endQuery, setEnd, setEndQuery)} disabled={loading} className="opacity-50 hover:opacity-100"><Search className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>

            <button
              onClick={calculateRoute}
              disabled={!start || !end || loading}
              className={`w-full py-4 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${!start || !end ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-accent text-bg hover:scale-[1.02] shadow-glow'
                }`}
            >
              {loading ? <span className="animate-spin text-xl">🌀</span> : 'CALCULATE SAFE ROUTE'}
            </button>

            {routeResult && (
              <div className="space-y-4 animate-fade-in pt-4 border-t border-white/10">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-black">{routeResult.route.distance_km} <span className="text-[10px] opacity-50 uppercase">km</span></h3>
                      <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Calculated Distance</p>
                    </div>
                    <RiskBadge level={routeResult.route.max_risk_level} score={routeResult.route.safe_score} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black mb-1">
                      <span className="opacity-40 uppercase">Safe segments</span>
                      <span className="text-risk-green">
                        {Math.round((routeResult.route.risk_summary.GREEN / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN)) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 flex rounded-full overflow-hidden bg-white/5">
                      <div className="h-full bg-risk-green" style={{ width: `${(routeResult.route.risk_summary.GREEN / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN)) * 100}%` }} />
                      <div className="h-full bg-risk-orange" style={{ width: `${(routeResult.route.risk_summary.ORANGE / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN)) * 100}%` }} />
                      <div className="h-full bg-risk-red" style={{ width: `${(routeResult.route.risk_summary.RED / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN)) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {routeResult.warnings.length > 0 && (
                  <div className="bg-risk-red/10 border border-risk-red/30 p-3 rounded-xl space-y-2">
                    {routeResult.warnings.map((w, i) => (
                      <p key={i} className="text-[10px] font-bold text-risk-red flex items-start gap-2 italic">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                      </p>
                    ))}
                  </div>
                )}

                {routeResult.runout_warnings && routeResult.runout_warnings.length > 0 && (
                  <div className="bg-risk-red/20 border-2 border-risk-red p-3 rounded-xl animate-pulse">
                    <p className="text-[10px] font-black text-risk-red uppercase tracking-widest mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Active Runout Zones Detected
                    </p>
                    <div className="space-y-2">
                      {routeResult.runout_warnings.map((rw, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] font-bold text-white/90 bg-black/20 p-2 rounded-lg">
                          <span>{rw.km_marker}: {rw.cell_id}</span>
                          <span className="text-risk-red uppercase text-[8px] bg-white/10 px-1.5 py-0.5 rounded">Hazard</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] font-medium text-risk-red/80 mt-2 italic">
                      Road segments may be blocked by active debris flow at these markers.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase text-white/30 tracking-widest">Alternative Routes</h3>
                  {routeResult.alternative_routes.map((alt, i) => (
                    <div key={i} className="bg-white/3 border border-white/5 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-black">{alt.distance_km} km</p>
                          <p className="text-[9px] font-bold text-white/40">+{alt.extra_time_min} MIN DETOUR</p>
                        </div>
                        <RiskBadge level={alt.max_risk_level} className="scale-75 origin-right" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsNavigating(true);
                      setNavIndex(0);
                      setCarPosition({ lat: start.lat, lng: start.lng });
                      try {
                        localStorage.setItem('active_route', JSON.stringify(routeResult.route.segments));
                        localStorage.setItem('cached_risk_grid', JSON.stringify(riskGrid));
                        localStorage.setItem('cache_timestamp', new Date().toISOString());
                      } catch (e) {
                        console.warn('LocalStorage quota exceeded during navigation start');
                      }
                    }}
                    className="w-full py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 bg-accent text-bg shadow-glow hover:scale-[1.02]"
                  >
                    <Navigation className="w-4 h-4" /> START LIVE NAVIGATION
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { setStart(null); setEnd(null); setRouteResult(null); setStartQuery(''); setEndQuery(''); setIsNavigating(false); setCarPosition(null); }}
            className="mt-6 text-[10px] font-black text-white/30 hover:text-white uppercase tracking-widest block text-center"
          >
            Reset points
          </button>
        </div>
      )}

      {/* Map View */}
      <div className="flex-grow h-full relative w-full transition-all duration-500">
        <div className="absolute inset-0">
          {mapStyle === '3d' ? (
            /* ── 3D CesiumJS Terrain View ── */
            <Suspense fallback={
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', background:'#050d1e', color:'#00C2FF', flexDirection:'column', gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', border:'2px solid rgba(0,194,255,0.2)', borderTopColor:'#00C2FF', animation:'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' }}>Loading 3D Terrain…</p>
              </div>
            }>
              <CesiumTerrain3DLazy
              riskGrid={riskGrid}
              routeResult={routeResult}
              carPosition={carPosition}
              start={start}
              end={end}
              isNavigating={isNavigating}
              nearbyHazards={nearbyHazards}
              liveUsers={liveUsers}
              showEvacuation={showEvacuation}
              satellite={false}
            />
            </Suspense>
          ) : (
            /* ── 2D Leaflet View (unchanged) ── */
            <MapContainer
            center={selectedRegion?.center || [25.3, 91.73]}
            zoom={12}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer
              url={mapStyle === 'dark'
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              }
            />
            <MapEvents />

            {/* Locate Me Native Control */}
            <div className="absolute top-16 right-4 z-[1000]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setStart(prev => prev || loc);
                        setStartQuery(prev => prev || 'Current GPS Location');
                        if (isNavigating) setCarPosition(loc);
                        setFocusPoint(loc);
                        speak("Location verified.");
                      },
                      (err) => console.error("Locate error", err),
                      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                  }
                }}
                className="glass p-2.5 rounded-full flex items-center justify-center gap-1 border border-[#00C2FF]/30 shadow-lg backdrop-blur-md text-[#00C2FF] hover:bg-[#00C2FF]/10 transition-all bg-[#00C2FF]/5"
                title="Locate Me"
              >
                <Navigation className="w-4 h-4" />
              </button>
            </div>

            {/* Map Style Toggle */}
            <div className="absolute top-4 right-4 z-[1000]">
              <div className="glass p-1.5 rounded-full flex gap-1 border border-white/10 shadow-lg backdrop-blur-md">
                <button
                  onClick={(e) => { e.stopPropagation(); const s = 'dark'; setMapStyle(s); localStorage.setItem('lithos_mapstyle', s); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${mapStyle === 'dark' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'}`}
                >
                  <MapIcon className="w-3.5 h-3.5" /> Dark
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); const s = 'street'; setMapStyle(s); localStorage.setItem('lithos_mapstyle', s); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${mapStyle === 'street' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'}`}
                >
                  <Layers className="w-3.5 h-3.5" /> Street
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); const s = '3d'; setMapStyle(s); localStorage.setItem('lithos_mapstyle', s); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${mapStyle === '3d' ? 'bg-accent/30 text-accent border border-accent/40' : 'text-white/40 hover:text-white/80'}`}
                >
                  <Globe className="w-3.5 h-3.5" /> 3D
                </button>
              </div>
            </div>

            {/* Risk Grid Overlay */}
            {riskGrid && (
              <GeoJSON
                key={selectedRegion?.key + '-' + riskGrid.features?.length}
                data={riskGrid}
                style={(feature) => {
                  const level = feature.properties.risk_level;
                  return {
                    fillColor: level === 'RED' ? '#FF3B30' : level === 'ORANGE' ? '#FF9500' : '#30D158',
                    fillOpacity: level === 'RED' ? 0.25 : level === 'ORANGE' ? 0.1 : 0.02,
                    weight: 0,
                    color: 'transparent'
                  };
                }}
              />
            )}

            {!isNavigating && start && (
              <Marker
                position={start}
                draggable={!isNavigating}
                eventHandlers={{
                  dragend: (e) => {
                    const latlng = e.target.getLatLng();
                    setStart(latlng);
                    setStartQuery(`${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
                    setRouteResult(null); // Clear route on drag
                  }
                }}
                icon={L.divIcon({ className: 'bg-[#FFD60A] w-4 h-4 rounded-full border-[3px] border-white shadow-lg shadow-black/50 hover:scale-110 transition-transform cursor-grab pointer-events-auto' })}
              />
            )}

            {!isNavigating && end && (
              <Marker
                position={end}
                draggable={!isNavigating}
                eventHandlers={{
                  dragend: (e) => {
                    const latlng = e.target.getLatLng();
                    setEnd(latlng);
                    setEndQuery(`${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
                    setRouteResult(null); // Clear route on drag
                  }
                }}
                icon={L.divIcon({ className: 'bg-risk-red w-4 h-4 rounded-full border-[3px] border-white shadow-lg shadow-black/50 hover:scale-110 transition-transform cursor-grab pointer-events-auto' })}
              />
            )}

            {carPosition && isNavigating && (() => {
              const ringColor = carPosition.risk === 'RED' ? '#FF3B30' : carPosition.risk === 'ORANGE' ? '#FF9500' : '#00C2FF';
              const ringColorRgb = carPosition.risk === 'RED' ? '255,59,48' : carPosition.risk === 'ORANGE' ? '255,149,0' : '0,194,255';
              return (
                <Marker
                  position={[carPosition.lat, carPosition.lng]}
                  icon={L.divIcon({
                    className: '',
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                    html: `
                      <div style="position:relative;width:0;height:0">
                        <!-- Scan rings -->
                        <div class="nav-scan-ring-1" style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;border:2px solid ${ringColor};opacity:0;pointer-events:none;"></div>
                        <div class="nav-scan-ring-2" style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;border:1.5px solid ${ringColor};opacity:0;pointer-events:none;"></div>
                        <div class="nav-scan-ring-3" style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;border:1px solid ${ringColor};opacity:0;pointer-events:none;"></div>

                        <!-- Sonar sweep: conic gradient rotating div -->
                        <div class="nav-sonar-sweep" style="position:absolute;top:0;left:0;width:80px;height:80px;border-radius:50%;background:conic-gradient(rgba(${ringColorRgb},0.25) 0deg, transparent 60deg);pointer-events:none;overflow:hidden;"></div>

                        <!-- Outer glowing ring -->
                        <div style="position:absolute;top:0;left:0;width:32px;height:32px;border-radius:50%;background:rgba(${ringColorRgb},0.12);border:1.5px solid rgba(${ringColorRgb},0.5);transform:translate(-50%,-50%);"></div>

                        <!-- Center car dot -->
                        <div style="position:absolute;top:0;left:0;width:16px;height:16px;transform:translate(-50%,-50%);background:white;border-radius:50%;border:2.5px solid ${ringColor};display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(${ringColorRgb},0.9),0 0 4px rgba(${ringColorRgb},0.5);">
                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="${ringColor}" stroke="${ringColor}" stroke-width="2">
                            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                          </svg>
                        </div>
                      </div>
                    `
                  })}
                />
              );
            })()}

            {routeResult && (
              <Polyline
                positions={routeResult.route.segments.map(s => [s.lat, s.lon])}
                pathOptions={{
                  color: routeResult.route.max_risk_level === 'RED' ? '#FF3B30' : '#00C2FF',
                  weight: 5,
                  opacity: 0.8,
                  dashArray: routeResult.route.max_risk_level === 'RED' ? '10, 10' : ''
                }}
              />
            )}

            <MapUpdater />

            {/* Instruction Overlay when not Navigating */}
            {!isNavigating && (
              <div className="absolute bottom-4 left-4 glass p-3 rounded-xl z-[1000] pointer-events-none">
                <p className="text-[8px] font-black text-white/40 uppercase mb-1">Instructions</p>
                <p className="text-[10px] font-bold">1. Enter START (Green)<br />2. Enter END (Red)<br />3. Calculate safest path</p>
              </div>
            )}
          </MapContainer>
          )} {/* end 2D/3D conditional */}
        </div>


        {isNavigating && (
            <div className="absolute inset-0 pointer-events-none z-[1000] flex flex-col justify-between p-6">

            {/* Top Bar: Weather & Progress */}
            <div className="flex justify-between items-start gap-4">

              <div className="flex gap-4 items-start pointer-events-auto">
                {/* Weather Widget */}
                {weather && !isOffline && (
                  <div className="glass p-3 rounded-2xl border-white/10 flex items-center gap-3 backdrop-blur-xl shrink-0">
                    <div className="text-3xl">{weather.icon}</div>
                    <div>
                      <h3 className="text-xs font-black text-white/50 uppercase tracking-widest">{selectedRegion?.name}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold">{weather.temperature}°C</p>
                        <p className="text-sm font-medium text-white/70">{weather.condition}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Off Route Warning & Recalculate */}
                {isOffRoute && (
                  <div className="glass p-3 rounded-2xl border border-risk-red bg-risk-red/20 flex flex-col gap-1.5 backdrop-blur-xl shrink-0 animate-pulse shadow-[0_0_20px_rgba(255,59,48,0.4)] max-w-[200px]">
                    <p className="text-[10px] font-black text-risk-red uppercase tracking-widest flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> Off Route Detected
                    </p>
                    {nearbyHazards.length > 0 && (
                      <p className="text-[9px] font-bold text-white/70">
                        ⚠️ {nearbyHazards.length} critical slope{nearbyHazards.length > 1 ? 's' : ''} nearby
                      </p>
                    )}
                    <button
                      onClick={calculateRoute}
                      disabled={isOffline || loading}
                      className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-risk-red text-white hover:scale-105 transition-all disabled:opacity-50 shadow-lg shadow-risk-red/30"
                    >
                      {isOffline ? 'Return to Path' : 'Recalculate Path'}
                    </button>
                  </div>
                )}
              </div>

              {/* Stop Navigation Button + Evacuation toggle */}
              <div className="flex gap-2 mt-28 pointer-events-auto">
                <button
                  onClick={() => setIsNavigating(false)}
                  className="glass px-4 py-2 rounded-xl bg-risk-red/20 text-risk-red border-risk-red/30 hover:bg-risk-red hover:text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  Exit Navigation
                </button>
                <button
                  onClick={() => setShowEvacuation(v => !v)}
                  className={`glass px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    showEvacuation ? 'bg-risk-green/20 text-risk-green border border-risk-green/40' : 'text-white/40 border border-white/10'
                  }`}
                >
                  ⛺ Evacuation
                </button>
              </div>
            </div>

            {/* Live Reporting Popups */}
            <div className="flex flex-col gap-3 max-w-sm self-end pointer-events-auto">
              {activeAlert && (
                <div className="glass bg-black/90 p-4 rounded-2xl shadow-[0_0_20px_rgba(255,59,48,0.2)] animate-fade-in flex items-start gap-3 border border-risk-red/40 backdrop-blur-xl">
                  <AlertTriangle className="w-6 h-6 shrink-0 text-risk-red mt-0.5 animate-pulse" />
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-risk-orange mb-1">LITHOS SAFETY ADVISORY</p>
                    <p className="text-sm font-bold text-risk-red leading-tight">{activeAlert.message}</p>
                  </div>
                </div>
              )}

              {latestReport && (
                <div className="glass bg-risk-orange/20 p-4 rounded-2xl shadow-2xl animate-fade-in border border-risk-orange/30 backdrop-blur-xl">
                  <p className="text-[10px] text-risk-orange font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-risk-orange animate-pulse" />
                    LIVE COMMUNITY REPORT
                  </p>
                  <p className="text-sm font-bold text-white capitalize">{(latestReport.report_type || latestReport.type || 'alert').replace(/_/g, ' ')}</p>
                  <p className="text-[10px] font-mono text-white/50 mt-1">{new Date(latestReport.timestamp || Date.now()).toLocaleTimeString()}</p>
                </div>
              )}
            </div>

            {/* Nearby Hazard Intelligence Panel */}
            {nearbyHazards.length > 0 && (
              <div className="w-full max-w-2xl mx-auto self-center pointer-events-auto">
                <div className={`glass rounded-2xl border backdrop-blur-xl overflow-hidden transition-all ${
                  nearbyHazards[0]?.distance_km < 3
                    ? 'border-risk-red bg-risk-red/10 shadow-[0_0_25px_rgba(255,59,48,0.3)] animate-pulse'
                    : 'border-risk-orange/40 bg-risk-orange/5'
                }`}>
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
                    <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${ nearbyHazards[0]?.distance_km < 3 ? 'text-risk-red' : 'text-risk-orange'}`} />
                    <p className={`text-[9px] font-black uppercase tracking-widest ${ nearbyHazards[0]?.distance_km < 3 ? 'text-risk-red' : 'text-risk-orange'}`}>
                      {nearbyHazards[0]?.distance_km < 3 ? '🔴 CRITICAL SLOPE IMMINENT' : '⚠️ Critical Slopes Detected Nearby'}
                    </p>
                    <span className="ml-auto text-[8px] font-black text-white/30 uppercase">{nearbyHazards.length} hazard{nearbyHazards.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex divide-x divide-white/10">
                    {nearbyHazards.map((h, i) => (
                      <div key={i} className="flex-1 px-3 py-2.5 min-w-0">
                        <div className="flex items-baseline gap-1.5 mb-0.5">
                          <span className="text-base font-black text-white">{h.distance_km}</span>
                          <span className="text-[9px] text-white/40 uppercase">km</span>
                          <span className="text-[10px] font-bold text-[#00C2FF] ml-auto">{h.direction}</span>
                        </div>
                        <p className="text-[8px] font-bold text-white/50 uppercase tracking-wider truncate">Slope: {h.slope_mean?.toFixed(0) ?? '--'}° · Failure Risk</p>
                        <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${ h.fos_seismic < 0.8 ? 'bg-risk-red' : h.fos_seismic < 1.0 ? 'bg-risk-orange' : 'bg-yellow-400'}`}
                            style={{ width: `${Math.min(100, Math.max(10, (1.5 - (h.fos_seismic ?? 1)) / 1.5 * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Panel: Route Status */}
            <div className="glass pointer-events-auto rounded-3xl p-5 border-white/10 backdrop-blur-xl flex items-center justify-between border-t border-[#00C2FF]/30 w-full max-w-2xl mx-auto self-center">
              <div>
                <p className="text-3xl font-black text-[#00C2FF]">
                  {Math.max(0, (routeResult?.route.distance_km - (navIndex / routeResult?.route.segments.length) * routeResult?.route.distance_km)).toFixed(1)} <span className="text-sm text-white/50 uppercase">km remaining</span>
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 rounded-full bg-risk-green shadow-[0_0_8px_#30D158]" />
                    <span className="text-xs font-bold text-white/70 uppercase tracking-widest">
                      ETA: {Math.max(1, Math.round((Math.max(0, (routeResult?.route.distance_km - (navIndex / routeResult?.route.segments.length) * routeResult?.route.distance_km)) / 40) * 60))} min <span className="text-[8px] opacity-40">@40KM/H</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">Current Risk Level</p>
                <RiskBadge level={carPosition?.risk || 'GREEN'} className="scale-110 origin-right" />
              </div>
            </div>
          </div>
        )}

        {/* SOS + Blockage — absolute positioned, outside nav overlay div */}
        {isNavigating && (
          <>
            <SOSButton carPosition={carPosition} region={selectedRegion?.key} />
            <BlockageReport carPosition={carPosition} />
          </>
        )}

        {/* Offline Banner */}
        {isOffline && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] glass px-6 py-3 rounded-full border-risk-orange/30 shadow-2xl flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-risk-orange animate-pulse" />
            <p className="text-xs font-black uppercase tracking-widest text-risk-orange">📴 Offline — using cached route</p>
          </div>
        )}

        {/* Route Risk Certificate Overlay */}
        {showCertificate && routeResult && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-[3000] flex items-center justify-center p-6 print:bg-white print:text-black animate-fade-in">
            <div className="bg-[#111] print:bg-white border border-white/10 print:border-[#eee] p-8 rounded-3xl max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                <RouteIcon className="w-6 h-6 text-accent" /> LITHOS Route Safety Report
              </h2>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between border-b border-white/10 print:border-[#eee] pb-2">
                  <span className="text-xs font-bold uppercase opacity-60">Route</span>
                  <span className="text-xs font-black uppercase text-right max-w-[200px] truncate">{startQuery} → {endQuery}</span>
                </div>
                <div className="flex justify-between border-b border-white/10 print:border-[#eee] pb-2">
                  <span className="text-xs font-bold uppercase opacity-60">Distance</span>
                  <span className="text-xs font-black uppercase">{routeResult.route.distance_km} km</span>
                </div>
                <div className="flex justify-between border-b border-white/10 print:border-[#eee] pb-2">
                  <span className="text-xs font-bold uppercase opacity-60">Risk Summary</span>
                  <div className="text-right">
                    <p className="text-xs font-black text-risk-green">Safe: {(routeResult.route.risk_summary.GREEN / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN) * routeResult.route.distance_km).toFixed(1)} km</p>
                    <p className="text-xs font-black text-risk-orange">Caution: {(routeResult.route.risk_summary.ORANGE / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN) * routeResult.route.distance_km).toFixed(1)} km</p>
                    <p className="text-xs font-black text-risk-red">Danger: {(routeResult.route.risk_summary.RED / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN) * routeResult.route.distance_km).toFixed(1)} km</p>
                  </div>
                </div>
                {routeResult.route.max_risk_level === 'RED' && (
                  <div className="flex justify-between border-b border-white/10 print:border-[#eee] pb-2">
                    <span className="text-xs font-bold uppercase opacity-60">Recommendation</span>
                    <span className="text-xs font-black uppercase text-risk-red">CAUTION ADVISED</span>
                  </div>
                )}
                <div className="flex justify-between pt-2">
                  <span className="text-[10px] font-mono opacity-40">Generated: {new Date().toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-4 print:hidden">
                <button onClick={() => window.print()} className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl text-xs font-black uppercase transition-all">Save PDF</button>
                <button onClick={() => setShowCertificate(false)} className="flex-1 bg-accent text-bg hover:scale-105 py-3 rounded-xl text-xs font-black uppercase transition-all shadow-glow">Start New Route</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SafeRoute;
