import React from 'react';
import { Layers } from 'lucide-react';

const SlopeCrossSection = ({ selectedCell }) => {
  if (!selectedCell) return null;

  return (
    <div className="glass p-4 rounded-xl border-white/10">
      <h3 className="text-xs font-black uppercase text-white/60 mb-3 flex items-center gap-2">
        <Layers className="w-4 h-4" /> 2D Slope Cross-Section
      </h3>
      <div className="w-full h-32 bg-black/50 rounded-lg flex items-center justify-center border border-white/5 relative overflow-hidden">
        <svg viewBox="0 0 600 400" className="w-full h-full opacity-80" preserveAspectRatio="xMidYMid slice">
          {(() => {
            const slopeDeg = selectedCell.slope_mean;
            const depthPx = selectedCell.soil_depth_m * 10;
            // Base points for 600x400 box
            const hOffset = Math.tan(slopeDeg * Math.PI / 180) * 600;
            const yTopLeft = 400 - hOffset;

            return (
              <g className="transition-all duration-500">
                {/* Weathered Rock (Grey) Foundation */}
                <path
                  d={`M 0 400 L 0 ${yTopLeft + depthPx + 20} L 600 400 Z`}
                  fill="#666"
                />
                {/* Residual Soil */}
                <path
                  d={`M 0 400 L 0 ${yTopLeft + depthPx} L 600 400 Z`}
                  fill="#C19A6B"
                />
                {/* Topsoil */}
                <path
                  d={`M 0 400 L 0 ${yTopLeft} L 600 400 Z`}
                  fill="url(#soilGradient)"
                  stroke="#8B4513"
                  strokeWidth="2"
                />
                {/* Water line (Rises with rainfall intensity) */}
                <path
                  d={`M 0 ${yTopLeft + (depthPx * (1 - selectedCell.saturation_ratio / 1.5))} L 600 400`}
                  stroke="#00C2FF"
                  strokeWidth="3"
                  strokeDasharray="10,10"
                  fill="none"
                  opacity="0.8"
                />
                {/* Proposed Wall at Toe (grey rect) */}
                {(selectedCell.stability_class === 'Class III' || selectedCell.stability_class === 'Class IV') && (
                  <rect x="550" y="320" width="30" height="80" fill="#999" stroke="#333" strokeWidth="2" />
                )}
                {/* Failure Plane Curve */}
                {selectedCell.fos_seismic < 1.5 && (
                  <path d={`M 100 ${yTopLeft + (hOffset * 100 / 600)} Q 300 450 500 400`} stroke="#FF3B30" strokeWidth="4" strokeDasharray="15,10" fill="none" />
                )}
                {/* Tension Crack Line */}
                {selectedCell.fos_seismic < 1.2 && (
                  <path d={`M 100 ${yTopLeft + (hOffset * 100 / 600)} L 100 ${yTopLeft + (hOffset * 100 / 600) + depthPx}`} stroke="#FF3B30" strokeWidth="3" />
                )}
              </g>
            )
          })()}
          <defs>
            <linearGradient id="soilGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B4513" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#5C4033" stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute top-2 left-2 text-[8px] font-mono text-white/50 bg-black/60 px-1 rounded flex gap-2">
          <span>β={selectedCell.slope_mean.toFixed(1)}°</span>
          <span>z={selectedCell.soil_depth_m}m</span>
          {selectedCell.fos_seismic < 1.5 && <span className="text-risk-orange font-bold">Failure Plane Detected</span>}
          {selectedCell.fos_seismic < 1.2 && <span className="text-risk-red font-bold">Tension Crack Active</span>}
        </div>
      </div>
    </div>
  );
};

export default SlopeCrossSection;
