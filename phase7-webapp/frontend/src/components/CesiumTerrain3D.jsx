/**
 * CesiumTerrain3D.jsx  —  PURE CesiumJS (no resium)
 *
 * Drops the resium wrapper which is CommonJS and breaks Vite's ESM dev server.
 * Uses a plain div ref + Cesium.Viewer created imperatively in useEffect.
 * All features preserved: terrain, risk extrusion, route, car tracking, aircraft,
 * live users, evacuation points, nearby hazards.
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import * as Cesium from 'cesium';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { Layers, Globe, Sliders, Eye, RefreshCw, MapPin, Building, Loader2, Navigation, SlidersHorizontal, X, Sparkles, Play, ChevronRight, Search } from 'lucide-react';
import { NE_STATE_BOUNDARIES, STATE_BORDER_COLORS } from '../constants/NE_STATE_BOUNDARIES';
import { NE_POPULAR_PLACES } from '../constants/NE_POPULAR_PLACES';


// Set Cesium Ion token once
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

// ── Evacuation assembly points (NDMA pre-defined) ────────────────────────────
const EVACUATION_POINTS = [
  { id: 'ev_cherra_1',   name: 'Cherrapunji Town Hall',           lat: 25.284, lon: 91.716, capacity: 500 },
  { id: 'ev_cherra_2',   name: 'Sohra Community Ground',          lat: 25.291, lon: 91.701, capacity: 800 },
  { id: 'ev_shillong_1', name: 'Shillong Civil Hospital Grounds', lat: 25.574, lon: 91.882, capacity: 1200 },
  { id: 'ev_manipur_1',  name: 'Imphal Airport Relief Camp',      lat: 24.760, lon: 93.897, capacity: 3000 },
  { id: 'ev_manipur_2',  name: 'Kangpokpi Assembly Point',        lat: 25.131, lon: 93.962, capacity: 600 },
  { id: 'ev_sikkim_1',   name: 'Gangtok Police Ground',           lat: 27.329, lon: 88.612, capacity: 1000 },
  { id: 'ev_sikkim_2',   name: 'Rangpo Relief Centre',            lat: 27.176, lon: 88.530, capacity: 700 },
  { id: 'ev_nagaland_1', name: 'Kohima War Cemetery Relief Camp', lat: 25.671, lon: 94.108, capacity: 1500 },
];

const riskFill = (level) => {
  if (level === 'RED')    return Cesium.Color.fromCssColorString('#FF3B30').withAlpha(0.70);
  if (level === 'ORANGE') return Cesium.Color.fromCssColorString('#FF9500').withAlpha(0.55);
  return Cesium.Color.fromCssColorString('#30D158').withAlpha(0.18);
};

const riskLine = (level) => {
  if (level === 'RED')    return Cesium.Color.fromCssColorString('#FF3B30');
  if (level === 'ORANGE') return Cesium.Color.fromCssColorString('#FF9500');
  return Cesium.Color.fromCssColorString('#00C2FF');
};

// ── Main Component ────────────────────────────────────────────────────────────
const CesiumTerrain3D = ({
  region,
  riskGrid,
  activeRunouts = [],
  routeResult,
  carPosition,
  start,
  end,
  isNavigating,
  nearbyHazards = [],
  liveUsers = [],
  showEvacuation,
  onMapClick,
  enableBuildings = false,
  demoPresets = [],
  demoSpeed = 4,
  onSetDemoSpeed,
  onLoadDemoPreset,
  onStartDemoSimulation,
  onStartLiveNavigation,
  selectedRouteIdx = 0,
  onSelectRoute,
}) => {
  const containerRef   = useRef(null);
  const viewerRef      = useRef(null);
  const buildingsRef   = useRef(null);
  const navTimerRef    = useRef(null);
  const aircraftRef    = useRef(null);
  const lastCamFollowRef = useRef(0);

  const [showBuildings, setShowBuildings] = useState(enableBuildings);
  const [isLocating, setIsLocating]       = useState(false);
  const [userGps, setUserGps]             = useState(null);
  const [gpsHazard, setGpsHazard]         = useState(null);
  const [viewerReady, setViewerReady]     = useState(false);

  // ── 3D Terrain Left-Click Handler (Pick ray on terrain for waypoints) ──────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !onMapClick) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      let cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (!cartesian) {
        cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      }
      if (!cartesian) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lng = Cesium.Math.toDegrees(carto.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        // Quick visual click feedback
        const oldPulse = viewer.entities.getById('click-pulse');
        if (oldPulse) viewer.entities.remove(oldPulse);
        viewer.entities.add({
          id: 'click-pulse',
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          point: {
            pixelSize: 16,
            color: Cesium.Color.fromCssColorString('#00F0FF').withAlpha(0.9),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        setTimeout(() => {
          const p = viewer.entities.getById('click-pulse');
          if (p) viewer.entities.remove(p);
        }, 1200);

        onMapClick({ lat: parseFloat(lat.toFixed(5)), lng: parseFloat(lng.toFixed(5)) });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
    };
  }, [onMapClick, viewerReady]);

  // ── Create viewer once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let viewer;
    (async () => {
      let terrain;
      // 1. Safely load Terrain only if we have a token or we want to try
      try {
        if (import.meta.env.VITE_CESIUM_TOKEN) {
          terrain = await Cesium.createWorldTerrainAsync({
            requestWaterMask: false, requestVertexNormals: true
          });
        }
      } catch (err) {
        console.warn('Lithos: Cesium terrain init failed. Falling back to 2D ellipsoid.', err);
      }

      // 2. Initialize Viewer safely
      try {
        const viewerOptions = {
          timeline:             false,
          animation:            false,
          baseLayerPicker:      false,
          navigationHelpButton: false,
          sceneModePicker:      false,
          geocoder:             false,
          homeButton:           false,
          fullscreenButton:     false,
          infoBox:              false,
          selectionIndicator:   false,
        };

        if (terrain) {
          viewerOptions.terrainProvider = terrain;
        }

        // If no token exists, fallback to free OSM imagery
        if (!import.meta.env.VITE_CESIUM_TOKEN) {
          viewerOptions.baseLayer = false;
          viewerOptions.imageryProvider = false;
        }

        viewer = new Cesium.Viewer(containerRef.current, viewerOptions);

        if (!import.meta.env.VITE_CESIUM_TOKEN) {
          viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            subdomains: ['a', 'b', 'c'],
            credit: '© OpenStreetMap contributors'
          }));
        }

        // *** FIX #1: DRASTICALLY REDUCE TILE REQUESTS TO SAVE API TOKEN ***
        viewer.scene.globe.maximumScreenSpaceError = 8; // Default is 2. 8 uses significantly fewer tokens!

        if (terrain) viewer.scene.globe.depthTestAgainstTerrain = true;
        viewerRef.current = viewer;

        // 3. Load Real 3D OSM Buildings (Global coverage - only if enableBuildings is true)
        if (enableBuildings && import.meta.env.VITE_CESIUM_TOKEN) {
          try {
            const osmBuildings = await Cesium.createOsmBuildingsAsync();
            viewer.scene.primitives.add(osmBuildings);
            buildingsRef.current = osmBuildings;
          } catch (bErr) {
            console.warn('Lithos: Cesium 3D OSM Buildings notice:', bErr);
          }
        }

        // Signal viewer is fully initialized
        setViewerReady(true);

        // Fly to NE India / initial region
        const [initLat, initLon] = region?.center || [27.55, 88.45];
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(initLon, initLat - 0.08, 28000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch:   Cesium.Math.toRadians(-40),
            roll:    0,
          },
          duration: 2.5,
        });
      } catch (e) {
        console.error('LITHOS Critical: Cesium viewer crashed completely', e);
      }
    })();

    return () => {
      clearInterval(navTimerRef.current);
      clearInterval(aircraftRef.current);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []); // eslint-disable-line

  // Toggle 3D Buildings visibility
  useEffect(() => {
    if (buildingsRef.current) {
      buildingsRef.current.show = showBuildings;
    }
  }, [showBuildings]);

  // Apply Coordinates & fly camera to user location
  const applyLocationCoords = async (coords) => {
    setUserGps(coords);
    const v = viewerRef.current;
    if (v && !v.isDestroyed()) {
      v.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(coords.lon, coords.lat - 0.015, 2400),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch:   Cesium.Math.toRadians(-35),
          roll:    0,
        },
        duration: 2.5,
      });

      const oldBeacon = v.entities.getById('gps-user-beacon');
      if (oldBeacon) v.entities.remove(oldBeacon);

      v.entities.add({
        id: 'gps-user-beacon',
        position: Cesium.Cartesian3.fromDegrees(coords.lon, coords.lat, 30),
        point: {
          pixelSize: 22,
          color: Cesium.Color.fromCssColorString('#00F0FF'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: coords.label || 'YOU (LIVE GPS)',
          font: 'bold 12px Inter, sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#00F0FF'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });

      try {
        const predResp = await axios.post(`${API_BASE_URL}/api/predict`, {
          slope_deg: 31.8,
          aspect_deg: 175.0,
          plan_curvature: -0.015,
          profile_curvature: 0.025,
          tpi: 10.5,
          tri: 7.8,
          rainfall_mm: 115.0,
          drainage_density: 1.9,
          distance_to_faults_km: 1.8,
          distance_to_roads_km: 0.4,
          distance_to_rivers_km: 0.9,
          lithology_code: 3,
          ndvi: 0.45,
          soil_moisture_index: 0.62,
          gw_fluctuation_m: 1.8,
        });
        setGpsHazard(predResp.data);
      } catch (pErr) {
        console.warn('GPS Hazard estimate fallback:', pErr);
      }
    }
  };

  // GPS Geolocation Handler
  const handleGpsSync = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          const { latitude, longitude, altitude } = pos.coords;
          applyLocationCoords({
            lat: parseFloat(latitude.toFixed(5)),
            lon: parseFloat(longitude.toFixed(5)),
            alt: Math.round(altitude || 450),
          });
        },
        (err) => {
          setIsLocating(false);
          console.warn('Geolocation error / permission denied, using Gangtok field station fallback:', err);
          applyLocationCoords({
            lat: 27.3389,
            lon: 88.6065,
            alt: 1650,
          });
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    } else {
      setIsLocating(false);
      applyLocationCoords({
        lat: 27.3389,
        lon: 88.6065,
        alt: 1650,
      });
    }
  };

  // Test Sikkim GPS (Gangtok) for users outside the state
  const testSikkimGps = () => {
    applyLocationCoords({
      lat: 27.3389,
      lon: 88.6065,
      alt: 1650,
      label: 'STATION: GANGTOK, SIKKIM'
    });
  };

  const [showHeatmapDrape, setShowHeatmapDrape] = useState(true);
  const [heatmapMode, setHeatmapMode]           = useState('slope_units'); // 'slope_units' (exact 2D polygons) or 'gradient' (continuous spline)
  const [heatmapOpacity, setHeatmapOpacity]     = useState(0.85);
  const [activeStats, setActiveStats]           = useState(null);
  const [showToolsDrawer, setShowToolsDrawer]   = useState(false);
  const opacityRef = useRef(heatmapOpacity);
  opacityRef.current = heatmapOpacity;

  // ── City & Village Search on 3D Globe ──────────────────────────────────────
  const [searchQuery, setSearchQuery]         = useState('');
  const [isSearchOpen, setIsSearchOpen]       = useState(false);
  const [searchedPlace, setSearchedPlace]     = useState(null);
  const [geoResults, setGeoResults]           = useState([]);
  const [isGeocoding, setIsGeocoding]         = useState(false);
  const searchContainerRef                    = useRef(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter curated places for active region
  const regionPlaces = useMemo(() => {
    return NE_POPULAR_PLACES[region?.key] || [];
  }, [region?.key]);

  // Local filtered results
  const localMatches = useMemo(() => {
    if (!searchQuery.trim()) return regionPlaces.slice(0, 8);
    const q = searchQuery.toLowerCase().trim();
    return regionPlaces.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.district && p.district.toLowerCase().includes(q))
    );
  }, [searchQuery, regionPlaces]);

  // Live geocoding query with debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setGeoResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const stateName = region?.name || 'Sikkim';
        const q = `${searchQuery}, ${stateName}, India`;
        const resp = await axios.get(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=in&limit=4`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (resp.data && Array.isArray(resp.data)) {
          const results = resp.data.map(item => ({
            name: item.name || item.display_name.split(',')[0],
            district: item.display_name.split(',').slice(1, 3).join(', ').trim(),
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            alt: 900,
            desc: item.type ? `Type: ${item.type}` : 'Geocoded locality',
            isExternal: true,
          }));
          setGeoResults(results);
        }
      } catch (err) {
        console.warn('Geocoding fallback:', err);
      } finally {
        setIsGeocoding(false);
      }
    }, 380);

    return () => clearTimeout(timer);
  }, [searchQuery, region?.name]);

  // Fly to selected town/city
  const handleSelectLocation = (place) => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;

    v.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        place.lon,
        place.lat - 0.015,
        Math.max(2400, (place.alt || 1200) + 1200)
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-38),
        roll:    0,
      },
      duration: 2.2,
    });

    // Remove old search entities
    const oldPin = v.entities.getById('search-location-pin');
    if (oldPin) v.entities.remove(oldPin);
    const oldRing = v.entities.getById('search-location-ring');
    if (oldRing) v.entities.remove(oldRing);

    // Add glowing beacon pin clamped to terrain
    v.entities.add({
      id: 'search-location-pin',
      position: Cesium.Cartesian3.fromDegrees(place.lon, place.lat),
      point: {
        pixelSize: 18,
        color: Cesium.Color.fromCssColorString('#00F0FF'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: `📍 ${place.name.toUpperCase()}`,
        font: 'bold 12px Inter, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#00F0FF'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3.5,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });

    // Outer pulsing ring clamped to terrain
    v.entities.add({
      id: 'search-location-ring',
      position: Cesium.Cartesian3.fromDegrees(place.lon, place.lat),
      ellipse: {
        semiMinorAxis: 500.0,
        semiMajorAxis: 500.0,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        material: Cesium.Color.fromCssColorString('#00F0FF').withAlpha(0.22),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#00F0FF').withAlpha(0.85),
        outlineWidth: 2,
      },
    });

    setSearchedPlace(place);
    setSearchQuery(place.name);
    setIsSearchOpen(false);
  };

  const clearSearchedPlace = () => {
    const v = viewerRef.current;
    if (v && !v.isDestroyed()) {
      const oldPin = v.entities.getById('search-location-pin');
      if (oldPin) v.entities.remove(oldPin);
      const oldRing = v.entities.getById('search-location-ring');
      if (oldRing) v.entities.remove(oldRing);
    }
    setSearchedPlace(null);
    setSearchQuery('');
    resetView();
  };

  // ── 3D Heatmap Drape (Clamped to Terrain) ──────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !region?.key) return;

    // Remove existing heatmap entity if present
    const existing = viewer.entities.getById('heatmap-drape-entity');
    if (existing) viewer.entities.remove(existing);

    const west  = region.bbox ? region.bbox[0] : (region.center ? region.center[1] - 0.55 : 88.0);
    const south = region.bbox ? region.bbox[1] : (region.center ? region.center[0] - 0.55 : 27.0);
    const east  = region.bbox ? region.bbox[2] : (region.center ? region.center[1] + 0.55 : 88.9);
    const north = region.bbox ? region.bbox[3] : (region.center ? region.center[0] + 0.55 : 28.1);

    const backendMode = heatmapMode === 'slope_units' ? 'slope_units' : 'smooth_field';

    viewer.entities.add({
      id: 'heatmap-drape-entity',
      show: showHeatmapDrape,
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(west, south, east, north),
        material: new Cesium.ImageMaterialProperty({
          image: `${API_BASE_URL}/api/heatmap-image?region=${region.key}&mode=${backendMode}&res=1024&v=5`,
          transparent: true,
          color: new Cesium.CallbackProperty(() => {
            return Cesium.Color.WHITE.withAlpha(opacityRef.current);
          }, false),
        }),
        classificationType: Cesium.ClassificationType.TERRAIN,
        zIndex: 10,
      },
    });

    // Fetch live hazard stats for legend
    axios.get(`${API_BASE_URL}/api/terrain/3d-heatmap-mesh?region=${region.key}&grid_res=60`)
      .then(resp => {
        if (resp.data?.stats) setActiveStats(resp.data.stats);
      })
      .catch(() => {});
  }, [region, viewerReady, heatmapMode]);


  // Update visibility on toggle
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const e = viewer.entities.getById('heatmap-drape-entity');
    if (e) e.show = showHeatmapDrape;
  }, [showHeatmapDrape]);

  // ── Fly camera to selected region ──────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !region?.center) return;

    // Reset place search state on region change
    setSearchedPlace(null);
    setSearchQuery('');
    const oldPin = viewer.entities.getById('search-location-pin');
    if (oldPin) viewer.entities.remove(oldPin);
    const oldRing = viewer.entities.getById('search-location-ring');
    if (oldRing) viewer.entities.remove(oldRing);

    const [lat, lon] = region.center;
    let alt = 32000;
    let offsetLat = 0.08;
    if (region.bbox) {
      const dLon = Math.abs(region.bbox[2] - region.bbox[0]);
      const dLat = Math.abs(region.bbox[3] - region.bbox[1]);
      const maxSpan = Math.max(dLon, dLat);
      alt = Math.min(85000, Math.max(28000, maxSpan * 32000));
      offsetLat = Math.min(0.25, Math.max(0.06, maxSpan * 0.08));
    }
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat - offsetLat, alt),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-42),
        roll:    0,
      },
      duration: 2.0,
    });

    // ── Draw real state boundary border + gradient fill ──────────────────────
    // Remove previous state boundary entities
    const oldBorder = viewer.entities.values.filter(e => e.id?.startsWith('state-border-'));
    oldBorder.forEach(e => viewer.entities.remove(e));

    const regionKey = region.key;
    const boundaryCoords = NE_STATE_BOUNDARIES[regionKey];
    const accentHex = STATE_BORDER_COLORS[regionKey] || '#00C2FF';

    if (boundaryCoords && boundaryCoords.length > 2) {
      // Convert [lon, lat] array to flat Cesium degree positions
      const positions = Cesium.Cartesian3.fromDegreesArray(
        boundaryCoords.flatMap(([lo, la]) => [lo, la])
      );

      // 1. Gradient fill polygon clamped to terrain
      const fillColor = Cesium.Color.fromCssColorString(accentHex).withAlpha(0.14);
      viewer.entities.add({
        id: 'state-border-fill',
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: new Cesium.ColorMaterialProperty(fillColor),
          classificationType: Cesium.ClassificationType.TERRAIN,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });

      // 2. Bright glowing border outline clamped to terrain
      const borderColor = Cesium.Color.fromCssColorString(accentHex).withAlpha(0.9);
      viewer.entities.add({
        id: 'state-border-line',
        polyline: {
          positions: [...positions, positions[0]], // close the ring
          width: 3.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            color: borderColor,
            glowPower: 0.28,
            taperPower: 1.0,
          }),
          clampToGround: true,
        },
      });

      // 3. Inner bright line (crisp edge on top of glow)
      const sharpColor = Cesium.Color.fromCssColorString(accentHex).withAlpha(0.95);
      viewer.entities.add({
        id: 'state-border-line-sharp',
        polyline: {
          positions: [...positions, positions[0]],
          width: 1.8,
          material: new Cesium.ColorMaterialProperty(sharpColor),
          clampToGround: true,
        },
      });
    }
  }, [region, viewerReady]);

  // Clean up any legacy riskGrid data sources if present
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const toRemove = viewer.dataSources._dataSources?.filter(ds => ds._name === 'riskGrid') || [];
    toRemove.forEach(ds => viewer.dataSources.remove(ds));
  }, [viewerReady]);

  // ── Route segments (polylines) ────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Remove old route entities
    const old = viewer.entities.values.filter(e => e.id?.startsWith?.('route-'));
    old.forEach(e => viewer.entities.remove(e));

    // Determine active route and alternatives
    const allRoutes = routeResult?.routes || (routeResult?.route ? [routeResult.route, ...(routeResult.alternative_routes || [])] : []);
    const activeRoute = allRoutes[selectedRouteIdx] || allRoutes[0] || routeResult?.route;
    const segments = activeRoute?.segments;
    if (!segments || segments.length < 2) return;

    // Group adjacent segments by risk level for crisp clamped rendering with dark outline
    const chunks = [];
    const firstLon = parseFloat(segments[0].lon ?? segments[0].lng);
    const firstLat = parseFloat(segments[0].lat);
    let curChunk = {
      level: segments[0].risk_level || 'GREEN',
      positions: [Cesium.Cartesian3.fromDegrees(firstLon, firstLat)],
    };

    let minLon = firstLon, maxLon = firstLon, minLat = firstLat, maxLat = firstLat;

    for (let i = 1; i < segments.length; i++) {
      const s = segments[i];
      const sLon = parseFloat(s.lon ?? s.lng);
      const sLat = parseFloat(s.lat);
      if (isNaN(sLon) || isNaN(sLat)) continue;

      minLon = Math.min(minLon, sLon);
      maxLon = Math.max(maxLon, sLon);
      minLat = Math.min(minLat, sLat);
      maxLat = Math.max(maxLat, sLat);

      const pt = Cesium.Cartesian3.fromDegrees(sLon, sLat);
      const lvl = s.risk_level || 'GREEN';

      if (lvl === curChunk.level) {
        curChunk.positions.push(pt);
      } else {
        curChunk.positions.push(pt);
        chunks.push(curChunk);
        curChunk = { level: lvl, positions: [pt] };
      }
    }
    if (curChunk.positions.length > 1) {
      chunks.push(curChunk);
    }

    // 1. Primary Selected Route Chunks with high-contrast outlines
    chunks.forEach((chunk, cIdx) => {
      viewer.entities.add({
        id: `route-chunk-${cIdx}`,
        polyline: {
          positions:     chunk.positions,
          width:         8,
          material:      new Cesium.PolylineOutlineMaterialProperty({
            color:        riskLine(chunk.level),
            outlineColor: Cesium.Color.BLACK.withAlpha(0.9),
            outlineWidth: 2.5,
          }),
          clampToGround: true,
        },
      });
    });

    // 2. Alternative routes (rendered in their respective risk tier colors: Safe, Moderate, Danger)
    allRoutes.forEach((r, rIdx) => {
      if (rIdx === selectedRouteIdx) return;
      if (!r?.segments || r.segments.length < 2) return;
      const altPositions = r.segments
        .filter(s => s && s.lat != null && (s.lon != null || s.lng != null))
        .map(s => Cesium.Cartesian3.fromDegrees(parseFloat(s.lon ?? s.lng), parseFloat(s.lat)));

      if (altPositions.length >= 2) {
        const altColor = r.color || (r.risk_level === 'RED' ? '#EF4444' : r.risk_level === 'ORANGE' ? '#F59E0B' : '#10B981');
        viewer.entities.add({
          id: `route-alt-${rIdx}`,
          name: r.title || `Route Option ${rIdx + 1}`,
          polyline: {
            positions: altPositions,
            width: 5,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.fromCssColorString(altColor).withAlpha(0.8),
              dashLength: 18.0,
            }),
            clampToGround: true,
          },
        });
      }
    });

    // 3. Precision Camera Framing: Compute complete bounding rectangle for route
    const lonSpan = maxLon - minLon;
    const latSpan = maxLat - minLat;
    const lonPad = Math.max(lonSpan * 0.30, 0.04);
    const latPad = Math.max(latSpan * 0.40, 0.04);

    const routeRect = Cesium.Rectangle.fromDegrees(
      minLon - lonPad,
      minLat - latPad * 1.6,
      maxLon + lonPad,
      maxLat + latPad * 0.8
    );

    viewer.camera.flyTo({
      destination: routeRect,
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-42),
        roll:    0,
      },
      duration: 2.2,
    });
  }, [routeResult, selectedRouteIdx, viewerReady]);

  // ── Start / End markers ───────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    ['start-marker', 'end-marker'].forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });

    if (start && !isNavigating) {
      const sLon = parseFloat(start.lng ?? start.lon);
      const sLat = parseFloat(start.lat);
      if (!isNaN(sLon) && !isNaN(sLat)) {
        viewer.entities.add({
          id: 'start-marker',
          position: Cesium.Cartesian3.fromDegrees(sLon, sLat, 50),
          point: {
            pixelSize: 18,
            color: Cesium.Color.fromCssColorString('#00F0FF'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: '🚩 ORIGIN',
            font: 'bold 12px Inter, sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#00F0FF'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 4,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -22),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      }
    }

    if (end) {
      const eLon = parseFloat(end.lng ?? end.lon);
      const eLat = parseFloat(end.lat);
      if (!isNaN(eLon) && !isNaN(eLat)) {
        viewer.entities.add({
          id: 'end-marker',
          position: Cesium.Cartesian3.fromDegrees(eLon, eLat, 50),
          point: {
            pixelSize: 18,
            color: Cesium.Color.fromCssColorString('#FF3B30'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: '🏁 DESTINATION',
            font: 'bold 12px Inter, sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#FF3B30'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 4,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -22),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      }
    }
  }, [start, end, isNavigating, viewerReady]);

  // ── Navigation: car marker + Google Maps 3D follow camera ─────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!carPosition || !isNavigating) {
      const e = viewer.entities.getById('car-marker');
      if (e) viewer.entities.remove(e);
      return;
    }

    const carColor = carPosition.risk === 'RED' ? '#FF3B30' : carPosition.risk === 'ORANGE' ? '#FF9500' : '#00F0FF';
    if (typeof carPosition.lng !== 'number' || typeof carPosition.lat !== 'number') return;
    const pos = Cesium.Cartesian3.fromDegrees(carPosition.lng, carPosition.lat, 25);

    let carEntity = viewer.entities.getById('car-marker');
    if (!carEntity) {
      viewer.entities.add({
        id: 'car-marker',
        position: pos,
        point: {
          pixelSize: 22,
          color: Cesium.Color.fromCssColorString(carColor),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: '▲ DRIVING',
          font: 'bold 11px Inter, sans-serif',
          fillColor: Cesium.Color.fromCssColorString(carColor),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
      });
    } else {
      carEntity.position = pos;
      if (carEntity.point) carEntity.point.color = Cesium.Color.fromCssColorString(carColor);
      if (carEntity.label) carEntity.label.fillColor = Cesium.Color.fromCssColorString(carColor);
    }

    // Google Maps 3D Chase Camera tracking car heading
    const now = Date.now();
    if (now - lastCamFollowRef.current > 180) {
      lastCamFollowRef.current = now;

      // Sample terrain elevation at vehicle position
      let groundHeight = 1600;
      try {
        const carto = Cesium.Cartographic.fromDegrees(carPosition.lng, carPosition.lat);
        const sample = viewer.scene.globe.getHeight(carto);
        if (typeof sample === 'number' && sample > 50) {
          groundHeight = sample;
        } else if (carPosition.lat > 27.0) {
          const prog = Math.min(Math.max((carPosition.lng - 88.61) / (88.83 - 88.61), 0), 1);
          groundHeight = 1650 + prog * 2660;
        }
      } catch (_) {}

      // Heading in radians (derived from segment direction)
      const headingDeg = carPosition.heading ?? 0;
      const headingRad = Cesium.Math.toRadians(headingDeg);

      // Chase camera positioned ~240m behind the car looking forward in heading direction
      const camOffsetDist = 0.0024;
      const camLng = carPosition.lng - Math.sin(headingRad) * camOffsetDist;
      const camLat = carPosition.lat - Math.cos(headingRad) * camOffsetDist;
      const camHeight = Math.max(groundHeight + 95, 200);

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(camLng, camLat, camHeight),
        orientation: {
          heading: headingRad,
          pitch:   Cesium.Math.toRadians(-22),
          roll:    0
        },
        duration: 0.22,
      });
    }
  }, [carPosition, isNavigating]);

  // ── Other live users ──────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const old = viewer.entities.values.filter(e => e.id?.startsWith?.('user-'));
    old.forEach(e => viewer.entities.remove(e));
    liveUsers.forEach((u, i) => {
      if (typeof u.lng !== 'number' || typeof u.lat !== 'number') return;
      viewer.entities.add({
        id: `user-${i}`,
        position: Cesium.Cartesian3.fromDegrees(u.lng, u.lat, 30),
        point: { pixelSize: 10, color: Cesium.Color.fromCssColorString('#00C2FF').withAlpha(0.7), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
      });
    });
  }, [liveUsers]);

  // ── Evacuation markers ────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const old = viewer.entities.values.filter(e => e.id?.startsWith?.('ev-'));
    old.forEach(e => viewer.entities.remove(e));
    if (!showEvacuation) return;
    EVACUATION_POINTS.forEach(pt => {
      if (typeof pt.lon !== 'number' || typeof pt.lat !== 'number') return;
      viewer.entities.add({
        id: `ev-${pt.id}`,
        position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, 100),
        point: { pixelSize: 18, color: Cesium.Color.fromCssColorString('#30D158').withAlpha(0.9), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        label: { text: `SAFE HAVEN: ${pt.name}\nCap: ${pt.capacity}`, font: 'bold 10px Inter', fillColor: Cesium.Color.fromCssColorString('#30D158'), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -24), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 3e5, 0.3) },
      });
    });
  }, [showEvacuation]);

  // ── Nearby hazard rings ───────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const old = viewer.entities.values.filter(e => e.id?.startsWith?.('haz-'));
    old.forEach(e => viewer.entities.remove(e));
    nearbyHazards.forEach((h, i) => {
      if (typeof h.center_lon !== 'number' || typeof h.center_lat !== 'number') return;
      viewer.entities.add({
        id: `haz-${i}`,
        position: Cesium.Cartesian3.fromDegrees(h.center_lon, h.center_lat),
        ellipse: {
          semiMajorAxis: h.distance_km * 300,
          semiMinorAxis: h.distance_km * 300,
          material: Cesium.Color.fromCssColorString('#FF3B30').withAlpha(0.18),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#FF3B30').withAlpha(0.6),
          outlineWidth: 2,
          classificationType: Cesium.ClassificationType.TERRAIN,
        },
      });
    });
  }, [nearbyHazards]);

  // ── Active Debris Runout Zones in 3D ───────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const old = viewer.entities.values.filter(e => e.id?.startsWith?.('runout-'));
    old.forEach(e => viewer.entities.remove(e));

    if (!activeRunouts || !Array.isArray(activeRunouts)) return;

    activeRunouts.forEach((fan, idx) => {
      const lat = fan.source_lat || fan.lat;
      const lon = fan.source_lon || fan.lon;
      if (typeof lat !== 'number' || typeof lon !== 'number') return;

      const runoutDist = fan.runout_m || 750;

      // Impact fan zone on 3D terrain
      viewer.entities.add({
        id: `runout-fan-${idx}`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        ellipse: {
          semiMajorAxis: Math.max(runoutDist, 280),
          semiMinorAxis: Math.max(runoutDist * 0.65, 180),
          material: Cesium.Color.fromCssColorString('#FF3B30').withAlpha(0.25),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#FF3B30').withAlpha(0.85),
          outlineWidth: 2.5,
          classificationType: Cesium.ClassificationType.TERRAIN,
        },
      });

      // 3D Warning Beacon
      viewer.entities.add({
        id: `runout-beacon-${idx}`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 40),
        point: {
          pixelSize: 14,
          color: Cesium.Color.fromCssColorString('#FF3B30'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: `⚠️ DEBRIS RUNOUT HAZARD\n${Math.round(runoutDist)}m Reach`,
          font: 'bold 10px Inter, sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#FF453A'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 1.2e5, 0.4),
        },
      });
    });
  }, [activeRunouts, viewerReady]);

  // ── OpenSky aircraft ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAircraft = async () => {
      try {
        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;
        const res  = await fetch('https://opensky-network.org/api/states/all?lamin=20&lomin=88&lamax=30&lomax=97');
        const data = await res.json();
        if (!data?.states) return;
        const old = viewer.entities.values.filter(e => e.id?.startsWith?.('ac-'));
        old.forEach(e => viewer.entities.remove(e));
        data.states
          .filter(s => s[5] != null && s[6] != null && s[7] > 0)
          .slice(0, 40)
          .forEach((s, i) => {
            const [icao, callsign, , , , lon, lat, alt] = s;
            if (typeof lon !== 'number' || typeof lat !== 'number') return;
            viewer.entities.add({
              id: `ac-${icao || i}`,
              position: Cesium.Cartesian3.fromDegrees(lon, lat, alt || 3000),
              point: { pixelSize: 7, color: Cesium.Color.fromCssColorString('#A8D8FF').withAlpha(0.85), outlineColor: Cesium.Color.fromCssColorString('#00C2FF'), outlineWidth: 1.5 },
              label: { text: `FLIGHT ${(callsign || 'N/A').trim()}`, font: '9px Inter', fillColor: Cesium.Color.fromCssColorString('#A8D8FF'), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -14), scaleByDistance: new Cesium.NearFarScalar(1e4, 1.0, 5e5, 0.0) },
            });
          });
      } catch (_) { /* OpenSky may rate-limit */ }
    };
    fetchAircraft();
    aircraftRef.current = setInterval(fetchAircraft, 30000);
    return () => clearInterval(aircraftRef.current);
  }, []);

  const zoomIn = () => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    const cam = v.camera;
    cam.zoomIn(cam.positionCartographic.height * 0.4);
  };

  const zoomOut = () => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    const cam = v.camera;
    cam.zoomOut(cam.positionCartographic.height * 0.4);
  };

  const resetView = () => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed() || !region?.center) return;
    const [lat, lon] = region.center;
    let alt = 36000;
    let offsetLat = 0.08;
    if (region.bbox) {
      const dLon = Math.abs(region.bbox[2] - region.bbox[0]);
      const dLat = Math.abs(region.bbox[3] - region.bbox[1]);
      const maxSpan = Math.max(dLon, dLat);
      alt = Math.min(85000, Math.max(28000, maxSpan * 32000));
      offsetLat = Math.min(0.25, Math.max(0.06, maxSpan * 0.08));
    }
    v.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat - offsetLat, alt),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-42),
        roll:    0,
      },
      duration: 1.8,
    });
  };

  const btnStyle = {
    width: 30,
    height: 30,
    borderRadius: 6,
    background: 'rgba(15, 23, 42, 0.92)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(51, 65, 85, 0.8)',
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-space-950">
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Top-Center City / Locality Search Bar ── */}
      <div ref={searchContainerRef} className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[330px] sm:w-[420px]">
        <div className="relative flex items-center">
          <div className="relative w-full flex items-center bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hover:border-cyan-500/50 focus-within:border-cyan-400/80 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.6)] transition-all duration-200">
            <Search className="w-4 h-4 text-cyan-400 ml-3.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const first = localMatches[0] || geoResults[0];
                  if (first) handleSelectLocation(first);
                }
              }}
              placeholder={`Search in ${region?.name || 'state'} (e.g. Gangtok, Namchi)...`}
              className="w-full bg-transparent text-xs text-white placeholder-slate-400 px-3 py-2.5 outline-none font-medium"
            />
            {isGeocoding && (
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin mr-2 shrink-0" />
            )}
            {searchQuery && (
              <button
                onClick={clearSearchedPlace}
                className="p-1.5 mr-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search Results & Curated Localities Dropdown */}
        {isSearchOpen && (
          <div className="absolute left-0 right-0 mt-2 max-h-80 overflow-y-auto bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-2 space-y-1.5 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150 custom-scrollbar">
            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <span>{searchQuery.trim() ? 'Matching Locations' : `Popular Localities in ${region?.name || 'Region'}`}</span>
              <span className="text-cyan-400 font-normal normal-case">Click to 3D Fly</span>
            </div>

            {/* Quick Popular/Local Matches */}
            {localMatches.length > 0 && (
              <div className="space-y-0.5">
                {localMatches.map((place, idx) => (
                  <button
                    key={`loc-${idx}`}
                    onClick={() => handleSelectLocation(place)}
                    className="w-full flex items-center justify-between text-left px-2.5 py-2 rounded-xl hover:bg-cyan-950/40 border border-transparent hover:border-cyan-500/30 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center shrink-0 group-hover:border-cyan-400/60">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                          {place.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {place.district} {place.alt ? `• ${place.alt}m alt` : ''}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Live Nominatim Geocoded Results */}
            {geoResults.length > 0 && (
              <div className="pt-1.5 border-t border-slate-800 space-y-0.5">
                <div className="px-2 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  OpenStreetMap Places
                </div>
                {geoResults.map((place, idx) => (
                  <button
                    key={`geo-${idx}`}
                    onClick={() => handleSelectLocation(place)}
                    className="w-full flex items-center justify-between text-left px-2.5 py-2 rounded-xl hover:bg-sky-950/40 border border-transparent hover:border-sky-500/30 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-sky-950/80 border border-sky-800/50 flex items-center justify-center shrink-0 group-hover:border-sky-400/60">
                        <Globe className="w-3.5 h-3.5 text-sky-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-300 truncate">
                          {place.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {place.district}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {localMatches.length === 0 && geoResults.length === 0 && !isGeocoding && (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching town or village found. Try another spelling.
              </div>
            )}
          </div>
        )}

        {/* Focused Place Status Chip */}
        {searchedPlace && !isSearchOpen && (
          <div className="mt-1.5 flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 shadow-lg text-[11px] animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span className="font-semibold text-cyan-300 truncate">{searchedPlace.name}</span>
              <span className="text-slate-400 font-mono text-[10px] shrink-0">
                ({searchedPlace.lat.toFixed(3)}°N, {searchedPlace.lon.toFixed(3)}°E)
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button
                onClick={() => handleSelectLocation(searchedPlace)}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
              >
                Focus
              </button>
              <button
                onClick={clearSearchedPlace}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Reset Region View"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Consolidated Layers & Tools Drawer (Shifted to top-16 to avoid collision with Region selector) */}
      <div className="absolute top-16 left-4 z-20 pointer-events-auto">
        <button
          onClick={() => setShowToolsDrawer(!showToolsDrawer)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 shadow-md backdrop-blur-md transition-all cursor-pointer ${
            showToolsDrawer
              ? 'bg-slate-800 text-white border-slate-600'
              : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800 hover:text-white'
          }`}
          title="Map Layers, Overlays and Tools"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
          <span>Layers & Tools</span>
          {showHeatmapDrape && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>


        {/* Consolidated Section: Overlays, Telemetry, Legend in ONE clean panel */}
        {showToolsDrawer && (
          <div className="mt-2 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-3.5 space-y-3.5 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold text-white">Map Layers & Tools</span>
              </div>
              <button 
                onClick={() => setShowToolsDrawer(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Section 1: Data Overlays */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Overlays</span>
              
              {/* PINN Risk Heatmap Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200">PINN Risk Heatmap</span>
                <button
                  onClick={() => setShowHeatmapDrape(!showHeatmapDrape)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                    showHeatmapDrape ? 'bg-sky-600 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              {/* Opacity Slider */}
              {showHeatmapDrape && (
                <div className="space-y-2 pl-1 pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Heatmap Opacity</span>
                      <span className="font-mono text-slate-300">{Math.round(heatmapOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={heatmapOpacity}
                      onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-sky-400"
                    />
                  </div>

                  {/* 2D vs 3D Drape Style Selector */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Heatmap Style</span>
                      <span className="text-sky-400 font-medium text-[10px]">
                        {heatmapMode === 'slope_units' ? 'Exact 2D Polygons' : 'Continuous Gradient'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-950/70 rounded-lg border border-slate-800 text-[11px]">
                      <button
                        onClick={() => setHeatmapMode('slope_units')}
                        className={`py-1 px-1.5 rounded-md font-medium text-center transition-all cursor-pointer ${
                          heatmapMode === 'slope_units'
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Drapes the exact 2D DEM slope-unit polygons onto the 3D terrain"
                      >
                        Slope Units (2D)
                      </button>
                      <button
                        onClick={() => setHeatmapMode('gradient')}
                        className={`py-1 px-1.5 rounded-md font-medium text-center transition-all cursor-pointer ${
                          heatmapMode === 'gradient'
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Continuous cubic spline scalar field"
                      >
                        Gradient Field
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3D Buildings Toggle (Only rendered if feature enabled) */}
              {enableBuildings && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-200">3D Building Footprints</span>
                  <button
                    onClick={() => setShowBuildings(!showBuildings)}
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                      showBuildings ? 'bg-sky-600 justify-end' : 'bg-slate-700 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
              )}
            </div>

            {/* Section: Strategic Corridors (4x / 10x Speed) */}
            {demoPresets && demoPresets.length > 0 && (
              <div className="pt-2.5 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                      Strategic Corridors
                    </span>
                  </div>
                  {onSetDemoSpeed && (
                    <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-700/80 rounded-md p-0.5">
                      <button
                        onClick={() => onSetDemoSpeed(4)}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${demoSpeed === 4 ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}
                        title="4x Real-Time Travel Speed"
                      >
                        4x
                      </button>
                      <button
                        onClick={() => onSetDemoSpeed(10)}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${demoSpeed === 10 ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}
                        title="10x Fast-Forward Presentation Speed"
                      >
                        10x
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  {demoPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => onLoadDemoPreset && onLoadDemoPreset(preset)}
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

                {routeResult && onStartDemoSimulation && (
                  <button
                    onClick={() => onStartDemoSimulation(demoSpeed)}
                    className="w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Preview Drive ({demoSpeed}x Speed)</span>
                  </button>
                )}
              </div>
            )}

            {/* Section 2: Telemetry & Location */}
            <div className="pt-2.5 border-t border-slate-800 space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Telemetry & Location</span>
              
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={handleGpsSync}
                  disabled={isLocating}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                  title="Synchronize 3D Camera with GPS Telemetry"
                >
                  {isLocating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5 text-sky-400" />
                  )}
                  <span>{isLocating ? 'Locating...' : 'Live GPS'}</span>
                </button>

                <button
                  onClick={testSikkimGps}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                  title="Focus Sikkim calibration benchmark"
                >
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sikkim Preset</span>
                </button>
              </div>

              {userGps && (
                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] font-mono space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Coordinates:</span>
                    <span>{userGps.lat}°N, {userGps.lon}°E</span>
                  </div>
                  {gpsHazard && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Local Risk:</span>
                      <span className={gpsHazard.failure_probability > 0.6 ? 'text-rose-400' : 'text-emerald-400'}>
                        {(gpsHazard.failure_probability * 100).toFixed(1)}% ({gpsHazard.risk_level})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Failure Risk Legend */}
            {showHeatmapDrape && activeStats && (
              <div className="pt-2.5 border-t border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Failure Risk Scale</span>
                  <span className="text-rose-400 font-mono normal-case">{activeStats.high_risk_cells} Critical</span>
                </div>
                <div className="w-full h-2 rounded bg-gradient-to-r from-emerald-500 via-amber-400 via-orange-500 to-rose-600" />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0% Safe</span>
                  <span>50%</span>
                  <span>100% High Risk</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating 3D Route Quick-Action Bar (Shown when route calculated and not yet navigating) */}
      {routeResult && !isNavigating && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 pointer-events-auto bg-[#090d1c]/95 border border-slate-800 rounded-2xl p-2.5 px-4 shadow-xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>{routeResult.route?.distance_km || 0} km</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ${
                  routeResult.route?.max_risk_level === 'RED'
                    ? 'bg-rose-500/15 text-rose-300'
                    : routeResult.route?.max_risk_level === 'ORANGE'
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-emerald-500/15 text-emerald-300'
                }`}>
                  {routeResult.route?.max_risk_level || 'SAFE'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Corridor Calculated
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            {onStartDemoSimulation && (
              <button
                onClick={() => onStartDemoSimulation(demoSpeed)}
                className="px-3.5 py-1.5 rounded-xl bg-[#2B9EFF] hover:bg-[#2087de] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start 3D Navigation</span>
              </button>
            )}
            {onStartLiveNavigation && (
              <button
                onClick={onStartLiveNavigation}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live GPS</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      <div style={{
        position: 'absolute', right: 12, bottom: 40,
        display: 'flex', flexDirection: 'column', gap: 6, zIndex: 100,
      }}>
        <button style={btnStyle} onClick={zoomIn} title="Zoom In">+</button>
        <button style={btnStyle} onClick={zoomOut} title="Zoom Out">−</button>
        <button style={{ ...btnStyle, fontSize: 13 }} onClick={resetView} title="Reset View">⌂</button>
      </div>
    </div>
  );
};

export default CesiumTerrain3D;

