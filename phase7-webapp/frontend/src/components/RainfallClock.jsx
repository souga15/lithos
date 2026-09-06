/**
 * RainfallClock.jsx
 * Shows live rainfall vs RED threshold with countdown to next risk level.
 * Calls /api/weather/live for current data + /api/forecast/summary for prediction.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';

const THRESHOLDS = { GREEN_TO_ORANGE: 80, ORANGE_TO_RED: 150 };

const RainfallClock = ({ region }) => {
  const [weather,  setWeather]  = useState(null);
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    if (!region) return;
    const load = async () => {
      try {
        const [w, f] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/weather/live?region=${region}`),
          axios.get(`${API_BASE_URL}/api/forecast/summary?region=${region}`),
        ]);
        setWeather(w.data);
        setForecast(f.data);
      } catch (_) {}
    };
    load();
    const id = setInterval(load, 120000); // refresh every 2 min
    return () => clearInterval(id);
  }, [region]);

  if (!weather) return null;

  const rain72h   = weather.rainfall_72h ?? 0;
  const threshold = THRESHOLDS.ORANGE_TO_RED;
  const pct       = Math.min(100, (rain72h / threshold) * 100);
  const level     = rain72h >= threshold ? 'RED'
    : rain72h >= THRESHOLDS.GREEN_TO_ORANGE ? 'ORANGE' : 'GREEN';

  const barColor  = level === 'RED' ? '#FF3B30' : level === 'ORANGE' ? '#FF9500' : '#30D158';

  const next6h    = forecast?.next_6h;
  const eta       = next6h?.level === 'RED' && level !== 'RED' ? '< 6h' : null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${barColor}33`,
      borderRadius: 14,
      padding: '10px 14px',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
          🌧 Rainfall Monitor
        </p>
        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
          color: barColor, textTransform: 'uppercase',
          background: `${barColor}22`, padding: '2px 8px', borderRadius: 20,
        }}>
          {level}
        </span>
      </div>

      {/* Values */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0 }}>
          {rain72h.toFixed(0)}<span style={{ fontSize: 10, opacity: 0.5, marginLeft: 3 }}>mm</span>
        </p>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0, fontWeight: 700 }}>
          / {threshold}mm RED threshold
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width:  `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
          borderRadius: 4,
          transition: 'width 0.8s ease',
        }} />
      </div>

      {/* ETA warning */}
      {eta && (
        <p style={{
          fontSize: 9, fontWeight: 900, color: '#FF3B30',
          marginTop: 6, margin: '6px 0 0',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          ⚠ Forecast: CRITICAL rainfall predicted in {eta}
        </p>
      )}

      {/* Forecast pills */}
      {forecast && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[
            { label: '6h',  data: forecast.next_6h  },
            { label: '24h', data: forecast.next_24h },
            { label: '72h', data: forecast.next_72h },
          ].map(({ label, data }) => {
            if (!data) return null;
            const c = data.level === 'RED' ? '#FF3B30' : data.level === 'ORANGE' ? '#FF9500' : '#30D158';
            return (
              <div key={label} style={{
                flex: 1, textAlign: 'center',
                background: `${c}18`, border: `1px solid ${c}44`,
                borderRadius: 8, padding: '4px 2px',
              }}>
                <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', margin: 0, fontWeight: 700 }}>{label}</p>
                <p style={{ fontSize: 10, color: c, margin: 0, fontWeight: 900 }}>{data.level}</p>
                <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{data.avg_rainfall_mm}mm</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RainfallClock;
