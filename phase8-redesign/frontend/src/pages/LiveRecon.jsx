import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as Cesium from 'cesium';
import { Satellite, ArrowDown } from 'lucide-react';

// Require Cesium CSS to prevent white screen
import 'cesium/Build/Cesium/Widgets/widgets.css';

// GPS Waypoints representing NH-10 Highway or a generic Himalayan path
// [Longitude, Latitude, Height(m)]
const flightPath = [
  [88.65, 27.20, 8000],  // 0% - High overview of the region
  [88.60, 27.25, 4000],  // 25% - Approaching valley
  [88.55, 27.30, 2000],  // 50% - Entering gorge
  [88.52, 27.33, 1000],  // 75% - Low altitude hazard zone
  [88.48, 27.38, 500],   // 100% - Ground level blockade
];

const lerp = (start, end, t) => start * (1 - t) + end * t;

const LiveRecon = () => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Initialize Cesium Viewer once
  useEffect(() => {
    if (!containerRef.current) return;

    // Use default OSM if no token is available to prevent crashing
    const viewerOptions = {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      geocoder: false,
      homeButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
    };

    // Initialize viewer
    const viewer = new Cesium.Viewer(containerRef.current, viewerOptions);
    viewerRef.current = viewer;
    
    // Add terrain asynchronously to avoid top-level await issues
    Cesium.createWorldTerrainAsync().then(terrain => {
       if (viewer && !viewer.isDestroyed()) {
           viewer.terrainProvider = terrain;
           viewer.scene.globe.depthTestAgainstTerrain = true;
       }
    }).catch(e => console.warn("Failed to load Cesium terrain", e));

    // Draw the flight path
    const routePositions = Cesium.Cartesian3.fromDegreesArrayHeights(flightPath.flat());
    viewer.entities.add({
      polyline: {
        positions: routePositions,
        width: 5,
        material: Cesium.Color.fromCssColorString('#c8f57a').withAlpha(0.5),
        arcType: Cesium.ArcType.RHUMB
      }
    });

    // Add Red Marker at 50% gorge
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(flightPath[2][0], flightPath[2][1], flightPath[2][2]),
      point: {
        pixelSize: 15,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      }
    });

    // Initial camera position
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(flightPath[0][0], flightPath[0][1], flightPath[0][2]),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0
      }
    });

    return () => {
      viewer.destroy();
    };
  }, []);

  // Handle Scroll to update camera
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const maxScroll = scrollHeight - clientHeight;
    const progress = Math.max(0, Math.min(1, scrollTop / maxScroll));
    setScrollProgress(progress);
  };

  // Sync scroll to Cesium camera frame-by-frame
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const camera = viewer.camera;

    const pathSegments = flightPath.length - 1;
    const totalProg = scrollProgress * pathSegments; 
    const segmentIndex = Math.min(Math.floor(totalProg), pathSegments - 1);
    const segmentT = totalProg - segmentIndex;

    const start = flightPath[segmentIndex];
    const end = flightPath[segmentIndex + 1];

    const lon = lerp(start[0], end[0], segmentT);
    const lat = lerp(start[1], end[1], segmentT);
    const height = lerp(start[2], end[2], segmentT);

    const heading = Math.atan2(end[0] - start[0], end[1] - start[1]);
    const pitch = lerp(Cesium.Math.toRadians(-60), Cesium.Math.toRadians(-15), scrollProgress);

    camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      orientation: {
        heading: heading,
        pitch: pitch,
        roll: 0.0
      }
    });
  }, [scrollProgress]);

  return (
    <div className="relative w-full h-full bg-bg font-sans overflow-hidden">
      
      {/* 1. Underlying Base Cesium Map */}
      <div className="fixed inset-0 w-full h-full z-0">
         <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* 2. Scrollable Overlay Layer */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden"
      >
        <div className="w-full relative" style={{ height: '400vh' }}>
          
          {/* Section 1: Intro */}
          <div className="absolute top-0 left-0 w-full h-screen flex items-center p-12 pointer-events-none">
            <motion.div 
              className="glass-elevated p-8 rounded-lg max-w-lg pointer-events-auto shadow-none border border-accent/20"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              style={{ background: 'rgba(20, 24, 15, 0.85)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Satellite className="text-accent" size={24} />
                <span className="label-micro text-accent">CESIUMJS REAL TERRAIN</span>
              </div>
              <h1 className="font-display text-7xl leading-none tracking-tight mb-4 text-white">LIVE<br/>RECON</h1>
              <p className="data-mono text-silver text-sm mb-6 border-l-2 border-accent pl-3">
                Scroll to activate the fixed-wing drone flight path. The camera will descend over the active hazard zone in the Sikkim region.
              </p>
              <div className="flex items-center gap-2 text-accent animate-pulse mt-4">
                <ArrowDown size={16} />
                <span className="data-mono text-xs uppercase tracking-widest">Scroll to Descend</span>
              </div>
            </motion.div>
          </div>

          {/* Section 2: Hotspot 1 (Appears 50% way down) */}
          <div className="absolute left-12 w-full h-screen flex items-center pointer-events-none" style={{ top: '150vh' }}>
            <motion.div 
              className="glass-elevated p-6 rounded-lg pointer-events-auto border-l-4 border-risk-red shadow-glow-red w-80"
              style={{ 
                opacity: scrollProgress > 0.3 && scrollProgress < 0.7 ? 1 : 0, 
                transition: 'opacity 0.3s ease',
                background: 'rgba(20, 24, 15, 0.85)' 
              }}
            >
              <h3 className="font-display text-4xl mb-1 text-white">HAZARD SECTOR 12</h3>
              <p className="data-mono text-xs text-risk-red bg-risk-red/10 px-2 py-1 rounded inline-block mb-4 border border-risk-red/30">CRITICAL THREAT: LANDSLIDE</p>
              <div className="space-y-2 data-mono text-xs text-silver">
                 <div className="flex justify-between"><span>Slope Factor</span> <span className="text-white">42&deg;</span></div>
                 <div className="flex justify-between"><span>Soil Saturation</span> <span className="text-risk-orange">94%</span></div>
                 <div className="flex justify-between"><span>Real-time Risk</span> <span className="text-risk-red font-bold text-sm">0.96</span></div>
              </div>
            </motion.div>
          </div>

          {/* Section 3: Ground Level (Appears at bottom) */}
          <div className="absolute right-12 w-full h-screen flex items-end justify-end pb-24 pointer-events-none" style={{ top: '300vh' }}>
            <motion.div 
              className="glass p-6 rounded-lg pointer-events-auto border-l-4 border-accent shadow-glow-sm w-96 backdrop-blur-xl"
              style={{ opacity: scrollProgress > 0.8 ? 1 : 0, transition: 'opacity 0.5s ease', background: 'rgba(20, 24, 15, 0.95)' }}
            >
              <h3 className="font-display text-4xl mb-1 text-white">NH-10 BLOCKADE</h3>
              <p className="data-mono text-xs text-accent mb-4 border border-accent/20 px-2 py-1 inline-block rounded">DRONE ALTITUDE: 500m</p>
              <p className="data-mono text-xs text-silver leading-relaxed">
                This is the actual 3D topography intersecting with the computed landslide runout module. 
                The road below requires immediate clearing. Scroll up to review the flight path.
              </p>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LiveRecon;
