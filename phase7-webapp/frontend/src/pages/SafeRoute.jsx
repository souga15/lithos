import React, { useState, useEffect, Suspense } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents, GeoJSON } from 'react-leaflet';
import { Route as RouteIcon, AlertTriangle, Search, Navigation, Map as MapIcon, Layers, Globe, Loader2, MapPin, X, ArrowUpDown, Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles, ChevronRight, Compass, Gauge, SlidersHorizontal } from 'lucide-react';
import L from 'leaflet';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import RiskMap from '../components/RiskMap';
import RiskBadge from '../components/RiskBadge';
import SOSButton from '../components/SOSButton';
import BlockageReport from '../components/BlockageReport';
import RainfallClock from '../components/RainfallClock';

// ── Demo Presets for Academic / Evaluation Presentation ───────────────────────
const DEMO_PRESETS = [
  {
    id: 'sikkim-nh310',
    name: 'Sikkim NH-310: Gangtok ➔ Nathu La Pass',
    badge: 'Himalayan Pass',
    regionKey: 'sikkim',
    desc: 'High-altitude strategic corridor with steep terrain & active rockfall screening',
    start: { lat: 27.3290, lng: 88.6123 },
    startLabel: 'Gangtok (MG Marg)',
    end: { lat: 27.3868, lng: 88.8309 },
    endLabel: 'Nathu La Pass (4,310m)',
  },
  {
    id: 'cherra-sh5',
    name: 'Meghalaya SH-5: Shillong ➔ Cherrapunji',
    badge: 'Rainfall Escarpment',
    regionKey: 'cherrapunji',
    desc: 'High-precipitation canyon escarpment with pore-water saturation monitoring',
    start: { lat: 25.5788, lng: 91.8933 },
    startLabel: 'Shillong Central',
    end: { lat: 25.2702, lng: 91.7323 },
    endLabel: 'Sohra Eco Park',
  },
  {
    id: 'wayanad-ghat',
    name: 'Western Ghats: Kalpetta ➔ Vythiri Pass',
    badge: 'Steep Ghat Road',
    regionKey: 'wayanad',
    desc: 'Vulnerable Western Ghats mountain road prone to monsoon debris runoff',
    start: { lat: 11.6094, lng: 76.0827 },
    startLabel: 'Kalpetta Junction',
    end: { lat: 11.5510, lng: 76.0410 },
    endLabel: 'Vythiri Ghat Pass',
  },
];

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

  // ── Demo Presentation State ──
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(4); // 4x or 10x
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoMuted, setDemoMuted] = useState(true);
  const [show2DToolsDrawer, setShow2DToolsDrawer] = useState(false);
  const demoTimerRef = React.useRef(null);


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
        // Only restore if high-resolution road route (or short corridor like wayanad)
        if (parsed.route?.segments?.length > 300) {
          setRouteResult(parsed);
        } else {
          localStorage.removeItem('active_route_full');
        }
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

  // ── Load Demo Preset ──────────────────────────────────────────────────────
  const loadDemoPreset = async (preset) => {
    const reg = regions.find(r => r.key === preset.regionKey) || regions[0] || { key: preset.regionKey, name: preset.name };
    setSelectedRegion(reg);
    setStart(preset.start);
    setStartQuery(preset.startLabel);
    setEnd(preset.end);
    setEndQuery(preset.endLabel);
    setFocusPoint(preset.start);
    setLoading(true);

    try {
      const resp = await axios.post(`${API_BASE_URL}/api/route`, {
        start_lat: preset.start.lat,
        start_lon: preset.start.lng,
        end_lat: preset.end.lat,
        end_lon: preset.end.lng,
        region: reg.key
      });
      setRouteResult(resp.data);
      setNavIndex(0);
      const firstSeg = resp.data.route?.segments?.[0];
      setCarPosition({
        lat: preset.start.lat,
        lng: preset.start.lng,
        risk: firstSeg ? firstSeg.risk_level : 'GREEN'
      });
      try {
        localStorage.setItem('active_route_full', JSON.stringify(resp.data));
      } catch (_) {}
    } catch (err) {
      console.error("Demo route error:", err);
      alert('Error fetching demo corridor route. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Start Demo Simulation (4x / 10x Speed) ────────────────────────────────
  const startDemoSimulation = (speed = demoSpeed) => {
    if (!routeResult || !routeResult.route?.segments?.length) return;
    setIsNavigating(true);
    setIsDemoMode(true);
    setIsDemoPlaying(true);
    setDemoSpeed(speed);
    setNavIndex(0);
    const firstSeg = routeResult.route.segments[0];
    setCarPosition({
      lat: firstSeg.lat,
      lng: firstSeg.lon ?? firstSeg.lng,
      risk: firstSeg.risk_level || 'GREEN'
    });
    if (!demoMuted) speak(`Starting corridor presentation at ${speed}x real-time speed.`);
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

        // Auto-select the closest region if within coverage range
        if (regions && regions.length > 0) {
          const closestReg = regions.reduce((best, r) => {
            if (!r.center) return best;
            const dist = Math.hypot(r.center[0] - newPoint.lat, r.center[1] - newPoint.lng);
            return (!best || dist < best.dist) ? { reg: r, dist } : best;
          }, null);
          if (closestReg && closestReg.dist < 1.8 && selectedRegion?.key !== closestReg.reg.key) {
            setSelectedRegion(closestReg.reg);
          }
        }
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

  // ── Standard GPS Tracking (Active ONLY when NOT in Demo Simulation) ──────
  useEffect(() => {
    let watchId;
    if (isNavigating && !isDemoMode && routeResult && routeResult.route.segments.length > 0) {
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
  }, [isNavigating, isDemoMode, routeResult]);

  // ── Demo Presentation Playback Engine (4x / 10x speed) ───────────────────
  useEffect(() => {
    clearInterval(demoTimerRef.current);

    if (isDemoMode && isNavigating && isDemoPlaying && routeResult && routeResult.route?.segments?.length) {
      const segments = routeResult.route.segments;
      // 4x speed = ~220ms per road segment. 10x speed = ~80ms per road segment.
      const intervalMs = demoSpeed === 10 ? 80 : demoSpeed === 4 ? 220 : 800;

      demoTimerRef.current = setInterval(() => {
        setNavIndex((prevIdx) => {
          const stepSize = demoSpeed === 10
            ? Math.max(1, Math.round(segments.length / 280))
            : demoSpeed === 4
            ? Math.max(1, Math.round(segments.length / 550))
            : 1;

          const nextIdx = prevIdx + stepSize;
          if (nextIdx >= segments.length) {
            clearInterval(demoTimerRef.current);
            setIsDemoPlaying(false);
            setShowCertificate(true);
            if (!demoMuted) speak("Demonstration complete. Vehicle reached destination safely.");
            return segments.length - 1;
          }
          const seg = segments[nextIdx];
          setCarPosition({
            lat: seg.lat,
            lng: seg.lon ?? seg.lng,
            risk: seg.risk_level || 'GREEN'
          });
          return nextIdx;
        });
      }, intervalMs);
    }

    return () => clearInterval(demoTimerRef.current);
  }, [isDemoMode, isNavigating, isDemoPlaying, demoSpeed, routeResult, demoMuted]);

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
        if (!demoMuted) {
          if (seg.risk_level === 'RED') {
            speak("Warning — entering high risk landslide zone. Consider alternative route.");
          } else if (seg.risk_level === 'GREEN' && prevRisk.current === 'RED') {
            speak("Leaving danger zone — route is now safe.");
          }
        }
        prevRisk.current = seg.risk_level;
      }
    }
  }, [navIndex, isNavigating, routeResult, demoMuted]);

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
        <div className="w-full lg:w-[380px] h-[45%] lg:h-full bg-slate-950/95 border-r border-slate-800/90 z-20 flex flex-col p-4 sm:p-5 overflow-y-auto shrink-0 transition-all duration-300">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <RouteIcon className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-100 tracking-tight">Safe Route Navigation</h1>
                <p className="text-[11px] text-slate-400">Hazard-aware pathfinding & live tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>AI Active</span>
            </div>
          </div>

          {/* Region & View controls */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            <div className="col-span-3">
              <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1">Region</label>
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 shadow-sm">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  className="w-full bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
                  value={selectedRegion?.key}
                  onChange={(e) => setSelectedRegion(regions.find(r => r.key === e.target.value))}
                >
                  {regions.map(r => <option key={r.key} value={r.key} className="bg-slate-900 text-slate-100">{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1">Map Layer</label>
              <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 flex items-center gap-0.5 shadow-sm">
                {[
                  { id: 'dark', label: 'Dark', Icon: MapIcon },
                  { id: 'street', label: 'Sat', Icon: Layers },
                  { id: '3d', label: '3D', Icon: Globe },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setMapStyle(id);
                      localStorage.setItem('lithos_mapstyle', id);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] transition-colors ${
                      mapStyle === id
                        ? 'bg-slate-800 text-slate-100 font-semibold border border-slate-600 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent font-medium'
                    }`}
                    title={label}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Waypoints Card */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 mb-3 shadow-sm">
            <div className="space-y-2">
              {/* Origin */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 focus-within:border-slate-600 transition-colors flex items-center gap-2">
                <input
                  type="text"
                  value={startQuery}
                  onChange={e => setStartQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(startQuery, setStart, setStartQuery)}
                  placeholder={start ? `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}` : "Origin (or click map)"}
                  className="w-full bg-transparent outline-none text-xs text-slate-200 placeholder-slate-500 font-medium"
                  disabled={loading}
                />
                {start && (
                  <button onClick={() => { setStart(null); setStartQuery(''); }} className="text-slate-500 hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button 
                  onClick={() => handleSearch(startQuery, setStart, setStartQuery)} 
                  disabled={loading} 
                  className="text-slate-400 hover:text-slate-200 shrink-0"
                  title="Search origin"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Destination */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 focus-within:border-slate-600 transition-colors flex items-center gap-2">
                <input
                  type="text"
                  value={endQuery}
                  onChange={e => setEndQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(endQuery, setEnd, setEndQuery)}
                  placeholder={end ? `${end.lat.toFixed(4)}, ${end.lng.toFixed(4)}` : "Destination (or click map)"}
                  className="w-full bg-transparent outline-none text-xs text-slate-200 placeholder-slate-500 font-medium"
                  disabled={loading}
                />
                {end && (
                  <button onClick={() => { setEnd(null); setEndQuery(''); }} className="text-slate-500 hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button 
                  onClick={() => handleSearch(endQuery, setEnd, setEndQuery)} 
                  disabled={loading} 
                  className="text-slate-400 hover:text-slate-200 shrink-0"
                  title="Search destination"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Helper Status & Swap */}
            <div className="mt-2 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-400" />
                {!start ? 'Click map to place Origin' : !end ? 'Click map to place Destination' : 'Points ready'}
              </span>
              {start && end && (
                <button 
                  onClick={() => {
                    const tempS = start; const tempQ = startQuery;
                    setStart(end); setStartQuery(endQuery);
                    setEnd(tempS); setEndQuery(tempQ);
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium transition-colors"
                >
                  <ArrowUpDown className="w-2.5 h-2.5" /> Swap
                </button>
              )}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={calculateRoute}
            disabled={!start || !end || loading}
            className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 mb-3.5 ${
              !start || !end 
                ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed' 
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm border border-cyan-400/30 active:scale-[0.99]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-3.5 h-3.5 text-white" />
                <span>Computing Safe Corridor...</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5" />
                <span>Calculate Safe Route</span>
              </>
            )}
          </button>

          {/* Rainfall / Environmental Telemetry */}
          {selectedRegion && <RainfallClock region={selectedRegion.key} />}

          {/* Route Results */}
          {routeResult && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80 animate-fade-in">
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">{routeResult.route.distance_km} <span className="text-xs font-normal text-slate-400">km</span></h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Calculated Distance</p>
                  </div>
                  <RiskBadge level={routeResult.route.max_risk_level} score={routeResult.route.safe_score} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-medium">
                    <span className="text-slate-400">Safe corridor ratio</span>
                    <span className="text-emerald-400 font-semibold font-mono">
                      {Math.round((routeResult.route.risk_summary.GREEN / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN)) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 flex rounded-full overflow-hidden bg-slate-800">
                    <div className="h-full bg-emerald-500" style={{ width: `${(routeResult.route.risk_summary.GREEN / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN)) * 100}%` }} />
                    <div className="h-full bg-amber-500" style={{ width: `${(routeResult.route.risk_summary.ORANGE / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN)) * 100}%` }} />
                    <div className="h-full bg-rose-500" style={{ width: `${(routeResult.route.risk_summary.RED / (routeResult.route.risk_summary.RED + routeResult.route.risk_summary.ORANGE + routeResult.route.risk_summary.GREEN)) * 100}%` }} />
                  </div>
                </div>
              </div>

              {routeResult.warnings.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg space-y-1.5">
                  {routeResult.warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-rose-400 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                    </p>
                  ))}
                </div>
              )}

              {routeResult.runout_warnings && routeResult.runout_warnings.length > 0 && (
                <div className="bg-rose-500/15 border border-rose-500/40 p-3 rounded-lg">
                  <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Active Runout Zones Detected
                  </p>
                  <div className="space-y-1">
                    {routeResult.runout_warnings.map((rw, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px] text-slate-200 bg-slate-900/60 px-2 py-1 rounded">
                        <span>{rw.km_marker}: {rw.cell_id}</span>
                        <span className="text-rose-400 uppercase text-[9px] bg-rose-500/10 px-1.5 py-0.5 rounded font-medium">Hazard</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-rose-300/80 mt-1.5">
                    Road segments may experience active debris runoff at these markers.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <h3 className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Alternative Routes</h3>
                {routeResult.alternative_routes.map((alt, i) => (
                  <div key={i} className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg hover:border-slate-700 cursor-pointer transition-all">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{alt.distance_km} km</p>
                        <p className="text-[10px] text-slate-400">+{alt.extra_time_min} min detour</p>
                      </div>
                      <RiskBadge level={alt.max_risk_level} className="scale-75 origin-right" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-1 space-y-2">
                <button
                  onClick={() => startDemoSimulation(demoSpeed)}
                  className="w-full py-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white shadow-sm active:scale-[0.99]"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Start Demo Simulation ({demoSpeed}x Speed)
                </button>
                <button
                  onClick={() => {
                    setIsNavigating(true);
                    setIsDemoMode(false);
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
                  className="w-full py-2 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 shadow-sm"
                >
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" /> Start Live GPS Navigation
                </button>
              </div>
            </div>
          )}

          <div className="mt-auto pt-4">
            <button
              onClick={() => { setStart(null); setEnd(null); setRouteResult(null); setStartQuery(''); setEndQuery(''); setIsNavigating(false); setCarPosition(null); }}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors block text-center mx-auto"
            >
              Reset waypoints
            </button>
          </div>
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
                region={selectedRegion}
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
                enableBuildings={false}
                demoPresets={DEMO_PRESETS}
                demoSpeed={demoSpeed}
                onSetDemoSpeed={setDemoSpeed}
                onLoadDemoPreset={loadDemoPreset}
                onStartDemoSimulation={startDemoSimulation}
                onMapClick={(loc) => {
                  if (!start) {
                    setStart(loc);
                    setStartQuery(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
                  } else if (!end) {
                    setEnd(loc);
                    setEndQuery(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
                  }
                }}
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
                ? (import.meta.env.VITE_CARTO_API_KEY
                    ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_CARTO_API_KEY}`
                    : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}")
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              }
            />
            <MapEvents />

            {/* Consolidated 2D Layers & Tools Drawer */}
            <div className="absolute top-4 left-4 z-[1000]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShow2DToolsDrawer(!show2DToolsDrawer);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 shadow-md backdrop-blur-md transition-all cursor-pointer ${
                  show2DToolsDrawer
                    ? 'bg-slate-800 text-white border-slate-600'
                    : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800 hover:text-white'
                }`}
                title="Map Layers, Overlays and Tools"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                <span>Layers & Tools</span>
              </button>

              {show2DToolsDrawer && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-3.5 space-y-3 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-semibold text-white">Map Layers & Tools</span>
                    </div>
                    <button 
                      onClick={() => setShow2DToolsDrawer(false)}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Demo Corridors Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                          Demo Corridors
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-700/80 rounded-md p-0.5">
                        <button
                          onClick={() => setDemoSpeed(4)}
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${demoSpeed === 4 ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}
                          title="4x Real-Time Travel Speed"
                        >
                          4x
                        </button>
                        <button
                          onClick={() => setDemoSpeed(10)}
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${demoSpeed === 10 ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}
                          title="10x Fast-Forward Presentation Speed"
                        >
                          10x
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {DEMO_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            loadDemoPreset(preset);
                            setShow2DToolsDrawer(false);
                          }}
                          className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded-lg bg-slate-950/60 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/40 transition-all group cursor-pointer"
                        >
                          <div className="min-w-0 pr-1.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium text-slate-200 group-hover:text-cyan-300 truncate">
                                {preset.name}
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-400 block truncate">{preset.desc}</span>
                          </div>
                          <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                        </button>
                      ))}
                    </div>

                    {routeResult && (
                      <button
                        onClick={() => {
                          startDemoSimulation(demoSpeed);
                          setShow2DToolsDrawer(false);
                        }}
                        className="w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Start Demo Run ({demoSpeed}x Speed)</span>
                      </button>
                    )}
                  </div>

                  {/* Map Layer Style */}
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Map View Mode</span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'dark', label: 'Dark' },
                        { id: 'street', label: 'Street' },
                        { id: '3d', label: '3D Globe' },
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setMapStyle(m.id); localStorage.setItem('lithos_mapstyle', m.id); }}
                          className={`py-1 text-[10px] font-bold rounded border text-center transition-all ${mapStyle === m.id ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                        {nearbyHazards.length} critical slope{nearbyHazards.length > 1 ? 's' : ''} nearby
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

              {/* If Demo Mode: Show Full Presentation Playback Controller */}
              {isDemoMode && routeResult && (
                <div className="pointer-events-auto bg-slate-950/95 border border-cyan-500/40 rounded-2xl p-3 shadow-2xl backdrop-blur-xl flex flex-col gap-2 min-w-[300px] sm:min-w-[360px] max-w-[440px] animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                        Demo Simulation • {demoSpeed}x Real-Time
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setDemoMuted(!demoMuted)}
                        className={`p-1.5 rounded-lg border transition-colors ${demoMuted ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-cyan-500/20 border-cyan-500 text-cyan-300'}`}
                        title={demoMuted ? "Unmute Voice Safety Announcements" : "Mute Voice"}
                      >
                        {demoMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => {
                          setIsNavigating(false);
                          setIsDemoMode(false);
                          setIsDemoPlaying(false);
                          clearInterval(demoTimerRef.current);
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-[10px] font-bold uppercase transition-all"
                      >
                        Exit Demo
                      </button>
                    </div>
                  </div>

                  {/* Waypoint Scrubber */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Waypoint {navIndex + 1} of {routeResult.route.segments.length}</span>
                      <span className="text-cyan-300 font-bold">
                        {Math.round(((navIndex + 1) / routeResult.route.segments.length) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={routeResult.route.segments.length - 1}
                      value={navIndex}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value, 10);
                        setNavIndex(idx);
                        const seg = routeResult.route.segments[idx];
                        if (seg) setCarPosition({ lat: seg.lat, lng: seg.lon ?? seg.lng, risk: seg.risk_level });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* Playback Controls & Speed Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsDemoPlaying(!isDemoPlaying)}
                        className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                      >
                        {isDemoPlaying ? (
                          <>
                            <Pause className="w-3 h-3 fill-slate-950" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-slate-950" /> Play
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setNavIndex(0);
                          const seg = routeResult.route.segments[0];
                          if (seg) setCarPosition({ lat: seg.lat, lng: seg.lon ?? seg.lng, risk: seg.risk_level });
                          setIsDemoPlaying(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-colors"
                        title="Restart from origin"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
                      <button
                        onClick={() => setDemoSpeed(4)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${demoSpeed === 4 ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        4x Speed
                      </button>
                      <button
                        onClick={() => setDemoSpeed(10)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${demoSpeed === 10 ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        10x Turbo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Standard Navigation Exit & Havens if NOT in Demo Mode */}
              {!isDemoMode && (
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
                    Safe Havens
                  </button>
                </div>
              )}
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
                      {nearbyHazards[0]?.distance_km < 3 ? 'CRITICAL SLOPE IMMINENT' : 'Critical Slopes Detected Nearby'}
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
