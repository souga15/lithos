import React, { useState, useEffect, Suspense, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents, Polygon } from 'react-leaflet';
import HeatmapLayer from '../components/HeatmapLayer';
import {
  Route as RouteIcon, AlertTriangle, Search, Navigation, Map as MapIcon, Layers, Globe,
  Loader2, MapPin, X, ArrowUpDown, Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles,
  ChevronRight, Compass, Gauge, SlidersHorizontal, ArrowUpRight, ArrowUpLeft, ArrowUp,
  CornerUpRight, CornerUpLeft, Split, Flag, ShieldCheck, ShieldAlert, Zap, CheckCircle2,
  ChevronDown, ArrowRight, Eye, Shield
} from 'lucide-react';
import L from 'leaflet';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import RiskMap from '../components/RiskMap';
import RiskBadge from '../components/RiskBadge';
import SOSButton from '../components/SOSButton';
import BlockageReport from '../components/BlockageReport';
import RainfallClock from '../components/RainfallClock';

// ── Regional Authentic Destination Landmarks & Strategic Passes ─────────────
const REGIONAL_LANDMARKS = {
  sikkim: [
    { name: "Gangtok (MG Marg)", lat: 27.3290, lng: 88.6123, tag: "City Center" },
    { name: "Nathu La Pass (4,310m)", lat: 27.3868, lng: 88.8309, tag: "Strategic Pass" },
    { name: "Tsomgo / Changu Lake", lat: 27.3742, lng: 88.7618, tag: "High Alpine Lake" },
    { name: "Singtam Highway Junction", lat: 27.2340, lng: 88.4980, tag: "NH-10 Arterial" },
    { name: "Dikchu Teesta Bridge", lat: 27.3995, lng: 88.5298, tag: "Teesta Crossing" },
    { name: "Mangan Dzong (North)", lat: 27.5080, lng: 88.5320, tag: "District Capital" },
    { name: "Rangpo Border Post", lat: 27.1764, lng: 88.5302, tag: "State Border" },
  ],
  cherrapunji: [
    { name: "Shillong Police Bazar", lat: 25.5788, lng: 91.8933, tag: "Capital Center" },
    { name: "Sohra (Cherra Eco Park)", lat: 25.2702, lng: 91.7323, tag: "Rainfall Scarp" },
    { name: "Dawki Border Checkpost", lat: 25.1870, lng: 92.0190, tag: "Border Gate" },
    { name: "Umiam Lake Dam Link", lat: 25.6560, lng: 91.9050, tag: "Reservoir Link" },
    { name: "Mawlynnong Eco Village", lat: 25.2015, lng: 91.9160, tag: "Canyon Trail" },
    { name: "Nongpoh Highway Post", lat: 25.9010, lng: 91.8810, tag: "Assam Corridor" },
  ],
  manipur_nh2: [
    { name: "Imphal Kangla Fort", lat: 24.8170, lng: 93.9368, tag: "Capital Gateway" },
    { name: "Kohima War Cemetery", lat: 25.6701, lng: 94.1077, tag: "Ridge Highway" },
    { name: "Senapati Valley Corridor", lat: 25.2670, lng: 94.0180, tag: "Valley Arterial" },
    { name: "Dimapur Railhead Gate", lat: 25.9060, lng: 93.7270, tag: "Transit Hub" },
    { name: "Maram Hill Station", lat: 25.4300, lng: 94.0600, tag: "High Pass" },
  ],
  arunachal_w: [
    { name: "Itanagar Raj Bhavan", lat: 27.0844, lng: 93.6053, tag: "Capital Post" },
    { name: "Bhalukpong Gate", lat: 27.0120, lng: 92.6410, tag: "Entry Corridor" },
    { name: "Bomdila Pass Approach", lat: 27.2645, lng: 92.4230, tag: "Strategic Ridge" },
    { name: "Dirang Valley Link", lat: 27.3590, lng: 92.2350, tag: "River Valley" },
  ],
  nagaland: [
    { name: "Kohima Town Center", lat: 25.6701, lng: 94.1077, tag: "Capital Ridge" },
    { name: "Dimapur City Junction", lat: 25.9060, lng: 93.7270, tag: "Plains Link" },
    { name: "Mokokchung Ridge Post", lat: 26.3250, lng: 94.5200, tag: "Highland" },
    { name: "Wokha Highland Link", lat: 26.1000, lng: 94.2600, tag: "Mountain Pass" },
  ],
  wayanad: [
    { name: "Kalpetta District Center", lat: 11.6090, lng: 76.0820, tag: "Center" },
    { name: "Meppadi Tea Estate Link", lat: 11.5510, lng: 76.1280, tag: "Valley Road" },
    { name: "Chooralmala Scarp", lat: 11.5320, lng: 76.1680, tag: "Scarp Zone" },
    { name: "Vythiri Ghat Pass", lat: 11.5520, lng: 76.0420, tag: "Ghat Link" },
    { name: "Sultan Bathery Gate", lat: 11.6620, lng: 76.2570, tag: "State Post" },
  ],
  assam_hills: [
    { name: "Haflong Hill Station", lat: 25.1764, lng: 93.0238, tag: "District Center" },
    { name: "Lumding Junction Link", lat: 25.7500, lng: 93.1700, tag: "Rail Corridor" },
    { name: "Maibang River Valley", lat: 25.3000, lng: 93.1600, tag: "Valley Link" },
  ],
  mizoram: [
    { name: "Aizawl City Center", lat: 23.7271, lng: 92.7176, tag: "Ridge City" },
    { name: "Sairang Rail Terminal", lat: 23.8050, lng: 92.6570, tag: "Transport Hub" },
    { name: "Lunglei South Post", lat: 22.8800, lng: 92.7400, tag: "Ridge Highway" },
  ],
  tripura: [
    { name: "Agartala Capital Hub", lat: 23.8315, lng: 91.2868, tag: "Capital Link" },
    { name: "Dharmanagar Post", lat: 24.3800, lng: 92.1700, tag: "North Arterial" },
    { name: "Jampui Hills Range", lat: 23.9500, lng: 92.2800, tag: "Border Ridge" },
  ]
};

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
    id: 'manipur-nh2',
    name: 'Manipur NH-2: Imphal ➔ Kohima Corridor',
    badge: 'Tectonic Ridge Highway',
    regionKey: 'manipur_nh2',
    desc: 'Critical lifeline corridor crossing fault zones with active seismic slope screening',
    start: { lat: 24.8170, lng: 93.9368 },
    startLabel: 'Imphal Capital Gate',
    end: { lat: 25.6701, lng: 94.1077 },
    endLabel: 'Kohima Highway Post',
  },
];

// Helper: Calculate forward heading in degrees (0..360, North=0)
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const formatDuration = (mins) => {
  if (!mins) return '0 min';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h} hr ${m > 0 ? `${m} min` : ''}`;
  return `${m} min`;
};

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
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0); // 0: Safe, 1: Moderate, 2: Danger
  const [loading, setLoading] = useState(false);
  const [riskGrid, setRiskGrid] = useState(null);
  const [activeRunouts, setActiveRunouts] = useState([]);

  // Live Navigation Data State
  const [weather, setWeather] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const [latestReport, setLatestReport] = useState(null);

  // Geocoding State
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [focusPoint, setFocusPoint] = useState(null);
  const [clickTarget, setClickTarget] = useState('auto'); // 'auto' | 'origin' | 'destination'

  // Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [isDrivingMode, setIsDrivingMode] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const [carPosition, setCarPosition] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const prevRisk = useRef('GREEN');
  const lastProximityCheck = useRef({ lat: 0, lng: 0, time: 0 });
  const lastAlertedHazard = useRef(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem('lithos_mapstyle') || '3d');
  const [nearbyHazards, setNearbyHazards] = useState([]);
  const [liveUsers, setLiveUsers] = useState([]);
  const [showEvacuation, setShowEvacuation] = useState(false);
  const sessionId = useRef(`lithos_${Math.random().toString(36).slice(2)}`);

  // ── Driving Simulation State ──
  const [demoSpeed, setDemoSpeed] = useState(3); // 1x, 3x, 8x
  const [isDemoPlaying, setIsDemoPlaying] = useState(true);
  const [demoMuted, setDemoMuted] = useState(false);
  const [show2DToolsDrawer, setShow2DToolsDrawer] = useState(false);
  const demoTimerRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Derive the active route (selected by user: Safe, Moderate, or Danger)
  const activeRoute = routeResult?.routes
    ? (routeResult.routes[selectedRouteIdx] || routeResult.routes[0])
    : routeResult?.route;

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (err) { console.log('Wake lock failed', err); }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const speak = (text) => {
    if (demoMuted) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  };

  useEffect(() => {
    fetchRegions();
    try {
      const cached = localStorage.getItem('active_route_full');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.routes?.length || parsed.route?.segments?.length > 100) {
          setRouteResult(parsed);
        }
      }
    } catch (e) { console.error("Cache load failed", e); }
    return () => window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if (selectedRegion?.key) {
      fetchRiskGrid(selectedRegion);
      fetchActiveRunouts(selectedRegion.key);
    }
  }, [selectedRegion?.key]);

  useEffect(() => {
    if (selectedRegion && !isOffline) {
      fetchLiveWeather(selectedRegion.key);
    }
  }, [selectedRegion, isOffline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      speak("Network connectivity restored.");
    };
    const handleOffline = () => {
      setIsOffline(true);
      speak("Network connection lost. Offline cached mode active.");
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchLiveWeather = async (key) => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/weather/live?region=${key}`);
      setWeather(resp.data);
    } catch (_) {}
  };

  const fetchRegions = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/regions`);
      setRegions(resp.data.regions);
      const defReg = resp.data.regions.find(r => r.key === 'sikkim') || resp.data.regions[0];
      setSelectedRegion(defReg);
      // Set default Sikkim landmark pair
      const sikkimMarks = REGIONAL_LANDMARKS['sikkim'];
      if (sikkimMarks && sikkimMarks.length >= 2) {
        setStart({ lat: sikkimMarks[0].lat, lng: sikkimMarks[0].lng });
        setStartQuery(sikkimMarks[0].name);
        setEnd({ lat: sikkimMarks[1].lat, lng: sikkimMarks[1].lng });
        setEndQuery(sikkimMarks[1].name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRiskGrid = async (targetRegion) => {
    const reg = targetRegion || selectedRegion;
    if (!reg?.key) return;
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/risk-grid?region=${reg.key}`);
      if (resp.data && resp.data.features) setRiskGrid(resp.data);
    } catch (_) {}
  };

  const fetchActiveRunouts = async (regionKey) => {
    if (!regionKey) return;
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/active-runouts?region=${regionKey}`);
      setActiveRunouts(resp.data || []);
    } catch (_) {}
  };

  const searchLocation = async (query, setPoint, setQueryStr) => {
    if (!query || !query.trim()) return;
    const q = query.trim().toLowerCase();

    // 1. Check coordinates (e.g. "27.329, 88.612")
    const coordMatch = q.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        const pt = { lat, lng };
        setPoint(pt);
        setFocusPoint(pt);
        return;
      }
    }

    // 2. Fast lookup against strategic mountain landmarks across regions
    for (const regKey of Object.keys(REGIONAL_LANDMARKS)) {
      const found = REGIONAL_LANDMARKS[regKey].find(lm =>
        lm.name.toLowerCase().includes(q) || q.includes(lm.name.toLowerCase().split(' ')[0])
      );
      if (found) {
        const pt = { lat: found.lat, lng: found.lng };
        setPoint(pt);
        setQueryStr(found.name);
        setFocusPoint(pt);
        return;
      }
    }

    // 3. Query OpenStreetMap Nominatim for accurate real-world place/address in India
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', India')}&limit=1`
      );
      const data = await resp.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const pt = { lat, lng };
        setPoint(pt);
        setQueryStr(data[0].display_name.split(',')[0]);
        setFocusPoint(pt);
      } else {
        alert(`Location "${query}" not found. Try entering a city or click directly on the map.`);
      }
    } catch (e) {
      console.warn("Geocoding failed:", e);
    }
  };

  const calculateRoute = async () => {
    if (!start || !end) {
      alert("Please select both Origin and Destination waypoints.");
      return;
    }
    setLoading(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/api/route`, {
        start_lat: start.lat,
        start_lon: start.lng,
        end_lat: end.lat,
        end_lon: end.lng,
        region: selectedRegion?.key || 'multi'
      });
      setRouteResult(resp.data);
      setSelectedRouteIdx(0);
      setNavIndex(0);
      const r0 = resp.data.routes ? resp.data.routes[0] : resp.data.route;
      const firstSeg = r0?.segments?.[0];
      if (firstSeg) {
        setCarPosition({
          lat: firstSeg.lat,
          lng: firstSeg.lon ?? firstSeg.lng,
          risk: firstSeg.risk_level || 'GREEN',
          slope: firstSeg.slope_mean ?? 14,
          fos: firstSeg.fos_seismic ?? 1.5,
          heading: 0
        });
      }
      try {
        localStorage.setItem('active_route_full', JSON.stringify(resp.data));
      } catch (_) {}
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Error calculating routes. Please try different waypoints.');
    } finally {
      setLoading(false);
    }
  };

  const handleLandmarkSelect = (lm, asOrigin = false) => {
    const point = { lat: lm.lat, lng: lm.lng };
    if (asOrigin) {
      setStart(point);
      setStartQuery(lm.name);
      setFocusPoint(point);
    } else {
      setEnd(point);
      setEndQuery(lm.name);
      setFocusPoint(point);
      // If start is already set, auto calculate!
      if (start) {
        setRouteResult(null);
      }
    }
  };

  const handleSearch = async (query, setPointFunc, setQueryFunc) => {
    if (!query) return;
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      if (res.data && res.data.length > 0) {
        const { lat, lon, display_name } = res.data[0];
        const newPoint = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setPointFunc(newPoint);
        setQueryFunc(display_name.split(',')[0]);
        setFocusPoint(newPoint);
      } else {
        alert("Location not found. Please try another query or click on the map.");
      }
    } catch (err) {
      console.error("Geocoding error", err);
    }
  };

  // ── Driving Simulation Movement Engine ─────────────────────────────────────
  useEffect(() => {
    clearInterval(demoTimerRef.current);

    if (isNavigating && isDemoPlaying && activeRoute?.segments?.length) {
      const segments = activeRoute.segments;
      // 1x = ~500ms per waypoint (realistic mountain pace)
      // 3x = ~160ms per waypoint
      // 8x = ~65ms per waypoint
      const intervalMs = demoSpeed === 8 ? 65 : demoSpeed === 3 ? 160 : 500;

      demoTimerRef.current = setInterval(() => {
        setNavIndex((prevIdx) => {
          const stepSize = demoSpeed === 8
            ? Math.max(1, Math.round(segments.length / 320))
            : demoSpeed === 3
            ? Math.max(1, Math.round(segments.length / 700))
            : 1;

          const nextIdx = prevIdx + stepSize;
          if (nextIdx >= segments.length) {
            clearInterval(demoTimerRef.current);
            setIsDemoPlaying(false);
            setShowCertificate(true);
            speak("Destination reached securely. Corridor inspection complete.");
            return segments.length - 1;
          }

          const curr = segments[nextIdx];
          const next = segments[Math.min(nextIdx + 1, segments.length - 1)];
          const heading = (curr && next && nextIdx < segments.length - 1)
            ? calculateBearing(curr.lat, curr.lon ?? curr.lng, next.lat, next.lon ?? next.lng)
            : (carPosition?.heading || 0);

          setCarPosition({
            lat: curr.lat,
            lng: curr.lon ?? curr.lng,
            risk: curr.risk_level || 'GREEN',
            slope: curr.slope_mean ?? 14.2,
            fos: curr.fos_seismic ?? 1.55,
            heading: Math.round(heading)
          });

          return nextIdx;
        });
      }, intervalMs);
    }

    return () => clearInterval(demoTimerRef.current);
  }, [isNavigating, isDemoPlaying, demoSpeed, activeRoute, demoMuted]);

  // Voice announcements for risk zones
  useEffect(() => {
    if (isNavigating && activeRoute?.segments?.[navIndex]) {
      const seg = activeRoute.segments[navIndex];
      if (seg.risk_level !== prevRisk.current) {
        if (seg.risk_level === 'RED') {
          speak("Caution: Entering high hazard scarp zone. Factor of safety under 1.05.");
        } else if (seg.risk_level === 'GREEN' && prevRisk.current === 'RED') {
          speak("Hazard zone cleared. Entering stabilized valley corridor.");
        }
        prevRisk.current = seg.risk_level;
      }
    }
  }, [navIndex, isNavigating, activeRoute]);

  // ── Calculate Upcoming Maneuvers for Google Maps Driving Card ──────────────
  const maneuvers = activeRoute?.maneuvers || [];
  let currentManeuver = maneuvers.find(m => m.index >= navIndex);
  if (!currentManeuver) currentManeuver = maneuvers[maneuvers.length - 1];

  let distToManeuver = 0;
  if (activeRoute?.segments && currentManeuver) {
    const targetIdx = Math.min(currentManeuver.index, activeRoute.segments.length - 1);
    for (let s = navIndex; s < targetIdx; s++) {
      const s1 = activeRoute.segments[s];
      const s2 = activeRoute.segments[s + 1];
      if (s1 && s2) {
        distToManeuver += L.latLng(s1.lat, s1.lon ?? s1.lng).distanceTo(L.latLng(s2.lat, s2.lon ?? s2.lng));
      }
    }
  }

  // Dynamic Driving Speedometer computation
  const currSeg = activeRoute?.segments?.[navIndex] || {};
  const currentSlope = currSeg.slope_mean || 14.5;
  const currentFoS = currSeg.fos_seismic || 1.52;
  const dynamicSpeedKmh = currentSlope > 24 ? 32 : currentSlope > 16 ? 44 : 58;

  // Remaining distance & ETA
  const totalKm = activeRoute?.distance_km || 40;
  const progressRatio = activeRoute?.segments?.length ? (navIndex / activeRoute.segments.length) : 0;
  const remainingKm = Math.max(0, totalKm * (1 - progressRatio));
  const remainingMin = Math.max(1, Math.round((remainingKm / 42) * 60));
  const arrivalTime = new Date(Date.now() + remainingMin * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Map Click Listener
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (clickTarget === 'origin' || (!start && clickTarget === 'auto')) {
          setStart(e.latlng);
          setStartQuery(`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
          if (clickTarget === 'origin') setClickTarget('destination');
        } else if (clickTarget === 'destination' || (!end && clickTarget === 'auto')) {
          setEnd(e.latlng);
          setEndQuery(`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
          setClickTarget('auto');
        } else {
          // Both set: update destination
          setEnd(e.latlng);
          setEndQuery(`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
        }
      },
    });
    return null;
  };

  // 2D Camera Follow
  const MapUpdater = () => {
    const map = useMapEvents({});
    useEffect(() => {
      if (isNavigating && carPosition) {
        map.panTo([carPosition.lat, carPosition.lng], { animate: true, duration: 0.6 });
      } else if (!isNavigating && activeRoute?.segments?.length) {
        const bounds = activeRoute.segments
          .filter(s => s && s.lat != null && (s.lon != null || s.lng != null))
          .map(s => [s.lat, s.lon ?? s.lng]);
        if (bounds.length > 0) {
          try { map.fitBounds(bounds, { padding: [50, 50] }); } catch (_) {}
        }
      } else if (focusPoint) {
        map.flyTo([focusPoint.lat, focusPoint.lng], 13, { animate: true, duration: 1 });
        setFocusPoint(null);
      }
    }, [carPosition, isNavigating, activeRoute, focusPoint, map]);
    return null;
  };

  // Helper for Maneuver Icons
  const renderManeuverIcon = (type, modifier) => {
    if (type === 'arrive') return <Flag className="w-6 h-6 text-emerald-400" />;
    if (type?.includes('right') || modifier?.includes('right')) return <CornerUpRight className="w-6 h-6 text-white" />;
    if (type?.includes('left') || modifier?.includes('left')) return <CornerUpLeft className="w-6 h-6 text-white" />;
    if (type?.includes('fork')) return <Split className="w-6 h-6 text-cyan-400" />;
    return <ArrowUp className="w-6 h-6 text-white" />;
  };

  return (
    <div className="absolute inset-0 flex flex-col lg:flex-row animate-fade-in overflow-hidden bg-slate-950 font-sans">

      {/* ── SIDEBAR (Hidden during full driving navigation mode for distraction-free view) ── */}
      {!isNavigating && (
        <div className="w-full lg:w-[400px] h-[52%] lg:h-full bg-[#070b19]/95 border-r border-slate-800/80 z-20 flex flex-col p-4 overflow-y-auto shrink-0 transition-all duration-300">

          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#2B9EFF]/10 border border-[#2B9EFF]/20 flex items-center justify-center text-[#2B9EFF]">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-100 tracking-tight">Safe Route</h1>
                <p className="text-[11px] text-slate-400">Hazard-aware mountain routing</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#090d1c] border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => { setMapStyle('dark'); localStorage.setItem('lithos_mapstyle', 'dark'); }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${mapStyle !== '3d' ? 'bg-[#2B9EFF] text-white' : 'text-slate-400 hover:text-white'}`}
              >
                2D
              </button>
              <button
                onClick={() => { setMapStyle('3d'); localStorage.setItem('lithos_mapstyle', '3d'); }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${mapStyle === '3d' ? 'bg-[#2B9EFF] text-white' : 'text-slate-400 hover:text-white'}`}
              >
                3D
              </button>
            </div>
          </div>

          {/* Region Selector */}
          <div className="mb-3">
            <div className="flex items-center gap-2 bg-[#090d1c] border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                className="w-full bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
                value={selectedRegion?.key}
                onChange={(e) => {
                  const reg = regions.find(r => r.key === e.target.value);
                  if (reg) {
                    setSelectedRegion(reg);
                    setRouteResult(null);
                    const marks = REGIONAL_LANDMARKS[reg.key];
                    if (marks && marks.length >= 2) {
                      setStart({ lat: marks[0].lat, lng: marks[0].lng });
                      setStartQuery(marks[0].name);
                      setEnd({ lat: marks[1].lat, lng: marks[1].lng });
                      setEndQuery(marks[1].name);
                    }
                  }
                }}
              >
                {regions.map(r => (
                  <option key={r.key} value={r.key} className="bg-[#090d1c] text-slate-100">
                    {r.name} ({r.unit_count || 1200} units)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Google Maps Style Route Input Box (As shown in Google Maps reference) */}
          <div className="bg-[#090d1c] border border-slate-800 rounded-2xl p-3 shadow-sm mb-3">
            <div className="flex items-center gap-2.5">
              {/* Left Column: Origin Dot, Connecting Dotted Line, Destination Pin */}
              <div className="flex flex-col items-center justify-between py-1.5 shrink-0 self-stretch">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2B9EFF] ring-2 ring-[#2B9EFF]/30" />
                <div className="flex flex-col items-center gap-1 my-1">
                  <span className="w-0.5 h-1 rounded-full bg-slate-600" />
                  <span className="w-0.5 h-1 rounded-full bg-slate-600" />
                  <span className="w-0.5 h-1 rounded-full bg-slate-600" />
                </div>
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              </div>

              {/* Center Column: Inputs */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                {/* Origin Input */}
                <div className="bg-[#050814] border border-white/10 hover:border-white/20 focus-within:border-[#2B9EFF] rounded-xl px-3 py-1.5 flex items-center gap-2 transition-colors">
                  <input
                    type="text"
                    value={startQuery}
                    onChange={e => setStartQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchLocation(startQuery, setStart, setStartQuery)}
                    placeholder="Your location (e.g. Gangtok, MG Marg)..."
                    className="w-full bg-transparent outline-none text-xs text-white placeholder-slate-500 font-medium"
                  />
                  {start && (
                    <button onClick={() => { setStart(null); setStartQuery(''); }} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => searchLocation(startQuery, setStart, setStartQuery)} className="text-slate-400 hover:text-[#2B9EFF]">
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Destination Input */}
                <div className="bg-[#050814] border border-white/10 hover:border-white/20 focus-within:border-[#2B9EFF] rounded-xl px-3 py-1.5 flex items-center gap-2 transition-colors">
                  <input
                    type="text"
                    value={endQuery}
                    onChange={e => setEndQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchLocation(endQuery, setEnd, setEndQuery)}
                    placeholder="Choose destination (e.g. Tsomgo, Nathu La)..."
                    className="w-full bg-transparent outline-none text-xs text-white placeholder-slate-500 font-medium"
                  />
                  {end && (
                    <button onClick={() => { setEnd(null); setEndQuery(''); }} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => searchLocation(endQuery, setEnd, setEndQuery)} className="text-slate-400 hover:text-[#2B9EFF]">
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right Column: Swap & Map Pick Buttons */}
              <div className="flex flex-col items-center justify-between py-1 shrink-0 self-stretch">
                <button
                  onClick={() => {
                    const tmpS = start; const tmpSQ = startQuery;
                    setStart(end); setStartQuery(endQuery);
                    setEnd(tmpS); setEndQuery(tmpSQ);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Reverse starting point and destination"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setClickTarget(clickTarget === 'destination' ? 'auto' : 'destination')}
                  className={`p-1.5 rounded-lg transition-colors ${clickTarget === 'destination' ? 'bg-[#2B9EFF] text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  title="Click map to pick destination"
                >
                  <MapPin className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Clean Get Routes Button (Lithos Electric Blue) */}
            <button
              onClick={calculateRoute}
              disabled={!start || !end || loading}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 mt-3 ${
                !start || !end || loading
                  ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                  : 'bg-[#2B9EFF] hover:bg-[#1a6bc4] text-white shadow-sm active:scale-[0.99] cursor-pointer'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 text-white" />
                  <span>Calculating terrain route...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5 fill-white text-white" />
                  <span>Get Routes</span>
                </>
              )}
            </button>
          </div>

          {/* Environmental Rainfall Radar (Compact / Clean) */}
          {selectedRegion && !routeResult && (
            <RainfallClock region={selectedRegion.key} />
          )}

          {/* ── 3-ROUTE COMPARISON SELECTOR CARDS (Google Maps Style in LITHOS Theme) ── */}
          {routeResult?.routes && (
            <div className="space-y-2 mt-1 pt-1 animate-fade-in">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[11px] font-semibold text-slate-400">
                  Recommended Routes
                </span>
                <span className="text-[10px] text-slate-500">Safest corridor first</span>
              </div>

              <div className="space-y-2">
                {routeResult.routes.map((r, idx) => {
                  const isSelected = selectedRouteIdx === idx;
                  const isSafe = r.category === 'SAFE';
                  const isMod = r.category === 'MODERATE';
                  const isDanger = r.category === 'DANGER';

                  const badgeBg = isSafe
                    ? 'bg-[#2DC77A]/15 text-[#2DC77A]'
                    : isMod
                    ? 'bg-[#F4A261]/15 text-[#F4A261]'
                    : 'bg-[#E63946]/15 text-[#E63946]';

                  return (
                    <div
                      key={r.id || idx}
                      onClick={() => setSelectedRouteIdx(idx)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-[#2B9EFF] bg-[#2B9EFF]/5 shadow-sm'
                          : 'border-white/10 bg-[#090d1c] hover:bg-slate-900/60 hover:border-white/20'
                      }`}
                    >
                      {isSelected && (
                        <div
                          className="absolute top-0 left-0 bottom-0 w-1 rounded-l-xl"
                          style={{ background: r.color || '#2B9EFF' }}
                        />
                      )}

                      <div className="flex items-start justify-between gap-3 pl-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-white tracking-tight">
                              {r.title}
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${badgeBg}`}>
                              {r.badge}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {r.corridor_name ? `${r.corridor_name} · ` : ''}{r.desc}
                          </p>

                          {/* Clean inline geotechnical metrics */}
                          <div className="flex items-center gap-2.5 mt-2 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <span className="text-slate-500">FoS</span>
                              <span className={`font-mono font-bold ${r.min_fos < 1.05 ? 'text-[#E63946]' : r.min_fos < 1.30 ? 'text-[#F4A261]' : 'text-[#2DC77A]'}`}>
                                {r.min_fos?.toFixed(2) || '1.45'}
                              </span>
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="flex items-center gap-1">
                              <span className="text-slate-500">Slope</span>
                              <span className="font-mono text-slate-300">{r.max_slope_deg?.toFixed(0) || '18'}°</span>
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="flex items-center gap-1">
                              <span className="text-slate-500">Safe Corridor</span>
                              <span className="font-mono text-[#2DC77A]">{r.safe_corridor_pct || Math.round(r.safe_score * 100)}%</span>
                            </span>
                          </div>
                        </div>

                        {/* Travel Time & Distance (Google Maps style) */}
                        <div className="text-right shrink-0">
                          <div className={`text-base font-bold ${isSelected ? 'text-[#2B9EFF]' : 'text-white'}`}>
                            {formatDuration(r.estimated_time_min)}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {r.distance_km} km
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Clean Google Maps Style Start Navigation Button */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    setIsNavigating(true);
                    setIsDrivingMode(true);
                    setIsDemoPlaying(true);
                    setNavIndex(0);
                    const seg0 = activeRoute?.segments?.[0];
                    if (seg0) {
                      setCarPosition({
                        lat: seg0.lat,
                        lng: seg0.lon ?? seg0.lng,
                        risk: seg0.risk_level || 'GREEN',
                        slope: seg0.slope_mean ?? 14,
                        fos: seg0.fos_seismic ?? 1.5,
                        heading: 0
                      });
                    }
                    speak(`Starting navigation along ${activeRoute.title}`);
                    requestWakeLock();
                  }}
                  className="w-full py-2.5 rounded-full font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 bg-[#2B9EFF] hover:bg-[#2087de] text-white shadow-md active:scale-[0.99] cursor-pointer uppercase"
                >
                  <Navigation className="w-3.5 h-3.5 fill-white text-white" />
                  <span>Start Navigation ({mapStyle === '3d' ? '3D' : '2D'})</span>
                </button>
              </div>
            </div>
          )}

          {/* Reset waypoints */}
          <div className="mt-auto pt-4">
            <button
              onClick={() => {
                setStart(null); setEnd(null); setRouteResult(null);
                setStartQuery(''); setEndQuery(''); setIsNavigating(false);
                setCarPosition(null);
              }}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors block text-center mx-auto cursor-pointer"
            >
              Reset all waypoints
            </button>
          </div>
        </div>
      )}

      {/* ── MAP CONTAINER (2D Leaflet or 3D Cesium) ── */}
      <div className="flex-grow h-full relative w-full transition-all duration-500">

        {/* Top-Right Map Style Switcher (visible in all states) */}
        <div className="absolute top-4 right-4 z-30 pointer-events-auto">
          <div className="glass p-1.5 rounded-full flex gap-1 border border-white/10 shadow-2xl backdrop-blur-md bg-slate-950/80">
            <button
              onClick={() => { setMapStyle('dark'); localStorage.setItem('lithos_mapstyle', 'dark'); }}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${mapStyle === 'dark' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-white/60 hover:text-white'}`}
            >
              <MapIcon className="w-3.5 h-3.5" /> 2D Map
            </button>
            <button
              onClick={() => { setMapStyle('3d'); localStorage.setItem('lithos_mapstyle', '3d'); }}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${mapStyle === '3d' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-white/60 hover:text-white'}`}
            >
              <Globe className="w-3.5 h-3.5" /> 3D Globe
            </button>
          </div>
        </div>

        {/* ── Render 3D Cesium or 2D Leaflet ── */}
        <div className="absolute inset-0">
          {mapStyle === '3d' ? (
            <Suspense fallback={
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', background:'#050d1e', color:'#00C2FF', flexDirection:'column', gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', border:'2px solid rgba(0,194,255,0.2)', borderTopColor:'#00C2FF', animation:'spin 1s linear infinite' }} />
                <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' }}>Streaming 3D Mountain Terrain…</p>
              </div>
            }>
              <CesiumTerrain3DLazy
                region={selectedRegion}
                riskGrid={riskGrid}
                activeRunouts={activeRunouts}
                routeResult={routeResult}
                selectedRouteIdx={selectedRouteIdx}
                onSelectRoute={(idx) => setSelectedRouteIdx(idx)}
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
                onStartDemoSimulation={() => {
                  setIsNavigating(true);
                  setIsDrivingMode(true);
                  setIsDemoPlaying(true);
                }}
                onMapClick={(loc) => {
                  if (!start) {
                    setStart(loc);
                    setStartQuery(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
                  } else {
                    setEnd(loc);
                    setEndQuery(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
                  }
                }}
              />
            </Suspense>
          ) : (
            <MapContainer
              key={`${selectedRegion?.key || 'saferoute'}-${mapStyle}`}
              center={selectedRegion?.center || [27.33, 88.61]}
              zoom={12}
              preferCanvas={true}
              className="w-full h-full"
              zoomControl={false}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              />
              <MapEvents />

              {/* Heatmap Overlay */}
              {riskGrid && <HeatmapLayer riskGrid={riskGrid} opacity={0.75} />}

              {/* Active Debris Runout Zones */}
              {activeRunouts?.map((fan) => {
                const coords = fan?.fan_polygon?.coordinates?.[0];
                if (!coords || coords.length < 3) return null;
                return (
                  <Polygon
                    key={`fan-${fan.cell_id}`}
                    positions={coords.map(c => [c[1], c[0]])}
                    pathOptions={{
                      fillColor: '#FF3B30',
                      fillOpacity: 0.35,
                      color: '#FF3B30',
                      weight: 2,
                      dashArray: '5, 3'
                    }}
                  >
                    <Popup className="glass-popup">
                      <div className="p-2 text-white">
                        <p className="text-xs font-bold text-red-400">⚠ DEBRIS RUNOUT IMPACT ZONE</p>
                        <p className="text-[11px] text-white/80">FoS Seismic: {fan.fos_seismic ? Number(fan.fos_seismic).toFixed(2) : '<1.0'}</p>
                        <p className="text-[10px] text-white/60">A* router steers away from this slope</p>
                      </div>
                    </Popup>
                  </Polygon>
                );
              })}

              {/* Start & End Markers */}
              {!isNavigating && start && (
                <Marker
                  position={start}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = e.target.getLatLng();
                      setStart(ll);
                      setStartQuery(`${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`);
                    }
                  }}
                  icon={L.divIcon({
                    className: '',
                    html: `<div style="width:18px;height:18px;border-radius:50%;background:#00F0FF;border:3px solid white;box-shadow:0 0 10px #00F0FF;"></div>`
                  })}
                />
              )}
              {!isNavigating && end && (
                <Marker
                  position={end}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = e.target.getLatLng();
                      setEnd(ll);
                      setEndQuery(`${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`);
                    }
                  }}
                  icon={L.divIcon({
                    className: '',
                    html: `<div style="width:18px;height:18px;border-radius:50%;background:#FF3B30;border:3px solid white;box-shadow:0 0 10px #FF3B30;"></div>`
                  })}
                />
              )}

              {/* ── All 3 Route Polylines Rendered in 2D ── */}
              {routeResult?.routes ? (
                routeResult.routes.map((r, rIdx) => {
                  const isSelected = selectedRouteIdx === rIdx;
                  if (!r?.segments?.length) return null;
                  const pts = r.segments.filter(s => s && s.lat != null && (s.lon != null || s.lng != null)).map(s => [s.lat, s.lon ?? s.lng]);
                  return (
                    <Polyline
                      key={`route-${r.id || rIdx}`}
                      positions={pts}
                      eventHandlers={{ click: () => setSelectedRouteIdx(rIdx) }}
                      pathOptions={{
                        color: r.color || (r.risk_level === 'RED' ? '#EF4444' : r.risk_level === 'ORANGE' ? '#F59E0B' : '#10B981'),
                        weight: isSelected ? 6.5 : 4,
                        opacity: isSelected ? 0.95 : 0.6,
                        dashArray: isSelected ? '' : '8, 6'
                      }}
                    />
                  );
                })
              ) : (
                routeResult?.route?.segments && (
                  <Polyline
                    positions={routeResult.route.segments.filter(s => s && s.lat != null && (s.lon != null || s.lng != null)).map(s => [s.lat, s.lon ?? s.lng])}
                    pathOptions={{ color: '#00C2FF', weight: 6, opacity: 0.9 }}
                  />
                )
              )}

              {/* ── Directional 2D Vehicle Marker with Heading & Headlight Cone ── */}
              {carPosition && isNavigating && (() => {
                const heading = carPosition.heading || 0;
                const ringColor = carPosition.risk === 'RED' ? '#FF3B30' : carPosition.risk === 'ORANGE' ? '#FF9500' : '#00F0FF';
                return (
                  <Marker
                    position={[carPosition.lat, carPosition.lng]}
                    icon={L.divIcon({
                      className: '',
                      iconSize: [44, 44],
                      iconAnchor: [22, 22],
                      html: `
                        <div style="transform: rotate(${heading}deg); transform-origin: center center; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; position: relative;">
                          <!-- Headlight beam -->
                          <div style="position: absolute; top: -16px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 26px solid rgba(0, 240, 255, 0.28); filter: blur(2px); transform: rotate(180deg); pointer-events: none;"></div>
                          <!-- Outer pulse ring -->
                          <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; border: 2px solid ${ringColor}; opacity: 0.8; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                          <!-- Center driving cursor -->
                          <div style="width: 24px; height: 24px; background: #020617; border-radius: 50%; border: 2.5px solid ${ringColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px ${ringColor};">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="${ringColor}" stroke="white" stroke-width="1.5">
                              <polygon points="12 2 19 21 12 17 5 21 12 2" />
                            </svg>
                          </div>
                        </div>
                      `
                    })}
                  />
                );
              })()}

              <MapUpdater />
            </MapContainer>
          )}
        </div>

        {/* ── GOOGLE MAPS DRIVING NAVIGATION OVERLAY (Simple & Clean in Lithos Colors) ── */}
        {isNavigating && (
          <div className="absolute inset-0 pointer-events-none z-[1000] flex flex-col justify-between p-4 sm:p-6">

            {/* TOP BAR: Google Maps Style Turn-by-Turn Card */}
            <div className="w-full max-w-lg mx-auto pointer-events-auto animate-in slide-in-from-top duration-300">
              <div className="bg-[#0B3B24] border border-emerald-600/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    {renderManeuverIcon(currentManeuver?.type, currentManeuver?.modifier)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        {distToManeuver >= 1000
                          ? `${(distToManeuver / 1000).toFixed(1)} km`
                          : `${Math.round(distToManeuver)} m`}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-emerald-100 truncate">
                      {currentManeuver?.instruction || "Continue along mountain highway"}
                    </p>
                  </div>
                </div>

                {/* Exit Drive Button */}
                <button
                  onClick={() => {
                    setIsNavigating(false);
                    setIsDrivingMode(false);
                    releaseWakeLock();
                  }}
                  className="p-2 rounded-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white transition-colors shrink-0 cursor-pointer"
                  title="Exit Navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Landslide Hazard Subtle Banner if entering Red zone */}
            {currSeg?.risk_level === 'RED' && (
              <div className="w-full max-w-md mx-auto pointer-events-auto">
                <div className="bg-rose-950/90 border border-rose-500/60 rounded-xl p-2.5 shadow-xl backdrop-blur-xl flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-rose-300">Caution: Steep Scarp Sector</p>
                    <p className="text-xs text-white">Entering slope failure zone (FoS {currentFoS.toFixed(2)}). Drive with care.</p>
                  </div>
                </div>
              </div>
            )}

            {/* BOTTOM BAR: Google Maps Driving HUD (Simple & Clean in Lithos Colors) */}
            <div className="w-full max-w-xl mx-auto pointer-events-auto animate-in slide-in-from-bottom duration-300">
              <div className="bg-[#090d1c]/95 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex flex-col gap-3">

                {/* Top Row: Google Maps ETA & Car Telemetry */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-2.5">
                  <div>
                    <div className="text-2xl font-bold text-emerald-400 font-mono">
                      {formatDuration(remainingMin)}
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      {remainingKm.toFixed(1)} km · ETA {arrivalTime}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    {/* Speedometer */}
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-medium block">Speed</span>
                      <span className="text-sm font-bold text-white font-mono">{dynamicSpeedKmh} <span className="text-[10px] text-slate-400 font-normal">km/h</span></span>
                    </div>

                    {/* Slope Grade */}
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-medium block">Grade</span>
                      <span className="text-sm font-bold text-slate-200 font-mono">{currentSlope.toFixed(0)}°</span>
                    </div>

                    {/* Stability FoS */}
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-medium block">Stability</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        currentFoS < 1.05
                          ? 'bg-rose-500/15 text-rose-300'
                          : currentFoS < 1.30
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-300'
                      }`}>
                        FoS {currentFoS.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle Row: Clean Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.round(progressRatio * 100)}%` }}
                  />
                </div>

                {/* Bottom Row: Controls */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsDemoPlaying(!isDemoPlaying)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isDemoPlaying ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
                    </button>
                    <button
                      onClick={() => {
                        setNavIndex(0);
                        const s0 = activeRoute?.segments?.[0];
                        if (s0) setCarPosition({ lat: s0.lat, lng: s0.lon ?? s0.lng, risk: s0.risk_level || 'GREEN', slope: s0.slope_mean ?? 14, fos: s0.fos_seismic ?? 1.5, heading: 0 });
                        setIsDemoPlaying(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Restart"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDemoMuted(!demoMuted)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${demoMuted ? 'text-slate-500 hover:text-slate-300' : 'text-[#2B9EFF] hover:text-[#2B9EFF]'}`}
                      title={demoMuted ? "Unmute Voice" : "Mute Voice"}
                    >
                      {demoMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* 2D / 3D Mode Toggle */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => { setMapStyle('dark'); localStorage.setItem('lithos_mapstyle', 'dark'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${mapStyle !== '3d' ? 'bg-[#2B9EFF] text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      2D
                    </button>
                    <button
                      onClick={() => { setMapStyle('3d'); localStorage.setItem('lithos_mapstyle', '3d'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${mapStyle === '3d' ? 'bg-[#2B9EFF] text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      3D
                    </button>
                  </div>

                  {/* Speed Multiplier */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    {[1, 3, 8].map(s => (
                      <button
                        key={s}
                        onClick={() => setDemoSpeed(s)}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${demoSpeed === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* SOS + Blockage quick triggers outside nav overlay */}
        {isNavigating && (
          <>
            <SOSButton carPosition={carPosition} region={selectedRegion?.key} />
            <BlockageReport carPosition={carPosition} />
          </>
        )}

        {/* Route Risk Certificate Overlay */}
        {showCertificate && activeRoute && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-2xl z-[3000] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-slate-950 border border-slate-800 p-7 rounded-3xl max-w-md w-full shadow-2xl">
              <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4 flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <span>Route Safety Clearance</span>
              </h2>

              <div className="space-y-3 mb-6 text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Corridor</span>
                  <span className="font-bold text-white max-w-[220px] truncate">{startQuery} ➔ {endQuery}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Selected Route</span>
                  <span className="font-bold text-cyan-400">{activeRoute.title}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Distance & Grade</span>
                  <span className="font-bold text-white">{activeRoute.distance_km} km · Max {activeRoute.max_slope_deg}°</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Min Factor of Safety</span>
                  <span className={`font-mono font-black ${activeRoute.min_fos < 1.05 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    FoS {activeRoute.min_fos?.toFixed(2) || '1.45'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 text-[10px] text-slate-500">
                  <span>Certified: LITHOS A* Risk Engine</span>
                  <span>{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCertificate(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowCertificate(false);
                    setIsNavigating(false);
                    setIsDrivingMode(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20"
                >
                  Plan New Route
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SafeRoute;
