/**
 * LITHOS — RunoutPanel
 * Shown inside the cell detail modal when fos_seismic < 1.0.
 * Fetches /api/runout/{cell_id} and displays:
 *   - Debris fan stats (H, runout distance, volume)
 *   - Impact counts (road risk, chain slopes, river risk)
 *   - Cascade risk badge + recommended action
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, Layers, Droplets, Mountain, Route } from 'lucide-react';

const CASCADE_COLORS = {
  HIGH:       { bg: 'bg-red-500/10',    border: 'border-red-500/20',    text: 'text-red-400'    },
  MODERATE:   { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  LOW:        { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-400'   },
  NEGLIGIBLE: { bg: 'bg-white/5',        border: 'border-white/10',     text: 'text-white/40'   },
};

const RunoutPanel = ({ runoutData, cell }) => {
  if (!runoutData) return (
    <div className="mt-3 p-3 bg-white/[0.02] rounded-lg border border-white/5 animate-pulse">
      <p className="text-[10px] text-white/40 font-mono tracking-wider">
        Computing runout trajectory...
      </p>
    </div>
  );

  const { cascade_risk, impacts, H_m, runout_distance_m,
          debris_volume_m3, travel_angle_deg, aspect_deg, aspect_known,
          recommended_action } = runoutData;
  const cc = CASCADE_COLORS[cascade_risk] || CASCADE_COLORS.NEGLIGIBLE;

  const fmt = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}k` : n;

  return (
    <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-white/50" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">
            Runout Analysis
          </span>
        </div>
        <div className={`px-2 py-0.5 rounded text-[9px] font-mono tracking-wider border ${cc.bg} ${cc.border} ${cc.text}`}>
          {cascade_risk} CASCADE
        </div>
      </div>

      {/* Debris stats row */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { icon: <Mountain className="w-3 h-3" />, label: 'Drop H', val: `${Math.round(H_m)}m`         },
          { icon: <Route    className="w-3 h-3" />, label: 'Runout', val: `${Math.round(runout_distance_m)}m` },
          { icon: <Layers   className="w-3 h-3" />, label: 'Volume', val: `${fmt(debris_volume_m3)}m³`  },
        ].map(item => (
          <div key={item.label}
               className="bg-white/[0.02] rounded-lg p-2 border border-white/5 text-center">
            <div className="flex justify-center text-white/30 mb-0.5">{item.icon}</div>
            <p className="text-[8px] font-mono text-white/30 uppercase">{item.label}</p>
            <p className="text-[11px] font-mono font-medium text-white/80">{item.val}</p>
          </div>
        ))}
      </div>

      {/* Travel params */}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2 text-[9px] font-mono text-white/40">
          <span>θ_f {travel_angle_deg}°</span>
          <span>•</span>
          <span>Aspect {Math.round(aspect_deg)}°</span>
        </div>
        {!aspect_known && (
          <p className="text-[9px] text-amber-300/80 font-mono flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> Direction unknown — showing worst-case radius
          </p>
        )}
      </div>

      {/* Impact counts */}
      <div className="space-y-1">
        <p className="text-[8px] font-mono uppercase tracking-wider text-white/30">
          Downstream Impacts
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Roads at risk', val: impacts.road_risk_cells.length,   color: 'text-amber-300' },
            { label: 'Chain slopes',  val: impacts.chain_slope_cells.length, color: 'text-red-400'    },
            { label: 'River impact',  val: impacts.river_risk ? 'YES' : 'NO', color: impacts.river_risk ? 'text-red-400' : 'text-white/30' },
          ].map(item => (
            <div key={item.label} className="bg-white/[0.02] p-1.5 rounded-lg border border-white/5 text-center">
              <p className="text-[8px] font-mono text-white/30 uppercase mb-0.5">{item.label}</p>
              <p className={`text-xs font-mono font-medium ${item.color}`}>{item.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chain slope list (compact) */}
      {impacts.chain_slope_cells.length > 0 && (
        <div className="bg-red-500/[0.03] border border-red-500/10 rounded-lg p-2 space-y-1">
          <p className="text-[8px] font-mono text-red-400/80 uppercase tracking-wider mb-1">
            Marginal Slopes in Runout Path
          </p>
          {impacts.chain_slope_cells.slice(0, 3).map(c => (
            <div key={c.cell_id}
                 className="flex justify-between text-[9px] font-mono text-white/60">
              <span className="truncate">{c.cell_id}</span>
              <span className="text-amber-400/90 ml-2 shrink-0">
                FoS {c.fos_seismic} • {c.slope_mean}°
              </span>
            </div>
          ))}
          {impacts.chain_slope_cells.length > 3 && (
            <p className="text-[8px] font-mono text-white/30">
              +{impacts.chain_slope_cells.length - 3} more...
            </p>
          )}
        </div>
      )}

      {/* Recommended action */}
      <div className={`p-2.5 rounded-lg border ${cc.border} ${cc.bg}`}>
        <div className="flex gap-2 items-start">
          <Droplets className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cc.text}`} />
          <p className="text-[10px] leading-relaxed text-white/80">
            {recommended_action}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RunoutPanel;
