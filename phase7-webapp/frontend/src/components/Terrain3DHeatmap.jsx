import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Plotly from 'plotly.js-dist-min';
import { Layers, Eye, Sliders, Maximize2, RefreshCw, AlertTriangle, ShieldCheck, Flame, Globe } from 'lucide-react';
import API_BASE_URL from '../apiConfig';

const Terrain3DHeatmap = ({ region }) => {
  const plotContainerRef = useRef(null);
  const [meshData, setMeshData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap' | 'satellite' | 'blend'
  const [blendRatio, setBlendRatio] = useState(1.0); // 0.0 (satellite) -> 1.0 (heatmap)
  const [zExaggeration, setZExaggeration] = useState(1.8);
  const [isRotating, setIsRotating] = useState(false);
  const animFrameRef = useRef(null);
  const cameraAngleRef = useRef(0);

  const regionKey = region?.key || 'sikkim';

  useEffect(() => {
    fetchMeshData(regionKey);
  }, [regionKey]);

  const fetchMeshData = async (key) => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/terrain/3d-heatmap-mesh?region=${key}&grid_res=50`);
      setMeshData(resp.data);
    } catch (err) {
      console.error("Failed to load 3D heatmap mesh:", err);
    } finally {
      setLoading(false);
    }
  };

  // Re-render Plotly 3D Surface when meshData, viewMode, blendRatio, or zExaggeration changes
  useEffect(() => {
    if (!meshData || !plotContainerRef.current) return;

    const { x, y, z, risk, bounds, stats, region_name } = meshData;

    // Apply Z exaggeration
    const zExaggerated = z.map(row => row.map(val => val * zExaggeration));

    // Calculate surface color based on viewMode / blendRatio
    // Satellite representation: normalized elevation & topographic variation
    const minZ = stats.min_elev;
    const maxZ = stats.max_elev;
    const zRange = Math.max(1, maxZ - minZ);

    const surfaceColors = risk.map((row, i) =>
      row.map((riskVal, j) => {
        const elevNorm = (z[i][j] - minZ) / zRange;
        if (viewMode === 'heatmap') {
          return riskVal;
        } else if (viewMode === 'satellite') {
          // Satellite green-brown vegetation scale
          return elevNorm * 0.4 + 0.1;
        } else {
          // Blend mode
          return (1 - blendRatio) * (elevNorm * 0.4 + 0.1) + blendRatio * riskVal;
        }
      })
    );

    const heatmapColorscale = [
      [0.0, '#14b8a6'],  // Teal / Cyan (Safe valleys)
      [0.2, '#2dd4bf'],  // Mint teal
      [0.38, '#a7f3d0'], // Pale seafoam
      [0.52, '#fde047'], // Amber yellow
      [0.70, '#fb923c'], // Terracotta orange
      [0.85, '#f87171'], // Coral red
      [1.0, '#dc2626'],  // Deep crimson failure peaks
    ];

    const satelliteColorscale = [
      [0.0, '#1b4332'], // Dark forest green (low valleys)
      [0.3, '#2d6a4f'], // Mid vegetation
      [0.6, '#74c69d'], // Light grass
      [0.85, '#936639'], // High rocky mountain ridge
      [1.0, '#d8e2dc'], // Snow / rocky peak
    ];

    const activeColorscale = viewMode === 'satellite' ? satelliteColorscale : heatmapColorscale;

    const trace = {
      type: 'surface',
      x: x,
      y: y,
      z: zExaggerated,
      surfacecolor: surfaceColors,
      colorscale: activeColorscale,
      cmin: 0,
      cmax: 1,
      colorbar: {
        title: {
          text: viewMode === 'satellite' ? 'Topography<br>(Elevation)' : '<b>PINN Landslide<br>Failure Probability</b>',
          font: { color: '#ffffff', family: 'Inter, sans-serif', size: 12 },
        },
        tickformat: viewMode === 'satellite' ? '.0%' : '.0%',
        tickfont: { color: '#ffffff', family: 'monospace', size: 11 },
        len: 0.75,
        thickness: 16,
        x: 1.02,
        y: 0.5,
        bgcolor: 'rgba(5, 8, 20, 0.75)',
        bordercolor: 'rgba(255, 255, 255, 0.1)',
        borderwidth: 1,
      },
      lighting: {
        ambient: 0.65,
        diffuse: 0.85,
        specular: 0.40,
        roughness: 0.45,
        fresnel: 0.25,
      },
      lightposition: { x: 100, y: 200, z: 2000 },
      contours: {
        z: {
          show: true,
          usecolormap: false,
          color: 'rgba(20, 30, 45, 0.45)',
          width: 1.5,
          project: { z: false },
        },
      },
      hovertemplate:
        '<b>x:</b> %{x:.3f}<br>' +
        '<b>y:</b> %{y:.3f}<br>' +
        '<b>z:</b> %{z:,.1f}<br>' +
        '<b>Risk:</b> %{surfacecolor:.1%}<extra></extra>',
      hoverlabel: {
        bgcolor: '#0f172a',
        bordercolor: '#334155',
        font: { family: 'monospace', size: 12, color: '#ffffff' },
      },
    };

    const layout = {
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      margin: { l: 0, r: 0, t: 10, b: 0 },
      scene: {
        xaxis: {
          title: 'x (Longitude)',
          color: 'rgba(255,255,255,0.75)',
          gridcolor: 'rgba(255,255,255,0.18)',
          showbackground: true,
          backgroundcolor: 'rgba(15, 23, 42, 0.65)',
        },
        yaxis: {
          title: 'y (Latitude)',
          color: 'rgba(255,255,255,0.75)',
          gridcolor: 'rgba(255,255,255,0.18)',
          showbackground: true,
          backgroundcolor: 'rgba(15, 23, 42, 0.65)',
        },
        zaxis: {
          title: 'z (Elevation m)',
          color: 'rgba(255,255,255,0.75)',
          gridcolor: 'rgba(255,255,255,0.18)',
          showbackground: true,
          backgroundcolor: 'rgba(15, 23, 42, 0.65)',
        },
        aspectratio: { x: 1, y: 1, z: 0.38 * (zExaggeration / 1.5) },
        camera: {
          eye: { x: 1.35, y: -1.45, z: 0.85 },
        },
      },
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['sendDataToCloud', 'resetCameraLastSave3d'],
    };

    Plotly.react(plotContainerRef.current, [trace], layout, config);
  }, [meshData, viewMode, blendRatio, zExaggeration]);

  // Handle 3D auto-orbit rotation
  useEffect(() => {
    if (!isRotating || !plotContainerRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const rotate = () => {
      cameraAngleRef.current += 0.008;
      const radius = 2.0;
      const x = radius * Math.cos(cameraAngleRef.current);
      const y = radius * Math.sin(cameraAngleRef.current);

      Plotly.relayout(plotContainerRef.current, {
        'scene.camera.eye': { x, y, z: 0.85 },
      });

      animFrameRef.current = requestAnimationFrame(rotate);
    };

    animFrameRef.current = requestAnimationFrame(rotate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRotating]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#050814] overflow-hidden select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: View Mode Switcher */}
        <div className="glass px-3 py-2 rounded-2xl pointer-events-auto flex items-center gap-1.5 border border-white/10 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => { setViewMode('heatmap'); setBlendRatio(1.0); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'heatmap'
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-300" />
            <span>3D PINN HEATMAP</span>
          </button>

          <button
            onClick={() => { setViewMode('satellite'); setBlendRatio(0.0); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'satellite'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-300" />
            <span>SATELLITE 3D</span>
          </button>

          <button
            onClick={() => setViewMode('blend')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'blend'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-300" />
            <span>COMPARE / REVEAL</span>
          </button>
        </div>

        {/* Right: Controls (Exaggeration, Auto-Rotate, Reset) */}
        <div className="glass px-3 py-2 rounded-2xl pointer-events-auto flex items-center gap-3 border border-white/10 shadow-2xl backdrop-blur-xl">
          {/* Blend Reveal Slider (Visible in Compare / Blend mode) */}
          {viewMode === 'blend' && (
            <div className="flex items-center gap-2 px-2 border-r border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-400">Sat</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={blendRatio}
                onChange={(e) => setBlendRatio(parseFloat(e.target.value))}
                className="w-24 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="text-[10px] uppercase font-bold text-red-400">Heat</span>
              <span className="text-[11px] font-mono text-white/80 w-8 text-right">
                {Math.round(blendRatio * 100)}%
              </span>
            </div>
          )}

          {/* Elevation Exaggeration Slider */}
          <div className="flex items-center gap-2 px-2 border-r border-white/10">
            <Sliders className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] uppercase font-bold text-white/50">Scale</span>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.2"
              value={zExaggeration}
              onChange={(e) => setZExaggeration(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <span className="text-[10px] font-mono text-white/80">{zExaggeration.toFixed(1)}x</span>
          </div>

          {/* Auto Rotate Button */}
          <button
            onClick={() => setIsRotating(!isRotating)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              isRotating
                ? 'bg-accent text-bg border-accent shadow-glow'
                : 'bg-white/5 text-white/70 border-white/10 hover:border-white/30 hover:text-white'
            }`}
            title="3D Auto Orbit"
          >
            <RefreshCw className={`w-4 h-4 ${isRotating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bottom Floating Stats Panel */}
      {meshData && (
        <div className="absolute bottom-4 left-4 z-20 pointer-events-auto glass px-4 py-3 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl max-w-md">
          <div className="flex items-center justify-between gap-4 mb-2 pb-2 border-b border-white/10">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                {meshData.region_name} 3D PINN Model
              </h4>
              <p className="text-[10px] text-white/50 font-mono">
                {meshData.bounds.south.toFixed(2)}°N - {meshData.bounds.north.toFixed(2)}°N, {meshData.bounds.west.toFixed(2)}°E - {meshData.bounds.east.toFixed(2)}°E
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[11px] font-mono font-bold text-red-300">
                {meshData.stats.high_risk_cells} Critical Hotspots
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-black/30 p-2 rounded-xl">
              <span className="text-[9px] uppercase tracking-widest text-white/40 block">Max Risk</span>
              <span className="text-xs font-bold font-mono text-red-400">
                {(meshData.stats.max_risk * 100).toFixed(0)}%
              </span>
            </div>
            <div className="bg-black/30 p-2 rounded-xl">
              <span className="text-[9px] uppercase tracking-widest text-white/40 block">Mean Risk</span>
              <span className="text-xs font-bold font-mono text-amber-300">
                {(meshData.stats.mean_risk * 100).toFixed(0)}%
              </span>
            </div>
            <div className="bg-black/30 p-2 rounded-xl">
              <span className="text-[9px] uppercase tracking-widest text-white/40 block">Elevation</span>
              <span className="text-xs font-bold font-mono text-white/90">
                {meshData.stats.min_elev.toFixed(0)} - {meshData.stats.max_elev.toFixed(0)}m
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#050814]/80 backdrop-blur-md">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-black uppercase tracking-widest text-accent animate-pulse">
            Computing PINN 3D Terrain Heatmap...
          </p>
          <p className="text-[11px] font-mono text-white/40 mt-1">
            Running 9-parameter physics inference on DEM topography
          </p>
        </div>
      )}

      {/* Plotly 3D Canvas */}
      <div ref={plotContainerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};

export default Terrain3DHeatmap;
