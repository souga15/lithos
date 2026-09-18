import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Cpu, 
  Wifi, 
  Battery, 
  AlertCircle, 
  Plus, 
  BookOpen, 
  Download, 
  Settings, 
  Radio, 
  Zap, 
  MapPin, 
  ChevronDown, 
  ChevronRight,
  Layers,
  ShieldAlert,
  HardHat,
  FileSpreadsheet,
  Activity,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import API_BASE_URL from '../../apiConfig';

const HardwareHub = () => {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry', 'blueprints', 'protocols'
  const [nodes, setNodes] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [manualInput, setManualInput] = useState({ lat: '25.5788', lon: '91.8933', type: 'tilt', value: '4.5' });
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // WebSocket — receive alerts from phone sensor in real time
  useEffect(() => {
    const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws/alerts';
    let ws;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (d.type === 'sensor_alert') {
            setLiveAlerts(prev => [{
              id: Date.now() + Math.random(),
              sensor_id: d.sensor_id,
              value: d.value || '?',
              time: new Date().toLocaleTimeString(),
              lat: d.lat,
              lon: d.lon
            }, ...prev]);
          }
        } catch(e) {}
      };
    } catch(e) {
      console.warn('WebSocket init failed:', e);
    }
    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 12000);
    return () => clearInterval(interval);
  }, []);

  const fetchNodes = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/sensor/nodes`);
      setNodes(resp.data.nodes || []);
    } catch (err) { 
      console.warn('Sensor nodes fetch:', err); 
    }
  };

  const triggerMockAlert = async (node) => {
    setIsSimulating(true);
    try {
      await axios.post(`${API_BASE_URL}/api/sensor/report`, {
        sensor_id: node.sensor_id,
        lat: node.lat,
        lon: node.lon,
        type: node.type,
        value: 3.8,
        battery: Math.max(1, node.battery - 1)
      });
    } catch (err) { 
      console.error(err); 
    } finally { 
      setIsSimulating(false); 
    }
  };

  const sendManualAlert = async () => {
    if (!manualInput.lat || !manualInput.lon || !manualInput.value) return;
    setIsSendingManual(true);
    setManualSuccess(false);
    try {
      await axios.post(`${API_BASE_URL}/api/sensor/report`, {
        sensor_id: 'MANUAL-FIELD',
        lat: parseFloat(manualInput.lat),
        lon: parseFloat(manualInput.lon),
        type: manualInput.type,
        value: parseFloat(manualInput.value),
        battery: 100
      });
      setManualSuccess(true);
      setTimeout(() => setManualSuccess(false), 3000);
    } catch (err) {
      console.error('Manual alert failed:', err);
    } finally {
      setIsSendingManual(false);
    }
  };

  const downloadReport = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').split('.')[0];

    const sensorTable = nodes.length > 0
      ? nodes.map(n =>
          `  ${n.sensor_id.padEnd(14)} | ${n.type.padEnd(12)} | ${n.status.padEnd(8)} | ${String(n.battery).padEnd(3)}% | ${n.last_seen}`
        ).join('\n')
      : '  No registered sensor nodes.';

    const alertLog = liveAlerts.length > 0
      ? liveAlerts.map(a =>
          `  [${a.time}]  ${a.sensor_id}  =>  Value: ${Number(a.value).toFixed(2)}°  at (${a.lat}, ${a.lon})`
        ).join('\n')
      : '  No live alerts recorded in current session.';

    const report = `================================================================================
         LITHOS — GEOTECHNICAL SENSOR NETWORK & ACTION SPECIFICATION
         System: Landslide Intelligence using Temporal & Hyperlocal Observation System
         Generated: ${timestamp}
         Compliance: IS 14458 (Parts 1-4) | MoRTH Section 3100 | IRC:75
================================================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. REGISTERED SENSOR STATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  STATION ID     | SENSOR TYPE  | STATUS   | BAT | LAST SEEN
  ---------------|--------------|----------|-----|------------------
${sensorTable}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. RECENT LIVE TELEMETRY LOG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${alertLog}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. GEOTECHNICAL BOREHOLE & CASING SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  A. IN-PLACE INCLINOMETER (IPI) STRING:
     - Casing: 70mm OD ABS grooved inclinometer casing
     - Grout Mix: 1:3:1 (Cement : Bentonite : Water) matched to soil shear modulus
     - Sensor Spacing: 1.0m intervals across the anticipated slip surface
     - Depth Target: 3.0m minimum penetration into stable bedrock refusal

  B. VIBRATING WIRE PIEZOMETER (VWP):
     - Filter: High air-entry porous ceramic / stainless steel tip
     - Sand Intake: Ottawa sand pack (0.5m thickness above & below tip)
     - Seal: Compacted bentonite pellet plug (1.0m minimum)
     - Pressure Range: 0 to 500 kPa with integrated NTC thermistor

  C. SURFACE MEMS TILTMETER:
     - Enclosure: IP67 cast aluminum with UV-resistant powder coat
     - Anchor: Stainless steel M12 expanding anchor drilled into bedrock
     - Resolution: 0.001° (±0.018 mm/m) with thermal drift compensation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. TRIGGER ACTION PROTOCOL MATRIX (IS 14458 / MoRTH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [TRIGGER LEVEL 1 - ADVISORY]
  - Condition: FoS >= 1.30, Tilt < 1.0°, Displacement < 0.5 mm/day
  - Action: Routine monitoring at 6-hour logging intervals. Inspect drainage channels.

  [TRIGGER LEVEL 2 - ALERT / WARNING]
  - Condition: FoS 1.00 - 1.29, Tilt 1.0° - 3.0°, Displacement 0.5 - 2.0 mm/day
  - Action: Increase telemetry rate to 1-minute intervals. Restrict highway lane to
            single-lane 20 km/h traffic. Mobilize rapid response excavators to toe.

  [TRIGGER LEVEL 3 - CRITICAL EVACUATION]
  - Condition: FoS < 1.00, Tilt > 3.0°, Displacement > 5.0 mm/day
  - Action: Immediate closure of roadway. Sound acoustic sirens. Evacuate all personnel
            within the calculated Fahrböschung runout impact cone.

================================================================================
LITHOS Geotechnical Engineering Framework | Ministry of Road Transport & Highways
================================================================================`;

    const blob = new Blob([report.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LITHOS_Geotechnical_Sensor_Report_${now.toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in flex flex-col h-full text-xs">

      {/* Top Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 rounded-xl border border-white/10 mb-4">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`py-2 rounded-lg font-black uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'telemetry'
              ? 'bg-[#00C2FF] text-black shadow-[0_0_15px_rgba(0,194,255,0.35)]'
              : 'text-white/50 hover:text-white'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('blueprints')}
          className={`py-2 rounded-lg font-black uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'blueprints'
              ? 'bg-[#00C2FF] text-black shadow-[0_0_15px_rgba(0,194,255,0.35)]'
              : 'text-white/50 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Blueprints</span>
        </button>

        <button
          onClick={() => setActiveTab('protocols')}
          className={`py-2 rounded-lg font-black uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'protocols'
              ? 'bg-[#00C2FF] text-black shadow-[0_0_15px_rgba(0,194,255,0.35)]'
              : 'text-white/50 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Action Matrix</span>
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto custom-scrollbar pr-1 pb-4 flex-grow">

        {/* TAB 1: TELEMETRY & LIVE STREAM */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4 animate-fade-in">
            {/* Live Phone Sensor Feed */}
            <div className="glass p-4 rounded-xl border border-[#00C2FF]/20 bg-[#00C2FF]/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#00C2FF]/10 text-[#00C2FF]">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-xs uppercase tracking-tight text-[#00C2FF]">Live Telemetry Feed</div>
                    <div className="text-[9px] text-white/40 font-mono">Uplink: WebSocket Port 8000</div>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${liveAlerts.length > 0 ? 'bg-risk-red animate-ping' : 'bg-risk-green'}`} />
              </div>

              {liveAlerts.length === 0 ? (
                <div className="text-[10px] text-white/40 text-center py-3 border border-dashed border-white/10 rounded-lg font-mono">
                  Awaiting sensor signals — listening on /ws/alerts
                </div>
              ) : (
                <div className="space-y-1.5">
                  {liveAlerts.slice(0, 4).map(a => (
                    <div key={a.id} className="flex justify-between items-center bg-black/40 px-3 py-2 rounded-lg border border-risk-red/20 font-mono text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-risk-red animate-pulse" />
                        <span className="font-bold text-risk-red">{a.sensor_id}</span>
                        <span className="text-white/60">Tilt: {Number(a.value).toFixed(1)}°</span>
                      </div>
                      <span className="text-white/40">{a.time}</span>
                    </div>
                  ))}
                  
                  {liveAlerts.length > 4 && (
                    <button 
                      onClick={() => setShowHistory(true)}
                      className="w-full text-center text-[9px] uppercase font-mono font-bold tracking-widest text-[#00C2FF] bg-[#00C2FF]/10 hover:bg-[#00C2FF]/20 py-1.5 rounded mt-2 transition-colors border border-[#00C2FF]/20"
                    >
                      View All {liveAlerts.length} Events in Archive
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Smartphone Sensor Launcher */}
            <div className="glass p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-cyan-400/10 text-cyan-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-wide text-white">In-Situ Mobile Sensor</h4>
                    <p className="text-[9px] text-white/50">Turn any mobile phone into a calibrated tiltmeter</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-risk-green/20 text-risk-green font-bold">
                  Zero Hardware Cost
                </span>
              </div>
              <p className="text-[11px] text-white/70 mb-3 leading-relaxed">
                Uses device 3-axis accelerometer and GNSS to stream slope failure warnings. Automatically prompts for browser permissions without requiring manual phone settings modification.
              </p>
              <a
                href="/sensor"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-[#00C2FF] hover:bg-[#00A3D9] text-black font-black uppercase tracking-wider rounded-lg text-[11px] text-center flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,194,255,0.3)]"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Launch Mobile Sensor Interface</span>
                <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
              </a>
            </div>

            {/* Manual Sensor Injection Panel */}
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <button 
                onClick={() => setShowManualInput(!showManualInput)}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors ${showManualInput ? 'border-b border-white/10 bg-black/20' : 'bg-transparent'}`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`p-1.5 rounded-lg ${showManualInput ? 'bg-[#00C2FF]/10 text-[#00C2FF]' : 'bg-white/5 text-white/40'}`}>
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-black text-[11px] uppercase tracking-wider text-white">Inject Telemetry Test Signal</div>
                    <div className="text-[9px] text-white/40">Verify map marker rendering &amp; GIS triggers</div>
                  </div>
                </div>
                <div className="text-white/40">
                  {showManualInput ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </button>
              
              {showManualInput && (
                <div className="p-3.5 space-y-2.5 animate-fade-in bg-black/20">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number" step="0.0001"
                      placeholder="Latitude"
                      value={manualInput.lat}
                      onChange={e => setManualInput(p => ({ ...p, lat: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-[#00C2FF]"
                    />
                    <input
                      type="number" step="0.0001"
                      placeholder="Longitude"
                      value={manualInput.lon}
                      onChange={e => setManualInput(p => ({ ...p, lon: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-[#00C2FF]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={manualInput.type}
                      onChange={e => setManualInput(p => ({ ...p, type: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#00C2FF]"
                    >
                      <option value="tilt">Tilt Sensor (°)</option>
                      <option value="moisture">Moisture Sensor (%)</option>
                      <option value="vibration">Vibration Sensor (g)</option>
                    </select>
                    <input
                      type="number" step="0.1"
                      placeholder="Value"
                      value={manualInput.value}
                      onChange={e => setManualInput(p => ({ ...p, value: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-[#00C2FF]"
                    />
                  </div>

                  <button
                    onClick={sendManualAlert}
                    disabled={isSendingManual}
                    className={`w-full py-2 rounded-lg font-black uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-all ${
                      manualSuccess
                        ? 'bg-risk-green/20 text-risk-green border border-risk-green/40'
                        : 'bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/30 hover:bg-[#00C2FF] hover:text-black'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isSendingManual ? 'Transmitting...' : manualSuccess ? 'Signal Dispatched' : 'Dispatch Test Telemetry'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Sensor Nodes List */}
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-mono font-bold text-white/40 tracking-wider">
                Field Sensor Registry ({nodes.length})
              </div>
              {nodes.map(node => (
                <div key={node.sensor_id} className="glass p-3 rounded-xl border border-white/10 flex items-center justify-between hover:border-[#00C2FF]/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${node.status === 'online' ? 'bg-risk-green/10 text-risk-green' : 'bg-risk-red/10 text-risk-red'}`}>
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-mono font-bold text-xs text-white">{node.sensor_id}</div>
                      <div className="text-[9px] text-white/40 font-mono">
                        {node.type.toUpperCase()} · Last: {node.last_seen}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[9px] text-white/40 uppercase font-mono">Bat</div>
                      <div className="font-mono text-xs font-bold text-white">{node.battery}%</div>
                    </div>
                    <button
                      disabled={isSimulating}
                      onClick={() => triggerMockAlert(node)}
                      title="Trigger threshold test alert"
                      className="p-1.5 rounded-lg bg-risk-red/10 text-risk-red hover:bg-risk-red hover:text-white transition-colors border border-risk-red/20"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Download Engineering Specifications */}
            <div 
              onClick={downloadReport}
              className="glass p-3.5 rounded-xl border border-risk-green/20 bg-risk-green/5 flex items-center justify-between cursor-pointer hover:bg-risk-green/10 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-risk-green/10 text-risk-green">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-black text-xs text-risk-green uppercase tracking-wide">Export Comprehensive Specification</div>
                  <div className="text-[9px] text-white/50">Full deployment guide, borehole schematics &amp; protocol matrix</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-risk-green" />
            </div>
          </div>
        )}

        {/* TAB 2: GEOTECHNICAL BOREHOLE BLUEPRINTS */}
        {activeTab === 'blueprints' && (
          <div className="space-y-4 animate-fade-in">
            {/* Blueprint 1: In-Place Inclinometer (IPI) */}
            <div className="glass p-4 rounded-xl border border-white/10 bg-black/40 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-[#00C2FF]" />
                  <h4 className="font-black text-xs uppercase tracking-wide text-white">In-Place Inclinometer (IPI) String</h4>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#00C2FF]/10 text-[#00C2FF] font-bold">
                  IS 14458 · Deep Slip
                </span>
              </div>

              <p className="text-[11px] text-white/70 leading-relaxed">
                Installed within a vertical borehole extending through the active slide body into underlying stable bedrock to track shear strain evolution.
              </p>

              {/* Technical Spec Box */}
              <div className="bg-black/60 p-3 rounded-lg border border-white/5 space-y-2 text-[10px] font-mono">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Borehole Diameter:</span>
                  <span className="text-white font-bold">100 mm to 150 mm (Rotary core drilled)</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Casing Profile:</span>
                  <span className="text-white font-bold">70 mm OD ABS grooved inclinometer pipe</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Grout Backfill Mix:</span>
                  <span className="text-white font-bold">1:3:1 (Cement : Bentonite : Water)</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Sensor Pitch:</span>
                  <span className="text-white font-bold">1.0 m to 2.0 m interval wheels in keyway</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Bedrock Embedment:</span>
                  <span className="text-[#00C2FF] font-bold">≥ 3.0 m into competent rock layer</span>
                </div>
              </div>
            </div>

            {/* Blueprint 2: Vibrating Wire Piezometer (VWP) */}
            <div className="glass p-4 rounded-xl border border-white/10 bg-black/40 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-black text-xs uppercase tracking-wide text-white">Vibrating Wire Piezometer (VWP)</h4>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-400/10 text-cyan-400 font-bold">
                  Pore Pressure (u)
                </span>
              </div>

              <p className="text-[11px] text-white/70 leading-relaxed">
                Monitors rapid rise in pore-water pressure along the slip surface during intense monsoon storms that triggers effective stress loss (σ' = σ - u).
              </p>

              <div className="bg-black/60 p-3 rounded-lg border border-white/5 space-y-2 text-[10px] font-mono">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Sensor Range:</span>
                  <span className="text-white font-bold">0 to 350 / 500 kPa Gauge</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Sand Intake Pack:</span>
                  <span className="text-white font-bold">Clean Ottawa silica sand, 0.5 m zone</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Bentonite Pellet Seal:</span>
                  <span className="text-white font-bold">1.0 m thick hydrated pellet barrier</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Transient Response:</span>
                  <span className="text-cyan-400 font-bold">&lt; 1 sec pressure equilibration</span>
                </div>
              </div>
            </div>

            {/* Blueprint 3: Surface MEMS Tiltmeter */}
            <div className="glass p-4 rounded-xl border border-white/10 bg-black/40 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  <h4 className="font-black text-xs uppercase tracking-wide text-white">Surface MEMS Tiltmeter</h4>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 font-bold">
                  Scarp Rotation
                </span>
              </div>

              <p className="text-[11px] text-white/70 leading-relaxed">
                Anchored directly to rock faces or retaining wall crowns to measure angular rotation prior to catastrophic detachment.
              </p>

              <div className="bg-black/60 p-3 rounded-lg border border-white/5 space-y-2 text-[10px] font-mono">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Enclosure:</span>
                  <span className="text-white font-bold">IP67 Die-cast Aluminum alloy</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Mounting Hardware:</span>
                  <span className="text-white font-bold">M12 Stainless chemical anchors into bedrock</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40">Resolution:</span>
                  <span className="text-white font-bold">0.001° (0.018 mm/m deflection)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Autonomy:</span>
                  <span className="text-amber-400 font-bold">Solar 6V 2W + LiFePO4 internal cell</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRIGGER ACTION PROTOCOL MATRIX */}
        {activeTab === 'protocols' && (
          <div className="space-y-3 animate-fade-in">
            <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/60">
              Trigger Action Response Plan (TARP) as codified in <strong>IS 14458</strong> and <strong>MoRTH Section 3100</strong> for high-hazard Himalayan corridors.
            </div>

            {/* Level 1: Advisory */}
            <div className="glass p-3.5 rounded-xl border border-risk-green/30 bg-risk-green/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-risk-green text-[10px] tracking-wider uppercase">
                  [ TRIGGER LEVEL 1 — ADVISORY ]
                </span>
                <span className="font-mono text-[9px] bg-risk-green/20 text-risk-green px-1.5 py-0.5 rounded">
                  FoS ≥ 1.30
                </span>
              </div>
              <div className="text-[11px] text-white/80 space-y-1">
                <div><strong>Criteria:</strong> Surface tilt &lt; 1.0°, displacement rate &lt; 0.5 mm/day, pore pressure normal.</div>
                <div className="text-white/60"><strong>Immediate Action:</strong> Maintain routine 6-hour logging. Inspect catchwater drains and clear debris blockages. Unrestricted vehicular flow permitted.</div>
              </div>
            </div>

            {/* Level 2: Alert / Warning */}
            <div className="glass p-3.5 rounded-xl border border-risk-orange/30 bg-risk-orange/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-risk-orange text-[10px] tracking-wider uppercase">
                  [ TRIGGER LEVEL 2 — WARNING ]
                </span>
                <span className="font-mono text-[9px] bg-risk-orange/20 text-risk-orange px-1.5 py-0.5 rounded">
                  FoS 1.00 – 1.29
                </span>
              </div>
              <div className="text-[11px] text-white/80 space-y-1">
                <div><strong>Criteria:</strong> Surface tilt 1.0° – 3.0°, displacement rate 0.5 – 2.0 mm/day, continuous rain &gt; 80 mm/24h.</div>
                <div className="text-white/60"><strong>Immediate Action:</strong> Switch telemetry to continuous 1-minute stream. Restrict traffic to single-lane 20 km/h with spotters. Pre-stage heavy excavators at slope toe. Inspect rockfall barrier wire ropes.</div>
              </div>
            </div>

            {/* Level 3: Critical Action / Evacuation */}
            <div className="glass p-3.5 rounded-xl border border-risk-red/40 bg-risk-red/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-risk-red text-[10px] tracking-wider uppercase">
                  [ TRIGGER LEVEL 3 — EMERGENCY ACTION ]
                </span>
                <span className="font-mono text-[9px] bg-risk-red/20 text-risk-red px-1.5 py-0.5 rounded">
                  FoS &lt; 1.00
                </span>
              </div>
              <div className="text-[11px] text-white/90 space-y-1">
                <div><strong>Criteria:</strong> Surface tilt &gt; 3.0°, accelerating displacement &gt; 5.0 mm/day, tension cracks opening rapidly.</div>
                <div className="text-white/70"><strong>Immediate Action:</strong> Complete highway closure. Activate audible warning sirens. Evacuate all personnel and dwellings located inside the calculated <strong>debris flow runout cone</strong>. Dispatch NDRF / SDRF teams.</div>
              </div>
            </div>

            {/* Countermeasure Reference */}
            <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-[10px] space-y-1.5">
              <div className="font-black uppercase text-white/50 tracking-wider">Mandatory Engineering Interventions</div>
              <div className="grid grid-cols-2 gap-2 text-white/70">
                <div className="bg-white/5 p-2 rounded">
                  <span className="text-[#00C2FF] font-bold block">Reinforced Soil Nailing</span>
                  <span>IS 14458: Part 2 · 25mm dia Fe500 bars at 1.5m c/c</span>
                </div>
                <div className="bg-white/5 p-2 rounded">
                  <span className="text-[#00C2FF] font-bold block">Subsurface Horizontal Drains</span>
                  <span>75mm perforated PVC pipes angled 5° upwards</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Full Event History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[9999] bg-[#03060c]/95 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in font-mono">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col border border-white/10 rounded-xl overflow-hidden bg-black/90">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <div>
                <h3 className="text-sm font-black uppercase text-white tracking-wider">Sensor Event Archive</h3>
                <p className="text-[10px] text-white/40">Total logged transmissions: {liveAlerts.length}</p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase"
              >
                Close
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
              {liveAlerts.map(a => (
                <div key={a.id} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded text-xs">
                  <span className="text-white/60">{a.time}</span>
                  <span className="text-[#00C2FF] font-bold">{a.sensor_id}</span>
                  <span className="text-white/40">[{a.lat}, {a.lon}]</span>
                  <span className="text-risk-red font-bold">{Number(a.value).toFixed(2)}°</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HardwareHub;
