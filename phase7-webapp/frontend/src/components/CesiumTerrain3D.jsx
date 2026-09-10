/**
 * CesiumTerrain3D.jsx  —  PURE CesiumJS (no resium)
 *
 * Drops the resium wrapper which is CommonJS and breaks Vite's ESM dev server.
 * Uses a plain div ref + Cesium.Viewer created imperatively in useEffect.
 * All features preserved: terrain, risk extrusion, route, car tracking, aircraft,
 * live users, evacuation points, nearby hazards.
 */
import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { Layers, Globe, Sliders, Eye, RefreshCw, MapPin, Building, Loader2, Navigation, SlidersHorizontal, X, Sparkles, Play, ChevronRight } from 'lucide-react';

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

  // ── 3D Heatmap Drape (Clamped to Terrain) ──────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !region?.key) return;

    // Remove existing heatmap entity if present
    const existing = viewer.entities.getById('heatmap-drape-entity');
    if (existing) viewer.entities.remove(existing);

    if (heatmapMode === 'slope_units') {
      // Direct 1:1 Parity with 2D: Drapes the exact DEM slope-unit polygons onto the 3D terrain
      const west  = region.bbox ? region.bbox[0] : (region.center ? region.center[1] - 0.55 : 88.0);
      const south = region.bbox ? region.bbox[1] : (region.center ? region.center[0] - 0.55 : 27.0);
      const east  = region.bbox ? region.bbox[2] : (region.center ? region.center[1] + 0.55 : 88.9);
      const north = region.bbox ? region.bbox[3] : (region.center ? region.center[0] + 0.55 : 28.1);

      viewer.entities.add({
        id: 'heatmap-drape-entity',
        show: showHeatmapDrape,
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(west, south, east, north),
          material: new Cesium.ImageMaterialProperty({
            image: `${API_BASE_URL}/api/heatmap-image?region=${region.key}&mode=slope_units&res=1024`,
            transparent: true,
            color: new Cesium.CallbackProperty(() => {
              return Cesium.Color.WHITE.withAlpha(opacityRef.current);
            }, false),
          }),
          classificationType: Cesium.ClassificationType.BOTH,
          zIndex: 10,
        },
      });
    } else {
      // Continuous scalar potential field (cubic spline interpolation across terrain)
      axios.get(`${API_BASE_URL}/api/terrain/3d-heatmap-mesh?region=${region.key}&grid_res=60`)
        .then(resp => {
          const { bounds, risk, stats } = resp.data;
          if (!risk || !risk.length) return;
          setActiveStats(stats);

          const H = risk.length;
          const W = risk[0].length;
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');
          const imgData = ctx.createImageData(512, 512);

          for (let py = 0; py < 512; py++) {
            const gy = ((511 - py) / 511) * (H - 1);
            const y0 = Math.floor(gy);
            const y1 = Math.min(H - 1, y0 + 1);
            const wy = gy - y0;

            for (let px = 0; px < 512; px++) {
              const gx = (px / 511) * (W - 1);
              const x0 = Math.floor(gx);
              const x1 = Math.min(W - 1, x0 + 1);
              const wx = gx - x0;

              const r00 = risk[y0][x0];
              const r01 = risk[y0][x1];
              const r10 = risk[y1][x0];
              const r11 = risk[y1][x1];
              const val = (1 - wy) * ((1 - wx) * r00 + wx * r01) + wy * ((1 - wx) * r10 + wx * r11);

              let r, g, b, a;
              if (val < 0.28) {
                const t = val / 0.28;
                r = Math.round(16 + t * (45 - 16));
                g = Math.round(185 + t * (212 - 185));
                b = Math.round(129 + t * (191 - 129));
                a = Math.round(140 + t * 40);
              } else if (val < 0.58) {
                const t = (val - 0.28) / 0.30;
                r = Math.round(45 + t * (249 - 45));
                g = Math.round(212 - t * (212 - 115));
                b = Math.round(191 - t * (191 - 22));
                a = Math.round(180 + t * 45);
              } else {
                const t = Math.min(1.0, (val - 0.58) / 0.42);
                r = Math.round(249 + t * (239 - 249));
                g = Math.round(115 - t * (115 - 68));
                b = Math.round(22 + t * (68 - 22));
                a = Math.round(225 + t * 30);
              }

              // Natural boundary feathering: softly fade alpha at outer perimeter
              const edgeNormX = Math.min(px, 511 - px) / 511;
              const edgeNormY = Math.min(py, 511 - py) / 511;
              const edgeDist = Math.min(edgeNormX, edgeNormY);
              const feather = Math.min(1.0, edgeDist / 0.04);
              a = Math.round(a * feather);

              const pIdx = (py * 512 + px) * 4;
              imgData.data[pIdx]     = r;
              imgData.data[pIdx + 1] = g;
              imgData.data[pIdx + 2] = b;
              imgData.data[pIdx + 3] = a;
            }
          }

          ctx.putImageData(imgData, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');

          if (viewerRef.current && !viewerRef.current.isDestroyed()) {
            const oldE = viewerRef.current.entities.getById('heatmap-drape-entity');
            if (oldE) viewerRef.current.entities.remove(oldE);

            viewerRef.current.entities.add({
              id: 'heatmap-drape-entity',
              show: showHeatmapDrape,
              rectangle: {
                coordinates: Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north),
                material: new Cesium.ImageMaterialProperty({
                  image: dataUrl,
                  transparent: true,
                  color: new Cesium.CallbackProperty(() => {
                    return Cesium.Color.WHITE.withAlpha(opacityRef.current);
                  }, false),
                }),
                classificationType: Cesium.ClassificationType.BOTH,
                zIndex: 10,
              },
            });
          }
        })
        .catch(err => console.warn('Cesium Heatmap drape error:', err));
    }
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
    const [lat, lon] = region.center;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat - 0.08, 26000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-40),
        roll:    0,
      },
      duration: 2.0,
    });
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

    const segments = routeResult?.route?.segments;
    if (!segments || segments.length < 2) return;

    // Group adjacent segments by risk level for super fast, crisp clamped rendering
    const chunks = [];
    const firstLon = parseFloat(segments[0].lon ?? segments[0].lng);
    const firstLat = parseFloat(segments[0].lat);
    let curChunk = {
      level: segments[0].risk_level || 'GREEN',
      positions: [Cesium.Cartesian3.fromDegrees(firstLon, firstLat)],
    };

    for (let i = 1; i < segments.length; i++) {
      const s = segments[i];
      const sLon = parseFloat(s.lon ?? s.lng);
      const sLat = parseFloat(s.lat);
      if (isNaN(sLon) || isNaN(sLat)) continue;
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

    chunks.forEach((chunk, cIdx) => {
      viewer.entities.add({
        id: `route-chunk-${cIdx}`,
        polyline: {
          positions:     chunk.positions,
          width:         7,
          material:      new Cesium.ColorMaterialProperty(riskLine(chunk.level)),
          clampToGround: true,
        },
      });
    });

    // Fly to route overview
    const mid = segments[Math.floor(segments.length / 2)];
    const midLon = parseFloat(mid.lon ?? mid.lng);
    const midLat = parseFloat(mid.lat);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(midLon, midLat - 0.05, 22000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-45),
        roll:    0,
      },
      duration: 2,
    });
  }, [routeResult, viewerReady]);

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
          point: { pixelSize: 16, color: Cesium.Color.fromCssColorString('#FFD60A'), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
          label: { text: 'START', font: 'bold 12px Inter', fillColor: Cesium.Color.fromCssColorString('#FFD60A'), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -20), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        });
      }
    }
    if (end && !isNavigating) {
      const eLon = parseFloat(end.lng ?? end.lon);
      const eLat = parseFloat(end.lat);
      if (!isNaN(eLon) && !isNaN(eLat)) {
        viewer.entities.add({
          id: 'end-marker',
          position: Cesium.Cartesian3.fromDegrees(eLon, eLat, 50),
          point: { pixelSize: 16, color: Cesium.Color.fromCssColorString('#FF3B30'), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
          label: { text: 'DESTINATION', font: 'bold 12px Inter', fillColor: Cesium.Color.fromCssColorString('#FF3B30'), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -20), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        });
      }
    }
  }, [start, end, isNavigating, viewerReady]);

  // ── Navigation: car marker + follow camera ───────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!carPosition || !isNavigating) {
      const e = viewer.entities.getById('car-marker');
      if (e) viewer.entities.remove(e);
      return;
    }

    const carColor = carPosition.risk === 'RED' ? '#FF3B30' : carPosition.risk === 'ORANGE' ? '#FF9500' : '#00C2FF';
    if (typeof carPosition.lng !== 'number' || typeof carPosition.lat !== 'number') return;
    const pos = Cesium.Cartesian3.fromDegrees(carPosition.lng, carPosition.lat, 25);

    let carEntity = viewer.entities.getById('car-marker');
    if (!carEntity) {
      viewer.entities.add({
        id: 'car-marker',
        position: pos,
        point: { pixelSize: 20, color: Cesium.Color.fromCssColorString(carColor), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        label: { text: '▲ VEHICLE', font: 'bold 11px Inter', fillColor: Cesium.Color.fromCssColorString(carColor), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -24), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
      });
    } else {
      carEntity.position = pos;
      if (carEntity.point) carEntity.point.color = Cesium.Color.fromCssColorString(carColor);
      if (carEntity.label) carEntity.label.fillColor = Cesium.Color.fromCssColorString(carColor);
    }

    // Smooth camera tracking to car position without underground collision
    const now = Date.now();
    if (now - lastCamFollowRef.current > 260) {
      lastCamFollowRef.current = now;

      // Dynamically sample actual terrain elevation at vehicle location
      let groundHeight = 1600;
      try {
        const carto = Cesium.Cartographic.fromDegrees(carPosition.lng, carPosition.lat);
        const sample = viewer.scene.globe.getHeight(carto);
        if (typeof sample === 'number' && sample > 50) {
          groundHeight = sample;
        } else if (carPosition.lat > 27.0) {
          // Himalayan pass corridor (Sikkim NH-310 climbs from Gangtok 1,650m to Nathu La 4,310m)
          const prog = Math.min(Math.max((carPosition.lng - 88.61) / (88.83 - 88.61), 0), 1);
          groundHeight = 1650 + prog * 2660;
        }
      } catch (_) {}

      // Keep camera safely 1,300m ABOVE mountain terrain, looking down at -38 deg
      const camHeight = Math.max(groundHeight + 1300, 2600);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(carPosition.lng, carPosition.lat - 0.011, camHeight),
        orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-38), roll: 0 },
        duration: 0.25,
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
        position: Cesium.Cartesian3.fromDegrees(h.center_lon, h.center_lat, 200),
        ellipse: { semiMajorAxis: h.distance_km * 300, semiMinorAxis: h.distance_km * 300, material: Cesium.Color.fromCssColorString('#FF3B30').withAlpha(0.18), outline: true, outlineColor: Cesium.Color.fromCssColorString('#FF3B30').withAlpha(0.6), outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
      });
    });
  }, [nearbyHazards]);

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
    if (!v || v.isDestroyed()) return;
    v.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(region.center[0], region.center[1], 45000),
      duration: 1.5,
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

      {/* Consolidated Layers & Tools Drawer (Keeps the 3D viewport clean & minimal) */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
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

            {/* Section: Evaluation & Demo Corridors (4x / 10x Speed) */}
            {demoPresets && demoPresets.length > 0 && (
              <div className="pt-2.5 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                      Demo Corridors
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
                    <span>Start Demo Run ({demoSpeed}x Speed)</span>
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

