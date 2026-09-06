import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';

const PhoneSensor = () => {
  const [status, setStatus] = useState('idle'); // idle, requesting, active, triggered, error
  const [tilt, setTilt] = useState({ x: 0, y: 0, z: 0 });
  const [location, setLocation] = useState(null);
  const [sensorId, setSensorId] = useState('');
  const [alertLog, setAlertLog] = useState([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [permissionError, setPermissionError] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const TILT_THRESHOLD = 3.0; // degrees
  const lastAlertTime = useRef(0);

  useEffect(() => {
    // Generate a unique sensor ID for this phone session
    const stored = localStorage.getItem('lithos_sensor_id');
    if (stored) {
      setSensorId(stored);
    } else {
      const newId = `PH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      localStorage.setItem('lithos_sensor_id', newId);
      setSensorId(newId);
    }
  }, []);

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject('GPS not available on this device');
      // Try with cached position first (maximumAge: 60s), long timeout for cold fix
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        err => {
          // On timeout/error, retry once with low accuracy (faster network-based fix)
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            err2 => {
              if (err2.code === 1) reject('Location permission denied. Go to browser site settings and allow Location.');
              else if (err2.code === 2) reject('GPS unavailable. Make sure Location is ON in phone Settings.');
              else reject('GPS timed out. Move to open area or re-enable location and try again.');
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 }
          );
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
      );
    });
  };

  const sendAlert = useCallback(async (tiltData, loc) => {
    const now = Date.now();
    // Rate limit: max 1 alert per 15 seconds
    if (now - lastAlertTime.current < 15000) return;
    lastAlertTime.current = now;

    const magnitude = Math.sqrt(tiltData.x ** 2 + tiltData.y ** 2).toFixed(1);
    try {
      await axios.post(`${API_BASE_URL}/api/sensor/report`, {
        sensor_id: sensorId,
        lat: loc.lat,
        lon: loc.lon,
        type: 'tilt',
        value: parseFloat(magnitude),
        battery: 100 // placeholder for demo
      });
      const entry = {
        time: new Date().toLocaleTimeString(),
        tilt: magnitude,
        lat: loc.lat.toFixed(5),
        lon: loc.lon.toFixed(5)
      };
      setAlertLog(prev => [entry, ...prev.slice(0, 9)]);
      setTotalAlerts(prev => prev + 1);
    } catch (err) {
      console.error('Alert send failed:', err);
    }
  }, [sensorId]);

  const startMonitoring = async () => {
    setStatus('requesting');
    setPermissionError('');

    let loc;
    try {
      loc = await getLocation();
      setLocation(loc);
    } catch (err) {
      setPermissionError(`GPS Error: ${err}. Please allow location access and try again.`);
      setStatus('error');
      return;
    }

    // iOS requires explicit permission for DeviceMotion
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceMotionEvent.requestPermission();
        if (perm !== 'granted') {
          setPermissionError('Motion permission denied. Please allow motion access in your browser settings.');
          setStatus('error');
          return;
        }
      } catch (err) {
        setPermissionError('Could not request motion permission.');
        setStatus('error');
        return;
      }
    }

    const motionHandler = (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      // Convert raw acceleration to approx tilt angle in degrees
      const ax = acc.x || 0;
      const ay = acc.y || 0;
      const az = acc.z || 0;

      // Pitch and Roll in degrees
      const pitch = Math.atan2(ay, Math.sqrt(ax ** 2 + az ** 2)) * (180 / Math.PI);
      const roll = Math.atan2(ax, Math.sqrt(ay ** 2 + az ** 2)) * (180 / Math.PI);
      const tiltMag = Math.sqrt(pitch ** 2 + roll ** 2);

      setTilt({ x: pitch.toFixed(1), y: roll.toFixed(1), z: tiltMag.toFixed(1) });

      if (tiltMag > TILT_THRESHOLD) {
        setStatus('triggered');
        sendAlert({ x: pitch, y: roll }, loc);
      } else {
        setStatus('active');
      }
    };

    window.addEventListener('devicemotion', motionHandler);
    setIsMonitoring(true);
    setStatus('active');

    // Store handler ref for cleanup
    window._lithosMotionHandler = motionHandler;
  };

  const stopMonitoring = () => {
    if (window._lithosMotionHandler) {
      window.removeEventListener('devicemotion', window._lithosMotionHandler);
      delete window._lithosMotionHandler;
    }
    setIsMonitoring(false);
    setStatus('idle');
    setTilt({ x: 0, y: 0, z: 0 });
  };

  const tiltMag = parseFloat(tilt.z) || 0;
  const percentFill = Math.min(100, (tiltMag / 10) * 100);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex flex-col items-center justify-start p-4 pt-8 select-none">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">📡</div>
        <h1 className="text-2xl font-black uppercase tracking-tight">LITHOS Phone Sensor</h1>
        <p className="text-xs text-white/40 uppercase tracking-widest mt-1">Slope Monitoring Mode</p>
        <div className="mt-2 font-mono text-[#00C2FF] text-sm bg-[#00C2FF]/10 px-3 py-1 rounded-full inline-block">
          ID: {sensorId}
        </div>
      </div>

      {/* Main Status Circle */}
      <div className="relative mb-8">
        <svg viewBox="0 0 200 200" className="w-52 h-52">
          {/* Background circle */}
          <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
          {/* Progress arc */}
          <circle
            cx="100" cy="100" r="85"
            fill="none"
            stroke={status === 'triggered' ? '#FF3B30' : status === 'active' ? '#00C2FF' : 'rgba(255,255,255,0.1)'}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 85}`}
            strokeDashoffset={`${2 * Math.PI * 85 * (1 - percentFill / 100)}`}
            transform="rotate(-90 100 100)"
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-4xl font-black font-mono transition-colors ${status === 'triggered' ? 'text-risk-red' : 'text-[#00C2FF]'}`}>
            {tiltMag.toFixed(1)}°
          </div>
          <div className="text-[10px] uppercase font-black text-white/40 tracking-widest mt-1">Tilt Angle</div>
          <div className={`text-[10px] font-black uppercase mt-2 px-2 py-0.5 rounded-full ${status === 'triggered' ? 'bg-risk-red/20 text-risk-red animate-pulse' : status === 'active' ? 'bg-[#00C2FF]/10 text-[#00C2FF]' : 'bg-white/5 text-white/30'}`}>
            {status === 'idle' ? '● STANDBY' : status === 'requesting' ? 'STARTING...' : status === 'active' ? '● MONITORING' : status === 'triggered' ? '🔴 TILT DETECTED' : '⚠️ ERROR'}
          </div>
        </div>
      </div>

      {/* Tilt Values */}
      {isMonitoring && (
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
          {[
            { label: 'Pitch', value: tilt.x, unit: '°' },
            { label: 'Roll', value: tilt.y, unit: '°' },
            { label: 'Total', value: tilt.z, unit: '°' }
          ].map(t => (
            <div key={t.label} className="glass bg-black/30 p-3 rounded-xl text-center border border-white/5">
              <div className="text-[9px] uppercase text-white/30 font-black mb-1">{t.label}</div>
              <div className="text-lg font-mono font-bold">{t.value}{t.unit}</div>
            </div>
          ))}
        </div>
      )}

      {/* Location */}
      {location && (
        <div className="text-[10px] font-mono text-white/30 mb-4">
          📍 {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
        </div>
      )}

      {/* Threshold Indicator */}
      {isMonitoring && (
        <div className="w-full max-w-xs mb-6">
          <div className="flex justify-between text-[10px] uppercase text-white/40 mb-1">
            <span>0°</span>
            <span className="text-risk-orange font-black">⚠ THRESHOLD: {TILT_THRESHOLD}°</span>
            <span>10°</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${tiltMag > TILT_THRESHOLD ? 'bg-risk-red' : 'bg-[#00C2FF]'}`}
              style={{ width: `${Math.min(100, (tiltMag / 10) * 100)}%` }}
            />
          </div>
          <div className="w-full relative h-1 mt-0.5">
            <div className="absolute h-3 w-0.5 bg-risk-orange/60 top-0" style={{ left: `${(TILT_THRESHOLD / 10) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Error Display */}
      {permissionError && (
        <div className="w-full max-w-xs bg-risk-red/10 border border-risk-red/30 text-risk-red text-xs p-3 rounded-xl mb-4 text-center">
          {permissionError}
        </div>
      )}

      {/* Start/Stop Button */}
      <button
        onClick={isMonitoring ? stopMonitoring : startMonitoring}
        disabled={status === 'requesting'}
        className={`w-full max-w-xs py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all mb-6 ${
          isMonitoring
            ? 'bg-risk-red/20 text-risk-red border border-risk-red/30 hover:bg-risk-red hover:text-white'
            : 'bg-[#00C2FF] text-black hover:bg-[#009ACC] shadow-[0_0_30px_rgba(0,194,255,0.4)]'
        } disabled:opacity-40`}
      >
        {isMonitoring ? '⏹  Stop Monitoring' : '▶  Start Slope Monitor'}
      </button>

      {/* Alert Log */}
      {alertLog.length > 0 && (
        <div className="w-full max-w-xs">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[10px] uppercase font-black text-white/40 tracking-widest">Alert Log</h3>
            <span className="bg-risk-red/20 text-risk-red text-[10px] font-black px-2 py-0.5 rounded-full">{totalAlerts} sent to LITHOS</span>
          </div>
          <div className="space-y-2">
            {alertLog.map((entry, i) => (
              <div key={i} className="flex justify-between items-center glass bg-black/30 px-3 py-2 rounded-xl border border-white/5 text-[10px]">
                <span className="text-risk-red font-bold">🔴 {entry.tilt}° tilt</span>
                <span className="text-white/40">{entry.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      {!isMonitoring && (
        <div className="w-full max-w-xs mt-8 glass bg-black/30 p-4 rounded-2xl border border-white/5">
          <h3 className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-3">How it works</h3>
          <ol className="space-y-2 text-xs text-white/60 list-decimal pl-4">
            <li>Allow <strong className="text-white">Location + Motion</strong> access when prompted.</li>
            <li>Place phone in a <strong className="text-white">waterproof bag</strong> on the slope.</li>
            <li>When tilt exceeds <strong className="text-risk-orange">{TILT_THRESHOLD}°</strong>, an alert is sent to LITHOS server.</li>
            <li>Map shows a <strong className="text-risk-red">pulsing red circle</strong> at your GPS location.</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default PhoneSensor;
