import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cpu, Wifi, Battery, AlertCircle, Plus, BookOpen, Download, Settings, Github, Radio, Zap, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import API_BASE_URL from '../../apiConfig';

const HardwareHub = () => {
  const [nodes, setNodes] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [manualInput, setManualInput] = useState({ lat: '25.2700', lon: '91.7300', type: 'tilt', value: '5.0' });
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // WebSocket — receive alerts from phone sensor in real time
  useEffect(() => {
    const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws/alerts';
    const ws = new WebSocket(wsUrl);
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
          }, ...prev]); // Keep infinite history
        }
      } catch(e) {}
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchNodes = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/sensor/nodes`);
      setNodes(resp.data.nodes);
    } catch (err) { console.error(err); }
  };

  const triggerMockAlert = async (node) => {
    setIsSimulating(true);
    try {
      await axios.post(`${API_BASE_URL}/api/sensor/report`, {
        sensor_id: node.sensor_id,
        lat: node.lat,
        lon: node.lon,
        type: node.type,
        value: 1.0,
        battery: node.battery - 1
      });
      alert(`Simulated Alert Sent for ${node.sensor_id}`);
    } catch (err) { console.error(err); }
    finally { setIsSimulating(false); }
  };

  const sendManualAlert = async () => {
    if (!manualInput.lat || !manualInput.lon || !manualInput.value) return;
    setIsSendingManual(true);
    setManualSuccess(false);
    try {
      await axios.post(`${API_BASE_URL}/api/sensor/report`, {
        sensor_id: 'MANUAL-PC',
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
      alert('Failed to send alert. Make sure the backend is running.');
    } finally {
      setIsSendingManual(false);
    }
  };

  const downloadReport = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').split('.')[0];

    const sensorTable = nodes.length > 0
      ? nodes.map(n =>
          `  ${n.sensor_id.padEnd(12)} | ${n.type.padEnd(10)} | ${n.status.padEnd(8)} | ${String(n.battery).padEnd(3)}% | ${n.last_seen}`
        ).join('\n')
      : '  No sensor nodes registered.';

    const alertLog = liveAlerts.length > 0
      ? liveAlerts.map(a =>
          `  [${a.time}]  ${a.sensor_id}  =>  Value: ${Number(a.value).toFixed(2)}°`
        ).join('\n')
      : '  No live alerts recorded in this session.';

    const report = `
================================================================================
         LITHOS — IoT Hardware Hub Report
         Generated: ${timestamp}
         System: Landslide Intelligence using Temporal & Hyperlocal Observation System
================================================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — REGISTERED SENSOR NODES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  SENSOR ID    | TYPE       | STATUS   | BAT | LAST SEEN
  -------------|------------|----------|-----|------------------
${sensorTable}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — LIVE ALERT SESSION LOG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${alertLog}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — HARDWARE CONSTRUCTION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  RECOMMENDED COMPONENTS (per sensor node):
  ┌─────────────────────────────┬────────────┬───────────────────────────┐
  │ Component                   │ Model      │ Purpose                   │
  ├─────────────────────────────┼────────────┼───────────────────────────┤
  │ Microcontroller             │ ESP32      │ Main compute + WiFi/BT    │
  │ Tilt / IMU Sensor           │ MPU-6050   │ Detect slope movement     │
  │ Soil Moisture Sensor        │ FC-28      │ Saturation level          │
  │ Vibration Sensor            │ SW-420     │ Seismic activity          │
  │ GSM Module (remote areas)   │ SIM800L    │ Cellular data reporting   │
  │ GPS Module                  │ NEO-6M     │ Location tagging          │
  │ Solar Panel + LiPo Battery  │ 6V / 2Ah  │ Off-grid power            │
  │ Waterproof Enclosure        │ IP67 Box   │ Outdoor protection        │
  └─────────────────────────────┴────────────┴───────────────────────────┘

  WIRING DIAGRAM (ESP32 + MPU-6050):
  ──────────────────────────────────
        ESP32              MPU-6050
        3.3V  ─────────── VCC
        GND   ─────────── GND
        GPIO21 ────────── SDA
        GPIO22 ────────── SCL
        (Interrupt pin optional: GPIO19 ── INT)

  POWER BUDGET (approx.):
    Active Mode:   ~250mA @ 3.3V
    Sleep Mode:    ~10µA  (deep sleep between readings)
    Solar Input:   6V 500mA panel sufficient for 24/7 ops
    Battery Life:  ~72hrs without solar, ~indefinite with solar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4 — GSM STAR TOPOLOGY (Remote Deployment)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Architecture:
    [Field Sensor 1] ──┐
    [Field Sensor 2] ──┤── GSM/SIM ──► LITHOS Backend API ──► Dashboard
    [Field Sensor 3] ──┘                (Port 8000)

  Each sensor sends HTTP POST to:
    POST /api/sensor/report
    Content-Type: application/json
    Body: {
      "sensor_id": "SN-XXX",
      "lat": <latitude>,
      "lon": <longitude>,
      "type": "tilt"|"moisture"|"vibration",
      "value": <reading>,
      "battery": <battery_percent>
    }

  On receipt, the backend:
    1. Logs the reading
    2. Broadcasts a real-time sensor_alert via WebSocket (/ws/alerts)
    3. The alert appears on the Engineer Portal map with a red pulse circle

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5 — PHONE SENSOR MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  URL: <your-lithos-domain>/sensor
  
  How it works:
    • Uses the phone's built-in accelerometer via DeviceMotionEvent API
    • No app install required — runs in any modern mobile browser
    • Tilt angle > 3° triggers an automatic alert to the backend
    • GPS coordinates are captured for location tagging

  Alert thresholds:
    • Tilt > 3°   → MONITORING
    • Tilt > 5°   → WARNING
    • Tilt > 8°   → CRITICAL (immediate backend notification)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6 — DEPLOYMENT CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Field Installation:
  [ ] Mount sensor on stable rock/anchor, NOT loose soil
  [ ] Align IMU axis along slope direction (downhill = positive X)
  [ ] Waterproof all connectors with silicone gel
  [ ] Test GSM signal before sealing enclosure
  [ ] Record GPS coordinates and register node in LITHOS system
  [ ] Verify battery charge > 80% before deployment
  [ ] Set deep-sleep interval: 15 min (normal), 1 min (RED risk zone)

  Maintenance Schedule:
    - Monthly: Battery check, clean solar panel
    - Quarterly: Data log download, enclosure inspection
    - Annual: Sensor calibration, firmware update

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7 — API REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  GET  /api/sensor/nodes          — List all registered sensor nodes
  POST /api/sensor/report         — Submit a sensor reading
  GET  /ws/alerts                 — WebSocket: real-time sensor alerts
  POST /api/engineer/auth         — Engineer Portal authentication
  GET  /api/risk-grid?region=X    — Geotechnical risk grid for region X
  GET  /api/proximity-alerts      — Nearby hazards (lat, lon, radius)

================================================================================
  LITHOS — Protecting Lives through Geospatial Intelligence
  Government of India | MoRTH Slope Monitoring Initiative
  Report generated by LITHOS Engineer Portal v7.0.0
================================================================================
`;

    const blob = new Blob([report.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LITHOS_IoT_Hub_Report_${now.toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in flex flex-col h-full">

        <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 pb-4 flex-grow">

          {/* Live Phone Sensor Feed */}
          <div className="glass p-4 rounded-2xl border border-[#00C2FF]/20 bg-[#00C2FF]/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#00C2FF]/10 text-[#00C2FF]">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-black text-xs uppercase tracking-tight text-[#00C2FF]">Live Sensor Feed</div>
                  <div className="text-[9px] text-white/40">Real-time via WebSocket</div>
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${liveAlerts.length > 0 ? 'bg-risk-red animate-pulse' : 'bg-white/20'}`} />
            </div>
            {liveAlerts.length === 0 ? (
              <div className="text-[10px] text-white/30 text-center py-4 border border-dashed border-white/10 rounded-xl">
                No incoming signals — waiting for sensor data
              </div>
            ) : (
              <div className="space-y-1.5 focus:outline-none">
                {liveAlerts.slice(0, 5).map(a => (
                  <div key={a.id} className="flex justify-between items-center bg-black/30 px-3 py-2 rounded-lg border border-risk-red/10 animate-fade-in relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-risk-red/0 via-risk-red/5 to-risk-red/0 -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />
                    <div className="flex items-center gap-2 relative z-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-risk-red animate-pulse shadow-[0_0_8px_rgba(255,59,48,0.8)]" />
                      <span className="text-[10px] font-mono font-bold text-risk-red">{a.sensor_id}</span>
                      <span className="text-[10px] text-white/50">— {Number(a.value).toFixed(1)}°</span>
                    </div>
                    <span className="text-[9px] text-white/30 font-mono relative z-10">{a.time}</span>
                  </div>
                ))}
                
                {liveAlerts.length > 5 && (
                  <button 
                    onClick={() => setShowHistory(true)}
                    className="w-full text-center text-[10px] uppercase font-black tracking-widest text-[#00C2FF] bg-[#00C2FF]/5 hover:bg-[#00C2FF]/10 py-2 rounded-lg mt-2 transition-colors border border-[#00C2FF]/10 hover:border-[#00C2FF]/30"
                  >
                    + VIEW ALL {liveAlerts.length} RECORDS DB
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Manual Sensor Alert Panel (Collapsible) */}
          <div className="glass rounded-2xl border border-white/10 overflow-hidden transition-all duration-300">
            {/* Header bar - Clickable Toggle */}
            <button 
              onClick={() => setShowManualInput(!showManualInput)}
              className={`w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors ${showManualInput ? 'border-b border-white/10 bg-black/20' : 'bg-transparent'}`}
            >
              <div className="flex items-center gap-3 text-left">
                <div className={`p-1.5 rounded-lg transition-colors ${showManualInput ? 'bg-[#00C2FF]/10 text-[#00C2FF]' : 'bg-white/5 text-white/40'}`}>
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <div className={`font-black text-xs uppercase tracking-widest transition-colors ${showManualInput ? 'text-white' : 'text-white/60'}`}>Inject Sensor Reading</div>
                  <div className="text-[9px] text-white/30 mt-0.5">Simulate a field sensor — no device required</div>
                </div>
              </div>
              <div className="text-white/40">
                {showManualInput ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </div>
            </button>
            
            {/* Expanded Content */}
            {showManualInput && (
              <div className="p-4 space-y-3 animate-fade-in bg-black/10">
                {/* Coordinates row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none" />
                    <input
                      type="number" step="0.0001"
                      placeholder="Latitude"
                      value={manualInput.lat}
                      onChange={e => setManualInput(p => ({ ...p, lat: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg pl-7 pr-2 py-2 text-xs font-mono text-white outline-none focus:border-[#00C2FF]/40 transition-colors placeholder-white/20"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none" />
                    <input
                      type="number" step="0.0001"
                      placeholder="Longitude"
                      value={manualInput.lon}
                      onChange={e => setManualInput(p => ({ ...p, lon: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg pl-7 pr-2 py-2 text-xs font-mono text-white outline-none focus:border-[#00C2FF]/40 transition-colors placeholder-white/20"
                    />
                  </div>
                </div>
                {/* Type + Value row */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={manualInput.type}
                    onChange={e => setManualInput(p => ({ ...p, type: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#00C2FF]/40 transition-colors appearance-none"
                  >
                    <option value="tilt">Tilt Sensor</option>
                    <option value="moisture">Moisture Sensor</option>
                    <option value="vibration">Vibration Sensor</option>
                  </select>
                  <div className="relative">
                    <input
                      type="number" step="0.1"
                      placeholder="Value (°)"
                      value={manualInput.value}
                      onChange={e => setManualInput(p => ({ ...p, value: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#00C2FF]/40 transition-colors placeholder-white/20"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-white/30 font-black pointer-events-none">°</span>
                  </div>
                </div>
                {/* Send button */}
                <button
                  onClick={sendManualAlert}
                  disabled={isSendingManual}
                  className={`w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all ${
                    manualSuccess
                      ? 'bg-risk-green/20 text-risk-green border border-risk-green/30'
                      : 'bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20 hover:bg-[#00C2FF] hover:text-black shadow-[0_0_20px_rgba(0,194,255,0.15)] hover:shadow-[0_0_25px_rgba(0,194,255,0.4)]'
                  } disabled:opacity-40`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {isSendingManual ? 'Transmitting...' : manualSuccess ? 'Signal Dispatched' : 'Transmit Alert'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {nodes.map(node => (
              <div key={node.sensor_id} className="glass p-4 rounded-2xl border-white/10 flex items-center justify-between hover:border-[#00C2FF]/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${node.status === 'online' ? 'bg-risk-green/10 text-risk-green' : 'bg-risk-red/10 text-risk-red shadow-[0_0_15px_rgba(255,59,48,0.3)]'}`}>
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-tight">{node.sensor_id}</h4>
                    <div className="flex gap-3 text-[10px] uppercase font-bold text-white/40">
                      <span className="flex items-center gap-1 text-[#00C2FF]"><Wifi className="w-3 h-3" /> {node.type} node</span>
                      <span>Last seen: {node.last_seen}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-white/30 uppercase font-black mb-1">Battery</div>
                    <div className={`text-sm font-black flex items-center gap-1 ${node.battery < 30 ? 'text-risk-red' : 'text-white'}`}>
                      <Battery className="w-3 h-3" /> {node.battery}%
                    </div>
                  </div>
                  <button 
                    disabled={isSimulating}
                    onClick={() => triggerMockAlert(node)}
                    title="Simulate alert for this node"
                    className="p-2.5 rounded-xl bg-risk-red/10 text-risk-red hover:bg-risk-red hover:text-white transition-all border border-risk-red/20"
                  >
                    <AlertCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className="w-full py-8 border-2 border-dashed border-white/10 rounded-3xl text-white/20 hover:text-[#00C2FF] hover:border-[#00C2FF]/30 hover:bg-[#00C2FF]/5 transition-all flex flex-col items-center justify-center gap-2">
            <Plus className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">Register New Community Sensor</span>
          </button>

          <div className="glass p-4 rounded-2xl border-[#00C2FF]/20 bg-[#00C2FF]/5 mt-2">
            <div className="flex items-center gap-3 mb-2">
              <div>
                <div className="font-black text-sm uppercase tracking-tight text-[#00C2FF]">Use Your Phone as a Sensor!</div>
                <div className="text-[10px] text-white/50">No hardware needed — works on any smartphone</div>
              </div>
            </div>
            <p className="text-xs text-white/60 mb-3 leading-relaxed">
              Open on your phone. Uses <strong className="text-white">accelerometer + GPS</strong> to detect slope movement and send alerts directly to LITHOS.
            </p>
            <a
              href="/sensor"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-[#00C2FF] text-black font-black uppercase tracking-widest rounded-xl text-xs text-center block hover:bg-[#009ACC] transition-all shadow-[0_0_20px_rgba(0,194,255,0.3)]"
            >
              📡 Open Phone Sensor Page
            </a>
          </div>

          {/* Instructions Box */}
          <div 
            onClick={downloadReport}
            className="glass p-5 rounded-2xl border border-risk-green/20 bg-risk-green/5 mt-4 flex items-center justify-between group cursor-pointer hover:bg-risk-green/10 hover:border-risk-green/40 transition-all shadow-lg shadow-risk-green/5"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-black/40 rounded-xl group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6 text-risk-green" />
              </div>
              <div>
                <h4 className="font-black text-sm uppercase tracking-tight text-risk-green flex items-center gap-2">
                  LITHOS IoT Instructions
                </h4>
                <p className="text-[10px] text-white/60 mt-1 leading-relaxed">
                  Instructions, how it works, and how to apply.<br/>All blueprints and protocols written in this PDF.
                </p>
              </div>
            </div>
            <button className="p-3 bg-risk-green text-black rounded-xl group-hover:bg-[#25a54b] shadow-[0_0_15px_rgba(48,209,88,0.3)] transition-all">
              <Download className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* SCI-FI FULL HISTORY MODAL */}
        {showHistory && (
          <div className="fixed inset-0 z-[9999] bg-[#03060c]/95 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in font-mono">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,194,255,0.05)_0%,transparent_70%)] pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00C2FF] to-transparent opacity-50 shadow-[0_0_20px_#00C2FF]" />
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-risk-red to-transparent opacity-50 shadow-[0_0_20px_#FF3B30]" />

            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#00C2FF]/30 relative shadow-[0_0_50px_rgba(0,194,255,0.1)] rounded-xl overflow-hidden bg-black/80">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#00C2FF]/30 bg-[#00C2FF]/5 relative overflow-hidden">
                <div className="absolute top-0 left-[-100%] w-1/2 h-full bg-gradient-to-r from-transparent via-[#00C2FF]/10 to-transparent animate-[shimmer_3s_infinite]" />
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full border border-[#00C2FF] flex items-center justify-center animate-[spin_4s_linear_infinite]">
                    <div className="w-4 h-4 rounded-full bg-[#00C2FF] shadow-[0_0_10px_#00C2FF]" />
                  </div>
                  <div>
                    <h2 className="text-[#00C2FF] text-xl font-black uppercase tracking-[0.2em] drop-shadow-[0_0_5px_#00C2FF]">
                      Global Sensor Database
                    </h2>
                    <p className="text-[10px] text-[#00C2FF]/60 uppercase tracking-widest mt-1">
                      System Event Log // Total Entries: {liveAlerts.length}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="px-4 py-2 border border-risk-red/50 text-risk-red hover:bg-risk-red hover:text-white uppercase text-[10px] font-black tracking-widest transition-all rounded shadow-[0_0_10px_rgba(255,59,48,0.2)]"
                >
                  Terminate Connection
                </button>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-5 px-6 py-3 border-b border-white/10 text-[10px] uppercase font-black text-white/40 tracking-widest bg-black/60 sticky top-0">
                <div>Timestamp</div>
                <div>Origin Node</div>
                <div>Coordinates</div>
                <div>Magnitude</div>
                <div className="text-right">Status</div>
              </div>

              {/* Data List */}
              <div className="flex-grow overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar">
                {liveAlerts.map(a => (
                  <div key={a.id} className="grid grid-cols-5 items-center p-3 text-xs border border-white/5 rounded backdrop-blur hover:bg-white/5 hover:border-white/20 transition-all group">
                    <div className="text-white/60 tracking-wider group-hover:text-white">{a.time}</div>
                    <div className="text-[#00C2FF] font-bold drop-shadow-[0_0_3px_#00C2FF]">{a.sensor_id}</div>
                    <div className="text-white/40">
                      {a.lat ? a.lat.toFixed(4) : '---'} <span className="text-white/20">/</span> {a.lon ? a.lon.toFixed(4) : '---'}
                    </div>
                    <div className="font-bold text-risk-red drop-shadow-[0_0_5px_#FF3B30] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-risk-red animate-[pulse_1s_infinite]"></span>
                      {Number(a.value).toFixed(2)}°
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-1 text-[9px] bg-risk-red/20 text-risk-red font-black uppercase tracking-widest border border-risk-red/30 rounded shadow-[0_0_10px_rgba(255,59,48,0.2)]">
                        CRITICAL ANOMALY
                      </span>
                    </div>
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
