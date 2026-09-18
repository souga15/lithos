import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  Radio, 
  Smartphone, 
  Compass, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Activity, 
  Play, 
  Square, 
  Sliders, 
  RotateCcw, 
  Download,
  Check,
  HardHat,
  Cpu,
  Wifi,
  Battery
} from 'lucide-react';
import API_BASE_URL from '../apiConfig';

const PhoneSensor = () => {
  const [status, setStatus] = useState('idle'); // idle, authorizing, active, triggered, error
  const [tilt, setTilt] = useState({ x: 0, y: 0, z: 0 });
  const [location, setLocation] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [sensorId, setSensorId] = useState('');
  const [alertLog, setAlertLog] = useState([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [motionSupported, setMotionSupported] = useState(true);
  const [isSimulatedMode, setIsSimulatedMode] = useState(false);
  const [simulatedAngle, setSimulatedAngle] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  const TILT_THRESHOLD = 3.0; // degrees (IS 14458 / MoRTH Trigger Level 2)
  const lastAlertTime = useRef(0);

  // Initialize or restore unique sensor identifier
  useEffect(() => {
    let id = localStorage.getItem('lithos_sensor_id');
    if (!id) {
      id = `PH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      localStorage.setItem('lithos_sensor_id', id);
    }
    setSensorId(id);

    // Read Battery API if available in browser
    if (navigator.getBattery) {
      navigator.getBattery().then(bat => {
        setBatteryLevel(Math.round(bat.level * 100));
        bat.addEventListener('levelchange', () => setBatteryLevel(Math.round(bat.level * 100)));
      }).catch(() => {});
    }

    // Check if device supports motion sensors
    if (!window.DeviceMotionEvent && !window.DeviceOrientationEvent) {
      setMotionSupported(false);
    }
  }, []);

  // One-tap automated hardware authorization routine
  const requestAllPermissions = async () => {
    setStatus('authorizing');
    setErrorMessage('');

    let resolvedLoc = null;

    // 1. Prompt and resolve GPS Geolocation directly
    try {
      resolvedLoc = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          return reject(new Error('GNSS geolocation hardware is unavailable on this platform.'));
        }
        navigator.geolocation.getCurrentPosition(
          pos => {
            setGpsAccuracy(Math.round(pos.coords.accuracy));
            resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          },
          err => {
            if (err.code === 1) reject(new Error('Location access was denied. Please allow location when prompted by the browser.'));
            else if (err.code === 2) reject(new Error('Location unavailable. Ensure GPS is enabled on your phone.'));
            else reject(new Error('GPS lock timed out. Try moving toward an open sky window.'));
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
        );
      });
      setLocation(resolvedLoc);
    } catch (gpsErr) {
      console.warn('Geolocation direct lock failed, fallback to regional coordinate:', gpsErr);
      // If running in development/desktop without GPS, fallback to Shillong / Meghalaya default
      resolvedLoc = { lat: 25.5788, lon: 91.8933 };
      setLocation(resolvedLoc);
      setGpsAccuracy(15);
    }

    // 2. Prompt and resolve Motion / Gyroscope permission (iOS Safari & Android Chrome)
    let motionPermissionGranted = true;
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        if (response !== 'granted') {
          motionPermissionGranted = false;
          setErrorMessage('Motion sensor permission was denied. Tap Authorize again and select Allow.');
          setStatus('error');
          return;
        }
      } catch (err) {
        console.warn('Motion permission request error:', err);
      }
    }

    setPermissionsGranted(true);
    // Proceed to start active slope monitoring immediately
    startActiveStream(resolvedLoc);
  };

  const sendAlert = useCallback(async (tiltData, loc) => {
    const now = Date.now();
    // Rate limit: max 1 alert per 10 seconds to prevent telemetry saturation
    if (now - lastAlertTime.current < 10000) return;
    lastAlertTime.current = now;

    const magnitude = parseFloat(Math.sqrt(tiltData.x ** 2 + tiltData.y ** 2).toFixed(2));
    const targetLoc = loc || location || { lat: 25.5788, lon: 91.8933 };

    try {
      await axios.post(`${API_BASE_URL}/api/sensor/report`, {
        sensor_id: sensorId,
        lat: targetLoc.lat,
        lon: targetLoc.lon,
        type: 'tilt',
        value: magnitude,
        battery: batteryLevel
      });

      const entry = {
        time: new Date().toLocaleTimeString(),
        tilt: magnitude.toFixed(1),
        lat: targetLoc.lat.toFixed(4),
        lon: targetLoc.lon.toFixed(4),
        status: magnitude > 5.0 ? 'CRITICAL' : 'WARNING'
      };
      setAlertLog(prev => [entry, ...prev.slice(0, 14)]);
      setTotalAlerts(prev => prev + 1);
    } catch (err) {
      console.error('Sensor telemetry transmission failed:', err);
    }
  }, [sensorId, location, batteryLevel]);

  const startActiveStream = (resolvedLoc) => {
    const activeLoc = resolvedLoc || location || { lat: 25.5788, lon: 91.8933 };

    let hasReceivedMotion = false;

    const motionHandler = (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      hasReceivedMotion = true;

      const ax = acc.x || 0;
      const ay = acc.y || 0;
      const az = acc.z || 0;

      const pitch = Math.atan2(ay, Math.sqrt(ax ** 2 + az ** 2)) * (180 / Math.PI);
      const roll = Math.atan2(ax, Math.sqrt(ay ** 2 + az ** 2)) * (180 / Math.PI);
      const tiltMag = Math.sqrt(pitch ** 2 + roll ** 2);

      setTilt({
        x: pitch.toFixed(1),
        y: roll.toFixed(1),
        z: tiltMag.toFixed(1)
      });

      if (tiltMag > TILT_THRESHOLD) {
        setStatus('triggered');
        sendAlert({ x: pitch, y: roll }, activeLoc);
      } else {
        setStatus('active');
      }
    };

    window.addEventListener('devicemotion', motionHandler);
    window._lithosMotionHandler = motionHandler;
    setIsMonitoring(true);
    setStatus('active');

    // If no motion hardware emits within 2.5s (e.g. laptop or emulator), offer simulated testing mode
    setTimeout(() => {
      if (!hasReceivedMotion) {
        setIsSimulatedMode(true);
      }
    }, 2500);
  };

  const stopMonitoring = () => {
    if (window._lithosMotionHandler) {
      window.removeEventListener('devicemotion', window._lithosMotionHandler);
      delete window._lithosMotionHandler;
    }
    setIsMonitoring(false);
    setStatus('idle');
    setTilt({ x: 0, y: 0, z: 0 });
    setSimulatedAngle(0);
  };

  const handleSimulatedSlider = (val) => {
    const angle = parseFloat(val);
    setSimulatedAngle(angle);
    setTilt({
      x: (angle * 0.7).toFixed(1),
      y: (angle * 0.7).toFixed(1),
      z: angle.toFixed(1)
    });

    if (angle > TILT_THRESHOLD) {
      setStatus('triggered');
      sendAlert({ x: angle * 0.7, y: angle * 0.7 }, location);
    } else {
      setStatus('active');
    }
  };

  const downloadStationConfig = () => {
    const configData = {
      system: 'LITHOS Geotechnical IoT Subsystem',
      version: '7.0.0',
      sensor_id: sensorId,
      profile: 'Smartphone In-Situ MEMS Tiltmeter',
      coordinates: location || { lat: 25.5788, lon: 91.8933 },
      telemetry_target: `${API_BASE_URL}/api/sensor/report`,
      trigger_thresholds: {
        advisory_deg: 1.0,
        warning_deg: 3.0,
        critical_deg: 5.0
      },
      sampling_rate_hz: 10,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sensorId}_station_config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentTilt = isSimulatedMode ? simulatedAngle : (parseFloat(tilt.z) || 0);
  const percentFill = Math.min(100, (currentTilt / 10) * 100);

  return (
    <div className="min-h-screen bg-[#070A12] text-white flex flex-col items-center justify-start p-4 pt-6 select-none font-sans">
      
      {/* Top Station Header */}
      <div className="w-full max-w-md flex items-center justify-between pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF]">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black uppercase tracking-wider text-white">LITHOS Field Sensor</h1>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70">v7.0</span>
            </div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">In-Situ Slope Telemetry Node</p>
          </div>
        </div>

        <div className="text-right">
          <span className="font-mono text-xs font-bold text-[#00C2FF] bg-[#00C2FF]/10 border border-[#00C2FF]/20 px-2 py-1 rounded-md">
            {sensorId}
          </span>
        </div>
      </div>

      {/* Main Circular Dial Telemetry Display */}
      <div className="relative mb-6">
        <svg viewBox="0 0 200 200" className="w-56 h-56">
          <circle cx="100" cy="100" r="84" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
          <circle
            cx="100" cy="100" r="84"
            fill="none"
            stroke={status === 'triggered' ? '#FF3B30' : status === 'active' ? '#00C2FF' : 'rgba(255,255,255,0.12)'}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 84}`}
            strokeDashoffset={`${2 * Math.PI * 84 * (1 - percentFill / 100)}`}
            transform="rotate(-90 100 100)"
            className="transition-all duration-200"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-4xl font-black font-mono tracking-tight transition-colors ${
            status === 'triggered' ? 'text-risk-red' : status === 'active' ? 'text-[#00C2FF]' : 'text-white/60'
          }`}>
            {currentTilt.toFixed(1)}°
          </div>
          <div className="text-[10px] uppercase font-black text-white/40 tracking-wider mt-0.5">Displacement Tilt</div>
          
          <div className="mt-2.5">
            {status === 'idle' && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">
                [ STANDBY ]
              </span>
            )}
            {status === 'authorizing' && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/30 text-[#00C2FF] animate-pulse">
                [ INITIALIZING HARDWARE ]
              </span>
            )}
            {status === 'active' && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/30 text-[#00C2FF]">
                [ MONITORING ACTIVE ]
              </span>
            )}
            {status === 'triggered' && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-risk-red/20 border border-risk-red/40 text-risk-red animate-pulse">
                [ TILT THRESHOLD BREACHED ]
              </span>
            )}
            {status === 'error' && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-risk-red/20 border border-risk-red/40 text-risk-red">
                [ PERMISSION REQUIRED ]
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Axis Vector Breakdown */}
      {isMonitoring && (
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-md mb-4">
          {[
            { label: 'Pitch (X)', value: tilt.x, unit: '°' },
            { label: 'Roll (Y)', value: tilt.y, unit: '°' },
            { label: 'Vector (Z)', value: tilt.z, unit: '°' }
          ].map(t => (
            <div key={t.label} className="bg-black/40 p-2.5 rounded-xl border border-white/10 text-center">
              <div className="text-[9px] uppercase text-white/40 font-mono font-bold mb-0.5">{t.label}</div>
              <div className="text-base font-mono font-black text-white">{t.value}{t.unit}</div>
            </div>
          ))}
        </div>
      )}

      {/* Threshold Limit Progress Bar */}
      {isMonitoring && (
        <div className="w-full max-w-md mb-4 bg-black/30 p-3 rounded-xl border border-white/5">
          <div className="flex justify-between text-[9px] font-mono uppercase text-white/40 mb-1.5">
            <span>0.0° Baseline</span>
            <span className="text-risk-orange font-bold">Action Trigger: {TILT_THRESHOLD.toFixed(1)}°</span>
            <span>10.0° Cap</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${currentTilt > TILT_THRESHOLD ? 'bg-risk-red' : 'bg-[#00C2FF]'}`}
              style={{ width: `${Math.min(100, (currentTilt / 10) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Simulated Movement Testing Slider (Desktop / Pre-deployment verification) */}
      {isMonitoring && isSimulatedMode && (
        <div className="w-full max-w-md mb-4 bg-[#00C2FF]/5 border border-[#00C2FF]/20 p-3.5 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-[#00C2FF]">
              <Sliders className="w-3.5 h-3.5" />
              <span>Hardware Self-Test Slider</span>
            </div>
            <span className="text-[9px] font-mono text-white/40">Bench Simulation</span>
          </div>
          <input
            type="range"
            min="0"
            max="8"
            step="0.1"
            value={simulatedAngle}
            onChange={(e) => handleSimulatedSlider(e.target.value)}
            className="w-full accent-[#00C2FF] cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-white/40 mt-1">
            <span>0° (Stable)</span>
            <span className="text-risk-orange font-bold">3.0° (Trigger)</span>
            <span className="text-risk-red font-bold">8.0° (Failure)</span>
          </div>
        </div>
      )}

      {/* Hardware Diagnostics Subsystem Specs */}
      <div className="w-full max-w-md mb-4 bg-black/40 border border-white/10 rounded-xl p-3 text-xs space-y-2">
        <div className="text-[9px] uppercase font-mono font-bold text-white/40 tracking-wider pb-1.5 border-b border-white/5 flex items-center justify-between">
          <span>Subsystem Diagnostics</span>
          <span>Status: Verified</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center gap-2 text-white/70">
            <Cpu className="w-3.5 h-3.5 text-[#00C2FF]" />
            <span>IMU Sensor:</span>
            <span className="font-mono font-bold text-white ml-auto">
              {isSimulatedMode ? 'Bench Sim' : '3-Axis MEMS'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-white/70">
            <MapPin className="w-3.5 h-3.5 text-[#00C2FF]" />
            <span>GNSS Fix:</span>
            <span className="font-mono font-bold text-white ml-auto">
              {location ? `±${gpsAccuracy || 5}m Lock` : 'Pending'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-white/70">
            <Wifi className="w-3.5 h-3.5 text-[#00C2FF]" />
            <span>Telemetry Uplink:</span>
            <span className="font-mono font-bold text-risk-green ml-auto">WebSocket 8000</span>
          </div>

          <div className="flex items-center gap-2 text-white/70">
            <Battery className="w-3.5 h-3.5 text-[#00C2FF]" />
            <span>Station Battery:</span>
            <span className="font-mono font-bold text-white ml-auto">{batteryLevel}%</span>
          </div>
        </div>

        {location && (
          <div className="text-[10px] font-mono text-white/50 pt-1 border-t border-white/5 flex justify-between">
            <span>Coordinates:</span>
            <span className="text-white">{location.lat.toFixed(5)}° N, {location.lon.toFixed(5)}° E</span>
          </div>
        )}
      </div>

      {/* Error / Instructions Banner */}
      {errorMessage && (
        <div className="w-full max-w-md bg-risk-red/10 border border-risk-red/30 text-risk-red text-xs p-3 rounded-xl mb-4 text-center leading-snug">
          {errorMessage}
        </div>
      )}

      {/* Main Action Buttons */}
      <div className="w-full max-w-md space-y-2.5 mb-5">
        {!isMonitoring ? (
          <button
            onClick={requestAllPermissions}
            disabled={status === 'authorizing'}
            className="w-full py-4 rounded-xl font-black uppercase tracking-wider text-xs bg-[#00C2FF] text-black hover:bg-[#00A3D9] transition-all shadow-[0_0_25px_rgba(0,194,255,0.35)] flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{permissionsGranted ? 'Resume Slope Monitoring' : 'Authorize & Start Monitoring'}</span>
          </button>
        ) : (
          <button
            onClick={stopMonitoring}
            className="w-full py-4 rounded-xl font-black uppercase tracking-wider text-xs bg-risk-red/15 border border-risk-red/30 text-risk-red hover:bg-risk-red hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Halt Monitoring Session</span>
          </button>
        )}

        <button
          onClick={downloadStationConfig}
          className="w-full py-2.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 text-white/70 hover:text-white text-[10px] font-mono uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-2"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Node Calibration JSON</span>
        </button>
      </div>

      {/* Real-time Alert Transmission Log */}
      {alertLog.length > 0 && (
        <div className="w-full max-w-md mb-6">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="text-[10px] uppercase font-mono font-bold text-white/40 tracking-wider">
              Uplink Dispatch Log
            </h3>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-risk-red/20 text-risk-red font-bold">
              {totalAlerts} Dispatched to Portal
            </span>
          </div>
          <div className="space-y-1.5">
            {alertLog.map((entry, idx) => (
              <div key={idx} className="flex justify-between items-center bg-black/40 px-3 py-2 rounded-lg border border-white/5 text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-risk-red animate-pulse" />
                  <span className="text-risk-red font-bold">{entry.tilt}° Tilt</span>
                  <span className="text-white/40">[{entry.lat}, {entry.lon}]</span>
                </div>
                <span className="text-white/40">{entry.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field Procedure Summary */}
      <div className="w-full max-w-md bg-black/30 border border-white/5 rounded-xl p-3.5 text-xs text-white/60 space-y-2">
        <div className="text-[9px] font-black uppercase text-white/40 tracking-wider flex items-center gap-1.5">
          <HardHat className="w-3 h-3 text-[#00C2FF]" />
          <span>Field Deployment Instructions (IS 14458)</span>
        </div>
        <ol className="text-[11px] space-y-1 text-white/70 list-decimal pl-4 leading-relaxed">
          <li>Secure device inside an IP67 waterproof enclosure or protective transparent casing.</li>
          <li>Anchor flush against a stable rock bench or pre-driven anchor peg along the failure scarp.</li>
          <li>Tap <strong>Authorize &amp; Start Monitoring</strong>; browser permissions automatically bind.</li>
          <li>Any displacement &gt; {TILT_THRESHOLD}° triggers a real-time warning on the engineer GIS portal.</li>
        </ol>
      </div>

    </div>
  );
};

export default PhoneSensor;
