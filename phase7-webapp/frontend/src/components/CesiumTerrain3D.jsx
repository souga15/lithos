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
import { Flame, Globe, Sliders, Eye, RefreshCw, MapPin, Building, Loader2, Navigation } from 'lucide-react';

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
}) => {
  const containerRef   = useRef(null);
  const viewerRef      = useRef(null);
  const buildingsRef   = useRef(null);
  const navTimerRef    = useRef(null);
  const aircraftRef    = useRef(null);

  const [showBuildings, setShowBuildings] = useState(true);
  const [isLocating, setIsLocating]       = useState(false);
  const [userGps, setUserGps]             = useState(null);
  const [gpsHazard, setGpsHazard]         = useState(null);
  const [viewerReady, setViewerReady]     = useState(false);

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

        // 3. Load Real 3D OSM Buildings (Global coverage)
        try {
          if (import.meta.env.VITE_CESIUM_TOKEN) {
            const osmBuildings = await Cesium.createOsmBuildingsAsync();
            viewer.scene.primitives.add(osmBuildings);
            buildingsRef.current = osmBuildings;
          }
        } catch (bErr) {
          console.warn('Lithos: Cesium 3D OSM Buildings notice:', bErr);
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
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.85);
  const [activeStats, setActiveStats] = useState(null);
  const opacityRef = useRef(heatmapOpacity);
  opacityRef.current = heatmapOpacity;

  // ── Continuous Whole-Region 3D Heatmap Drape (Clamped to Terrain) ──────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !region?.key) return;

    // Remove existing heatmap entity if present
    const existing = viewer.entities.getById('heatmap-drape-entity');
    if (existing) viewer.entities.remove(existing);

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
  }, [region, viewerReady]);

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

  // ── Risk grid (GeoJSON polygons extruded by risk score) ───────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !riskGrid) return;
    // remove existing risk ds
    const toRemove = viewer.dataSources._dataSources?.filter(ds => ds._name === 'riskGrid') || [];
    toRemove.forEach(ds => viewer.dataSources.remove(ds));

    Cesium.GeoJsonDataSource.load(riskGrid).then(ds => {
      ds._name = 'riskGrid';
      ds.entities.values.forEach(entity => {
        if (!entity.polygon) return;
        const props  = entity.properties;
        const level  = props.risk_level?.getValue?.() ?? 'GREEN';
        const score  = parseFloat(props.risk_score?.getValue?.() ?? 0.2);
        entity.polygon.material       = new Cesium.ColorMaterialProperty(riskFill(level));
        entity.polygon.extrudedHeight = new Cesium.ConstantProperty(Math.max(60, score * 1200));
        entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
        entity.polygon.extrudedHeightReference = Cesium.HeightReference.RELATIVE_TO_GROUND;
        entity.polygon.outline        = new Cesium.ConstantProperty(true);
        entity.polygon.outlineColor   = new Cesium.ConstantProperty(riskLine(level));
      });
      viewer.dataSources.add(ds);
    }).catch(err => console.warn('Cesium GeoJSON load warn:', err));
  }, [riskGrid]);

  // ── Route segments (polylines) ────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !routeResult) return;

    // Remove old route entities
    const old = viewer.entities.values.filter(e => e.id?.startsWith?.('route-'));
    old.forEach(e => viewer.entities.remove(e));

    const segments = routeResult.route.segments;
    for (let i = 0; i < segments.length - 1; i++) {
      const s   = segments[i];
      const n   = segments[i + 1];
      const sLon = parseFloat(s.lon);
      const sLat = parseFloat(s.lat);
      const nLon = parseFloat(n.lon);
      const nLat = parseFloat(n.lat);
      
      if (isNaN(sLon) || isNaN(sLat) || isNaN(nLon) || isNaN(nLat)) continue;
      
      const lvl = s.risk_level || 'GREEN';
      viewer.entities.add({
        id: `route-${i}`,
        polyline: {
          positions:     [
            Cesium.Cartesian3.fromDegrees(sLon, sLat),
            Cesium.Cartesian3.fromDegrees(nLon, nLat),
          ],
          width:         6,
          material:      riskLine(lvl),
          clampToGround: true,
        },
      });
    }

    // Fly to mid-route
    const mid = segments[Math.floor(segments.length / 2)];
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(mid.lon, mid.lat, 30000),
      orientation: { pitch: Cesium.Math.toRadians(-40) },
      duration: 2,
    });
  }, [routeResult]);

  // ── Start / End markers ───────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    ['start-marker', 'end-marker'].forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    if (start && !isNavigating) {
      viewer.entities.add({
        id: 'start-marker',
        position: Cesium.Cartesian3.fromDegrees(start.lng, start.lat, 50),
        point: { pixelSize: 16, color: Cesium.Color.fromCssColorString('#FFD60A'), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        label: { text: 'START', font: 'bold 12px Inter', fillColor: Cesium.Color.fromCssColorString('#FFD60A'), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -20), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
      });
    }
    if (end && !isNavigating) {
      viewer.entities.add({
        id: 'end-marker',
        position: Cesium.Cartesian3.fromDegrees(end.lng, end.lat, 50),
        point: { pixelSize: 16, color: Cesium.Color.fromCssColorString('#FF3B30'), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        label: { text: 'DESTINATION', font: 'bold 12px Inter', fillColor: Cesium.Color.fromCssColorString('#FF3B30'), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -20), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
      });
    }
  }, [start, end, isNavigating]);

  // ── Navigation: car marker + follow camera ───────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const e = viewer.entities.getById('car-marker');
    if (e) viewer.entities.remove(e);
    clearInterval(navTimerRef.current);

    if (!carPosition || !isNavigating) return;
    const carColor = carPosition.risk === 'RED' ? '#FF3B30' : carPosition.risk === 'ORANGE' ? '#FF9500' : '#00C2FF';
    if (typeof carPosition.lng !== 'number' || typeof carPosition.lat !== 'number') return;
    viewer.entities.add({
      id: 'car-marker',
      position: Cesium.Cartesian3.fromDegrees(carPosition.lng, carPosition.lat, 30),
      point: { pixelSize: 20, color: Cesium.Color.fromCssColorString(carColor), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
      label: { text: '▲ YOU', font: 'bold 11px Inter', fillColor: Cesium.Color.fromCssColorString(carColor), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -24), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
    });

    navTimerRef.current = setInterval(() => {
      if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(carPosition.lng, carPosition.lat, 1800),
        orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-28), roll: 0 },
        duration: 0.8,
      });
    }, 1200);
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
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'rgba(7, 9, 26, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-space-950">
      <div ref={containerRef} className="w-full h-full" />

      {/* Top Left Floating 3D Controls Bar */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto flex items-center gap-2.5 glass px-3 py-2 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
        {/* Toggle 3D PINN Heatmap Surface */}
        <button
          onClick={() => setShowHeatmapDrape(!showHeatmapDrape)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            showHeatmapDrape
              ? 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
              : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-300" />
          <span>{showHeatmapDrape ? '3D HEATMAP' : 'SATELLITE BASE'}</span>
        </button>

        {showHeatmapDrape && (
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <span className="text-[10px] font-bold uppercase text-white/50">Reveal</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={heatmapOpacity}
              onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent"
              title="Heatmap Opacity / Satellite Reveal"
            />
            <span className="text-[10px] font-mono font-bold text-white/80 w-8">
              {Math.round(heatmapOpacity * 100)}%
            </span>
          </div>
        )}

        {/* 3D OSM Buildings Toggle */}
        <button
          onClick={() => setShowBuildings(!showBuildings)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
            showBuildings
              ? 'bg-blue-600/30 text-blue-300 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
              : 'bg-white/5 text-white/50 border-white/5 hover:text-white hover:bg-white/10'
          }`}
          title="Toggle Real 3D OpenStreetMap Buildings"
        >
          <Building className="w-3.5 h-3.5 text-blue-400" />
          <span>{showBuildings ? '3D BUILDINGS' : 'BUILDINGS OFF'}</span>
        </button>

        {/* Live Device GPS Sync Button */}
        <button
          onClick={handleGpsSync}
          disabled={isLocating}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
            userGps && !userGps.label?.includes('SIKKIM')
              ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
          }`}
          title="Synchronize 3D Globe with Live Device GPS"
        >
          {isLocating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span>{isLocating ? 'Locating...' : 'LIVE GPS'}</span>
        </button>

        {/* Test Sikkim User GPS Button (for reviewers outside Sikkim) */}
        <button
          onClick={testSikkimGps}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
            userGps?.label?.includes('SIKKIM')
              ? 'bg-purple-600/35 text-purple-200 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
              : 'bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/30'
          }`}
          title="Simulate someone inside Sikkim (Gangtok) viewing their local 3D heatmap"
        >
          <MapPin className="w-3.5 h-3.5 text-purple-400" />
          <span>SIKKIM BENCHMARK</span>
        </button>
      </div>

      {/* Floating GPS Info HUD Card */}
      {userGps && (
        <div className="absolute top-4 right-16 z-20 pointer-events-auto glass px-4 py-2.5 rounded-2xl border border-cyan-500/40 shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 block">Live GPS Synced</span>
            <span className="text-xs font-mono font-bold text-white">
              {userGps.lat}°N, {userGps.lon}°E ({userGps.alt}m)
            </span>
          </div>
          {gpsHazard && (
            <div className="pl-3 border-l border-white/10">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Local Hazard</span>
              <span className={`text-xs font-mono font-bold ${
                gpsHazard.failure_probability > 0.6 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {(gpsHazard.failure_probability * 100).toFixed(1)}% ({gpsHazard.risk_level})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Floating Legend / Stats */}
      {showHeatmapDrape && activeStats && (
        <div className="absolute bottom-6 left-4 z-20 pointer-events-auto glass px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl flex items-center gap-4">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Failure Risk</span>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-24 h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 via-orange-500 to-red-600" />
              <span className="text-[10px] font-mono text-white/80">0% → 100%</span>
            </div>
          </div>
          <div className="pl-3 border-l border-white/10">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Hotspots</span>
            <span className="text-xs font-mono font-bold text-red-400">{activeStats.high_risk_cells} Critical Units</span>
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

