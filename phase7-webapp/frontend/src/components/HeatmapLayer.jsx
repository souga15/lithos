import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

/**
 * HeatmapLayer - Renders a risk-grid GeoJSON FeatureCollection as a Leaflet heatmap.
 *
 * Props:
 *  - riskGrid: GeoJSON FeatureCollection with features having `risk_level` property
 *              and Polygon geometries (grid cells)
 *  - opacity:  overall layer opacity (default 0.7)
 */
const HeatmapLayer = ({ riskGrid, opacity = 0.7 }) => {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    // Remove old heat layer
    if (heatLayerRef.current) {
      try { map.removeLayer(heatLayerRef.current); } catch (_) {}
      heatLayerRef.current = null;
    }

    if (!riskGrid || !riskGrid.features || riskGrid.features.length === 0) return;

    // Build heat points from risk grid cell centroids
    // Format: [lat, lng, intensity]  where intensity 0..1
    const points = [];
    for (const feature of riskGrid.features) {
      const level = feature?.properties?.risk_level;
      if (!level) continue;

      // Intensity: RED=1.0, ORANGE=0.55, YELLOW=0.25, GREEN=0.05
      let intensity;
      switch (level) {
        case 'RED':    intensity = 1.0;  break;
        case 'ORANGE': intensity = 0.55; break;
        case 'YELLOW': intensity = 0.25; break;
        default:       intensity = 0.05; break;  // GREEN
      }

      // Get centroid of the polygon cell
      const coords = feature?.geometry?.coordinates?.[0];
      if (!coords || coords.length < 3) continue;

      const lngSum = coords.reduce((s, c) => s + c[0], 0);
      const latSum = coords.reduce((s, c) => s + c[1], 0);
      const n = coords.length;
      points.push([latSum / n, lngSum / n, intensity]);
    }

    if (points.length === 0) return;

    // Create heat layer
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 20,
      maxZoom: 18,
      max: 1.0,
      minOpacity: 0.25,
      gradient: {
        0.05: '#00ff88',   // green – safe
        0.25: '#FFD60A',   // yellow – caution
        0.50: '#FF9500',   // orange – high
        0.75: '#FF5C00',
        1.00: '#FF3B30',   // red – critical
      },
    });

    heat.addTo(map);
    heatLayerRef.current = heat;

    return () => {
      try { map.removeLayer(heat); } catch (_) {}
    };
  }, [riskGrid, map, opacity]);

  return null;
};

export default HeatmapLayer;
