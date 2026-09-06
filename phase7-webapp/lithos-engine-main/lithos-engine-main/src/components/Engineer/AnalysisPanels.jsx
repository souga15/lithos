import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Target } from 'lucide-react';
import API_BASE_URL from '../../apiConfig';

export const PostDisasterPanel = ({ selectedCell }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (selectedCell) {
      axios.post(`${API_BASE_URL}/api/engineer/post-disaster-assessment`, {
        deformation_proxy: selectedCell.deformation_proxy || 0.05,
        slope_mean: selectedCell.slope_mean
      }).then(res => setData(res.data)).catch(console.error);
    }
  }, [selectedCell]);

  if (!data) return <div className="glass p-4 rounded-xl border-risk-red/30 bg-risk-red/10 animate-pulse h-48"></div>;

  return (
    <div className="glass p-4 rounded-xl border-risk-red/30 bg-risk-red/10 shimmer">
      <h3 className="text-xs font-black uppercase text-risk-red mb-3 flex items-center gap-2">
        <Target className="w-4 h-4" /> Post-Disaster Assessment
      </h3>
      <div className="space-y-3">
        <div className="bg-black/40 p-3 rounded-lg border border-risk-red/20 font-mono text-sm">
          <div className="text-[10px] text-risk-red/70 uppercase font-bold mb-1 font-sans flex justify-between">
            <span>Failed Mass Volume</span>
            <span className="text-white/60">Estimated Cost: ₹{(data.est_cost_inr / 100000).toFixed(2)}L</span>
          </div>
          {data.volume_m3.toLocaleString()} m³
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white/5 p-2 rounded-lg">
            <span className="text-white/40 uppercase block text-[10px]">Tipper Loads</span>
            <span className="font-bold text-white">~{data.tipper_loads}</span>
          </div>
          <div className="bg-white/5 p-2 rounded-lg col-span-2">
            <span className="text-white/40 uppercase block text-[10px]">Est Clearance Time</span>
            <span className="font-bold text-risk-orange">{data.clearance_days} Days</span>
          </div>
        </div>

        <div className="bg-white/5 p-3 rounded-lg text-xs">
          <span className="text-white/40 uppercase block text-[10px] mb-1">Evacuation & Equipment</span>
          <ul className="list-disc pl-4 space-y-1 text-white/80">
            <li>{data.jcb_required}× JCB Heavy Excavators</li>
            <li>{data.tipper_trucks}× Tipper Trucks</li>
            {data.volume_m3 > 5000 && <li>1× Heavy Rock Breaker Unit</li>}
            <li>Temporary Traffic Control Barriers</li>
            <li>Geotextile cover for exposed slope</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export const CostBenefitPanel = ({ selectedCell }) => {
  const [roadClass, setRoadClass] = useState('NH');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (selectedCell) {
      axios.post(`${API_BASE_URL}/api/engineer/cost-benefit`, {
        slope_mean: selectedCell.slope_mean,
        road_class: roadClass
      }).then(res => setData(res.data)).catch(console.error);
    }
  }, [selectedCell, roadClass]);

  if (!data) return <div className="glass p-4 rounded-xl border-white/10 animate-pulse h-40"></div>;

  return (
    <div className="glass p-4 rounded-xl border-white/10">
      <div className="flex justify-between mb-3">
        <h3 className="text-xs font-black uppercase text-white/60">Cost-Benefit Analysis</h3>
        <select value={roadClass} onChange={e => setRoadClass(e.target.value)} className="bg-black/50 text-white text-[10px] rounded border border-white/20 p-1">
          <option className="bg-[#0A0E1A]" value="NH">National Highway</option>
          <option className="bg-[#0A0E1A]" value="SH">State Highway</option>
          <option className="bg-[#0A0E1A]" value="MDR">Major Dist Road</option>
        </select>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-risk-red">Cost of Inaction (Annual):</span>
          <span className="font-mono">₹{(data.annual_inaction_loss / 100000).toFixed(1)} L</span>
        </div>
        <div className="flex justify-between">
          <span className="text-risk-green">Treatment Cost (Est):</span>
          <span className="font-mono">₹{(data.treatment_cost / 100000).toFixed(1)} L</span>
        </div>
        <div className="flex justify-between font-bold pt-2 border-t border-white/10">
          <span>Payback Period:</span>
          <span className="text-[#00C2FF]">{data.payback_years} years</span>
        </div>
        <div className="flex justify-between font-bold pt-1">
          <span>10-Yr NPV (7% Discount):</span>
          <span className={data.npv_10yr > 0 ? 'text-risk-green' : 'text-risk-red'}>₹{(data.npv_10yr / 100000).toFixed(1)} L</span>
        </div>
      </div>
    </div>
  );
};

export const EarthquakeScenarioPanel = ({ selectedCell }) => {
  const [eqMagnitude, setEqMagnitude] = useState(6.0);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (selectedCell) {
      axios.post(`${API_BASE_URL}/api/engineer/simulate-earthquake`, {
        fos_static: selectedCell.fos_static,
        slope_mean: selectedCell.slope_mean,
        magnitude: eqMagnitude
      }).then(res => setData(res.data)).catch(console.error);
    }
  }, [selectedCell, eqMagnitude]);

  if (!data) return <div className="glass p-4 rounded-xl border-white/10 animate-pulse h-32"></div>;

  const { kh_sim, simulated_fos } = data;

  return (
    <div className="glass p-4 rounded-xl border-white/10">
      <div className="flex justify-between mb-3 items-center">
        <h3 className="text-xs font-black uppercase text-white/60 block">Earthquake Scenario Tool</h3>
        <select value={eqMagnitude} onChange={e => setEqMagnitude(parseFloat(e.target.value))} className="bg-risk-orange/20 text-risk-orange font-bold text-xs p-1 rounded outline-none w-16 text-center">
          <option className="bg-[#0A0E1A]" value="5.0">M 5.0</option>
          <option className="bg-[#0A0E1A]" value="6.0">M 6.0</option>
          <option className="bg-[#0A0E1A]" value="7.0">M 7.0</option>
          <option className="bg-[#0A0E1A]" value="8.0">M 8.0</option>
        </select>
      </div>
      
      <div className="bg-black/40 p-3 rounded-lg border border-white/10">
        <div className="grid grid-cols-4 gap-1 text-[10px] font-bold uppercase text-white/50 mb-2 border-b border-white/10 pb-1">
          <div>Mag</div><div>Kh</div><div>FoS</div><div>Status</div>
        </div>
        <div className="grid grid-cols-4 gap-1 text-xs items-center font-mono">
          <div>M {eqMagnitude.toFixed(1)}</div>
          <div>{kh_sim.toFixed(2)}</div>
          <div className={simulated_fos < 1.0 ? 'text-risk-red font-bold' : simulated_fos < 1.5 ? 'text-risk-orange' : 'text-risk-green'}>{simulated_fos.toFixed(2)}</div>
          <div className={simulated_fos < 1.0 ? 'bg-risk-red/20 text-risk-red px-1 rounded text-center font-bold text-[9px]' : simulated_fos < 1.5 ? 'bg-risk-orange/20 text-risk-orange px-1 rounded text-center font-bold text-[9px]' : 'bg-risk-green/20 text-risk-green px-1 rounded text-center font-bold text-[9px]'}>
            {simulated_fos < 1.0 ? 'FAIL 🔴' : simulated_fos < 1.5 ? 'MARGINAL ⚠️' : 'STABLE ✅'}
          </div>
        </div>
        {simulated_fos < 1.0 && (
          <div className="text-[10px] text-risk-red mt-2 pt-2 border-t border-risk-red/20 leading-tight flex flex-col gap-1">
            <span>This slope fails under M {eqMagnitude} earthquake.</span>
            <span>Structural retaining interventions mandatory as per IS 1893.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const RoadCutCalculator = ({ selectedCell }) => {
  const [cutHeight, setCutHeight] = useState(12);
  const [cutRoadWidth, setCutRoadWidth] = useState(7);
  
  return (
    <div className="glass p-4 rounded-xl border-white/10">
      <h3 className="text-xs font-black uppercase text-white/60 mb-3">Road Cut Slope Design</h3>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-white/50 uppercase block mb-1">Cut Height (m)</label>
          <input type="number" value={cutHeight} onChange={e => setCutHeight(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-1.5 text-xs text-white outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-white/50 uppercase block mb-1">Road Width (m)</label>
          <input type="number" value={cutRoadWidth} onChange={e => setCutRoadWidth(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-1.5 text-xs text-white outline-none" />
        </div>
      </div>
      <div className="bg-[#00C2FF]/10 p-3 rounded-lg border border-[#00C2FF]/20">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white/60">Recommended Ratio:</span>
          <span className="font-bold text-[#00C2FF]">{selectedCell.soil_type === 'quartzite' ? '1:0.25' : selectedCell.soil_type.includes('laterite') ? '1:1.5' : '1:1'}</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white/60">Earthwork Vol:</span>
          <span className="font-mono">~{(cutHeight * cutHeight * (selectedCell.soil_type === 'quartzite' ? 0.25 : 1.5) * 100).toFixed(0)} m³</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#00C2FF]/20 text-[10px]">
          <div className="flex flex-col"><span className="text-white/50 uppercase">IS Code</span><span className="font-bold">IS 14458:1998</span></div>
          <div className="flex flex-col"><span className="text-white/50 uppercase">IRC Code</span><span className="font-bold">IRC 75:2015</span></div>
          <div className="flex flex-col"><span className="text-white/50 uppercase">MoRTH</span><span className="font-bold">Clause 305</span></div>
          <div className="flex flex-col"><span className="text-white/50 uppercase">Maint.</span><span className="font-bold text-risk-orange">Annual Review</span></div>
        </div>
      </div>
    </div>
  );
};
