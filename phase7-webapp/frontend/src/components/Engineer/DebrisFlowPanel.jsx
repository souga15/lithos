import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, ShieldAlert, ArrowDownRight, Layers, Compass, HelpCircle, HardHat, Info, Activity } from 'lucide-react';
import API_BASE_URL from '../../apiConfig';

const DebrisFlowPanel = ({ selectedCell, onRunoutDataLoaded }) => {
  const [mode, setMode] = useState('civil'); // 'civil' or 'layman'
  const [runout, setRunout] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCell || !selectedCell.cell_id) {
      setRunout(null);
      return;
    }

    setLoading(true);
    axios.get(`${API_BASE_URL}/api/runout/${selectedCell.cell_id}`)
      .then(res => {
        setRunout(res.data);
        if (onRunoutDataLoaded) onRunoutDataLoaded(res.data);
      })
      .catch(err => {
        console.error('Runout fetch failed, computing local estimate:', err);
        // Fallback local calculation based on slope properties
        const slope = selectedCell.slope_mean || 32;
        const depth = Math.max(1.5, selectedCell.soil_depth_m || 2.5);
        const area_m2 = 40000; // typical slope unit sample
        const vol = area_m2 * depth * Math.sin(slope * Math.PI / 180);
        const H_m = Math.max(30, vol ** 0.33 * 4);
        const travel_angle = selectedCell.soil_type?.includes('colluvium') ? 8.0 : 11.0;
        const dist_m = H_m / Math.tan(travel_angle * Math.PI / 180);

        const fallback = {
          source_cell_id: selectedCell.cell_id,
          debris_volume_m3: Math.round(vol),
          runout_distance_m: Math.round(dist_m),
          H_m: Math.round(H_m),
          travel_angle_deg: travel_angle,
          aspect_deg: 180,
          cascade_risk: selectedCell.fos_seismic < 1.0 ? 'HIGH' : selectedCell.fos_seismic < 1.3 ? 'MODERATE' : 'LOW',
          recommended_action: selectedCell.fos_seismic < 1.0 
            ? 'IMMEDIATE evacuation — critical runout path. Restrict roadway access.'
            : 'Maintain standard vigilance and monitor downslope drainage.'
        };
        setRunout(fallback);
        if (onRunoutDataLoaded) onRunoutDataLoaded(fallback);
      })
      .finally(() => setLoading(false));
  }, [selectedCell?.cell_id]);

  const volumeM3 = runout?.debris_volume_m3 || Math.round((selectedCell.soil_depth_m || 2.0) * 650);
  const runoutDistM = runout?.runout_distance_m || Math.round(Math.max(80, (selectedCell.slope_mean || 30) * 12));
  const dropHeightM = runout?.H_m || Math.round(runoutDistM * 0.2);
  const travelAngle = runout?.travel_angle_deg || 11.0;

  // Realistic highway clearance logistics (MoRTH / NHAI Standard 10-Wheeler Tipper: 10 m³ capacity)
  const tipperCapacityM3 = 10.0;
  const tipperLoads = Math.max(1, Math.round(volumeM3 / tipperCapacityM3));
  const stagedTrucks = Math.max(2, Math.min(12, Math.ceil(tipperLoads / 14)));
  const estClearanceDays = Math.max(1, Math.ceil(tipperLoads / (stagedTrucks * 8)));
  const olympicPools = (volumeM3 / 2500).toFixed(1);
  const densityTonnePerM3 = 1.95; // compacted wet colluvium ~1.95 t/m³
  const totalWeightTonnes = Math.round(volumeM3 * densityTonnePerM3);

  // Velocity & Impact Pressure for Civil View (Hungr / Scheidegger model)
  const g = 9.81;
  const slopeRad = ((selectedCell.slope_mean || 30) * Math.PI) / 180;
  const travelRad = (travelAngle * Math.PI) / 180;
  const theoreticalVel = Math.sqrt(Math.max(4.0, 2 * g * dropHeightM * (1 - Math.tan(travelRad) / Math.tan(slopeRad))));
  const impactPressureKPa = Math.round((densityTonnePerM3 * 1000 * (theoreticalVel ** 2)) / 1000); // rho * v^2 in kPa

  // Recommended barrier capacity in kJ (E_k = 0.5 * m_block * v^2)
  const barrierRatingKJ = Math.min(5000, Math.max(500, Math.round(0.5 * 15 * (theoreticalVel ** 2))));

  return (
    <div className="glass p-4 rounded-xl border border-white/10 relative overflow-hidden bg-black/30">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FF9500]/20 text-[#FF9500] flex items-center justify-center font-black">
            <ArrowDownRight className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
              Debris &amp; Runout Impact
              {loading && <span className="text-[10px] text-[#00C2FF] animate-pulse font-mono">CALCULATING...</span>}
            </h3>
            <p className="text-[9px] text-white/50">Fahrböschung Mass Trajectory &amp; Hazard Zone</p>
          </div>
        </div>

        {/* Dual Mode Toggle Button */}
        <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold">
          <button
            onClick={() => setMode('civil')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'civil' 
                ? 'bg-[#00C2FF] text-black font-black shadow-[0_0_12px_rgba(0,194,255,0.4)]' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            <HardHat className="w-3 h-3" />
            <span>CIVIL SPEC</span>
          </button>
          <button
            onClick={() => setMode('layman')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'layman' 
                ? 'bg-[#FF9500] text-black font-black shadow-[0_0_12px_rgba(255,149,0,0.4)]' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3 h-3" />
            <span>LAYMAN GUIDE</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Civil Engineering Technical Specification */}
      {mode === 'civil' ? (
        <div className="space-y-3 animate-fade-in text-xs">
          {/* Top Numerical KPI Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
              <span className="text-[9px] uppercase font-black text-white/40 block mb-0.5">Failed Volume (V)</span>
              <span className="font-mono font-bold text-sm text-[#00C2FF]">{volumeM3.toLocaleString()}</span>
              <span className="text-[10px] text-white/40 ml-1">m³</span>
              <div className="text-[9px] text-white/40 mt-0.5 font-mono">≈ {totalWeightTonnes.toLocaleString()} t</div>
            </div>

            <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
              <span className="text-[9px] uppercase font-black text-white/40 block mb-0.5">Max Reach (L)</span>
              <span className="font-mono font-bold text-sm text-[#FF9500]">{runoutDistM}</span>
              <span className="text-[10px] text-white/40 ml-1">m</span>
              <div className="text-[9px] text-white/40 mt-0.5 font-mono">ΔH = {dropHeightM} m</div>
            </div>

            <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
              <span className="text-[9px] uppercase font-black text-white/40 block mb-0.5">Dyn. Pressure (P)</span>
              <span className="font-mono font-bold text-sm text-[#FF3B30]">{impactPressureKPa}</span>
              <span className="text-[10px] text-white/40 ml-1">kPa</span>
              <div className="text-[9px] text-white/40 mt-0.5 font-mono">v ≈ {theoreticalVel.toFixed(1)} m/s</div>
            </div>
          </div>

          {/* Kinematic & Geotechnical Mechanics Breakdown */}
          <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-2">
            <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-white/5">
              <span className="text-white/60">Fahrböschung Travel Angle (α):</span>
              <span className="font-mono font-bold text-white">{travelAngle.toFixed(1)}° ({selectedCell.soil_type?.includes('colluvium') ? 'Soft / Channelized' : 'Rock / Residual'})</span>
            </div>
            <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-white/5">
              <span className="text-white/60">Failure Depth (z) &amp; Soil Bulk Unit Wt:</span>
              <span className="font-mono font-bold text-white">{selectedCell.soil_depth_m || 2.5} m · γ = {densityTonnePerM3 * 9.81} kN/m³</span>
            </div>
            <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-white/5">
              <span className="text-white/60">Downslope Trajectory Aspect:</span>
              <span className="font-mono font-bold text-white">{runout?.aspect_deg || 180}° ({getAspectCardinal(runout?.aspect_deg || 180)})</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-white/60">Cascade Impact Vulnerability:</span>
              <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                runout?.cascade_risk === 'HIGH' ? 'bg-risk-red/20 text-risk-red' : runout?.cascade_risk === 'MODERATE' ? 'bg-risk-orange/20 text-risk-orange' : 'bg-risk-green/20 text-risk-green'
              }`}>
                {runout?.cascade_risk || 'MODERATE'} IMPACT ZONE
              </span>
            </div>
          </div>

          {/* Countermeasure Engineering Design (IS & IRC Codes) */}
          <div className="bg-[#00C2FF]/5 border border-[#00C2FF]/20 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-black text-[#00C2FF] mb-1.5 flex items-center justify-between">
              <span>Required Structural Countermeasures</span>
              <span>IS 14458 · IRC 75</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-white/80">
              <div className="bg-black/30 p-2 rounded">
                <span className="text-white/40 block uppercase text-[8px]">Catch Barrier Spec</span>
                <span className="font-bold text-white">Ring-Net Barrier ≥ {barrierRatingKJ} kJ</span>
              </div>
              <div className="bg-black/30 p-2 rounded">
                <span className="text-white/40 block uppercase text-[8px]">Torrent Drainage</span>
                <span className="font-bold text-white">Stepped Concrete Check Dam</span>
              </div>
            </div>
            <p className="text-[10px] text-white/60 mt-2 leading-relaxed">
              <strong>MoRTH Recommendation:</strong> Slope exhibits dynamic runout extending {runoutDistM}m downslope. Install flexible ring-net barriers with energy absorption brakes at toe, and construct deflection berms with 1.2m freeboard.
            </p>
          </div>
        </div>
      ) : (
        /* Mode 2: Layman / Field Officer View (Intuitive Plain English) */
        <div className="space-y-3 animate-fade-in text-xs">
          {/* Big Visual Analogies */}
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 p-3 rounded-lg border border-amber-500/20">
            <div className="text-[10px] uppercase font-black text-[#FF9500] mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> What Happens If This Hillside Collapses?
            </div>
            <p className="text-xs text-white/90 leading-relaxed">
              If this slope fails during heavy rain or an earthquake, approximately <strong className="text-amber-400">{volumeM3.toLocaleString()} cubic meters</strong> of mud, boulders, and trees will break loose and slide rapidly downhill.
            </p>
          </div>

          {/* Real World Comparison Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/40 p-3 rounded-lg border border-white/5 flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-white/5 text-amber-400 mt-0.5">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] text-white/40 uppercase font-black block">Tipper Truckloads</span>
                <div className="text-base font-black text-white">~{tipperLoads.toLocaleString()} loads</div>
                <span className="text-[10px] text-white/50">{stagedTrucks} trucks (~{estClearanceDays} days)</span>
              </div>
            </div>

            <div className="bg-black/40 p-3 rounded-lg border border-white/5 flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-white/5 text-cyan-400 mt-0.5">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] text-white/40 uppercase font-black block">Danger Distance</span>
                <div className="text-base font-black text-white">{runoutDistM} meters</div>
                <span className="text-[10px] text-white/50">downslope path reach</span>
              </div>
            </div>
          </div>

          {/* Plain English Action Guide for Field Crews */}
          <div className="bg-black/40 p-3 rounded-lg border border-white/10 space-y-2">
            <div className="text-[10px] uppercase font-black text-white/50 tracking-wider">
              Immediate Field Instructions for Ground Crews
            </div>
            <ul className="space-y-2 text-[11px] text-white/80">
              <li className="flex items-start gap-2">
                <span className="text-risk-red font-bold">1.</span>
                <span><strong>Danger Corridor:</strong> Clear any temporary settlements, parked machinery, or road workers within <strong>{runoutDistM} meters</strong> of the slope toe.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-risk-orange font-bold">2.</span>
                <span><strong>Highway Checkpoint:</strong> If continuous rainfall exceeds <strong>{selectedCell.rain_thresh_72h || 120} mm</strong>, close road traffic at least 300m before this section.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-risk-green font-bold">3.</span>
                <span><strong>Debris Staging:</strong> Stage a fleet of <strong>{stagedTrucks} tipper trucks</strong> (approx. <strong>{tipperLoads} shuttle trips</strong> over ~{estClearanceDays} days) for clearing operations.</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper: Convert degrees to compass direction
function getAspectCardinal(deg) {
  const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
  const index = Math.round(deg / 45) % 8;
  return directions[index];
}

export default DebrisFlowPanel;
