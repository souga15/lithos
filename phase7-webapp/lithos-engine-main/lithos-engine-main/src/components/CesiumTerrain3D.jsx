/**
 * CesiumTerrain3D.jsx  —  PURE CesiumJS (no resium)
 *
 * Drops the resium wrapper which is CommonJS and breaks Vite's ESM dev server.
 * Uses a plain div ref + Cesium.Viewer created imperatively in useEffect.
 * All features preserved: terrain, risk extrusion, route, car tracking, aircraft,
 * live users, evacuation points, nearby hazards.
 */
import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

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
  const containerRef = useRef(null);
  const viewerRef    = useRef(null);
  const navTimerRef  = useRef(null);
  const aircraftRef  = useRef(null);

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

        // Fly to NE India
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(93.2, 25.6, 180000),
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
        const score  = parseFloat(props.risk_score?.getValue?.() ?? 0);
        entity.polygon.material       = new Cesium.ColorMaterialProperty(riskFill(level));
        entity.polygon.extrudedHeight = new Cesium.ConstantProperty(score * 900);
        entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
        entity.polygon.extrudedHeightReference = Cesium.HeightReference.RELATIVE_TO_GROUND;
        entity.polygon.outline        = new Cesium.ConstantProperty(false);
      });
      viewer.dataSources.add(ds);
    }).catch(() => {});
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
        label: { text: `⛺ ${pt.name}\nCap: ${pt.capacity}`, font: 'bold 10px Inter', fillColor: Cesium.Color.fromCssColorString('#30D158'), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -24), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 3e5, 0.3) },
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
              label: { text: `✈ ${(callsign || 'N/A').trim()}`, font: '9px Inter', fillColor: Cesium.Color.fromCssColorString('#A8D8FF'), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -14), scaleByDistance: new Cesium.NearFarScalar(1e4, 1.0, 5e5, 0.0) },
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
    cam.zoomOut(cam.positionCartographic.height * 0.6);
  };

  const resetView = () => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    v.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(93.2, 25.6, 180000),
      orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-40), roll: 0 },
      duration: 1.5,
    });
  };

  const btnStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 8,
    background: 'rgba(5,13,30,0.75)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff', fontSize: 18, cursor: 'pointer',
    backdropFilter: 'blur(8px)', userSelect: 'none',
    transition: 'background 0.2s',
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

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
