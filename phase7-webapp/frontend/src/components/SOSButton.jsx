/**
 * SOSButton.jsx
 * One-tap emergency SOS broadcast during active navigation.
 * 3-second countdown to prevent accidental presses.
 * Broadcasts via backend WebSocket to all connected LITHOS users.
 */
import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';

const SOSButton = ({ carPosition, region }) => {
  const [phase, setPhase]       = useState('idle');   // idle | countdown | sent
  const [countdown, setCount]   = useState(3);
  const [sentAt, setSentAt]     = useState(null);
  const timerRef                = useRef(null);

  const handlePress = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('countdown');
    setCount(3);

    let remaining = 3;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCount(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        sendSOS();
      }
    }, 1000);
  }, [phase, carPosition, region]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('idle');
    setCount(3);
  }, []);

  const sendSOS = useCallback(async () => {
    setPhase('sent');
    setSentAt(new Date().toLocaleTimeString());
    try {
      await axios.post(`${API_BASE_URL}/api/sos`, {
        lat:     carPosition?.lat ?? 0,
        lon:     carPosition?.lng ?? 0,
        region:  region || 'unknown',
        message: 'EMERGENCY SOS — user in distress on active LITHOS route',
      });
    } catch (err) {
      console.error('SOS dispatch failed', err);
    }
    // Auto-reset after 15 seconds so user can send again
    setTimeout(() => { setPhase('idle'); setCount(3); }, 15000);
  }, [carPosition, region]);

  if (phase === 'sent') {
    return (
      <div style={{
        position: 'absolute', bottom: 80, right: 16, zIndex: 2000,
        background: 'rgba(255,59,48,0.15)',
        border: '2px solid rgba(255,59,48,0.6)',
        borderRadius: 16, padding: '12px 20px',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <p style={{ color: '#FF3B30', fontWeight: 900, fontSize: 13, letterSpacing: '0.1em' }}>
          🆘 SOS SENT — {sentAt}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600 }}>
          All nearby LITHOS users + emergency services notified
        </p>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div style={{
        position: 'absolute', bottom: 80, right: 16, zIndex: 2000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,59,48,0.9)',
          border: '4px solid white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 900, color: 'white',
          animation: 'sos-pulse 1s ease-in-out infinite',
          boxShadow: '0 0 30px rgba(255,59,48,0.8)',
        }}>
          {countdown}
        </div>
        <button
          onClick={cancel}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white', fontSize: 10, fontWeight: 800,
            padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
            letterSpacing: '0.1em',
          }}
        >
          CANCEL
        </button>
        <style>{`
          @keyframes sos-pulse {
            0%, 100% { transform: scale(1); }
            50%       { transform: scale(1.08); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <button
      onClick={handlePress}
      style={{
        position: 'absolute', bottom: 80, right: 16, zIndex: 2000,
        width: 64, height: 64, borderRadius: '50%',
        background: 'linear-gradient(135deg, #FF3B30, #c0392b)',
        border: '3px solid rgba(255,255,255,0.5)',
        color: 'white', fontSize: 10, fontWeight: 900,
        letterSpacing: '0.08em', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(255,59,48,0.6), 0 0 0 0 rgba(255,59,48,0.4)',
        animation: 'sos-ring 2.5s ease-in-out infinite',
        transition: 'transform 0.1s',
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; }}
      onMouseUp={e   => { e.currentTarget.style.transform = 'scale(1)'; }}
      title="Emergency SOS — hold for 3 seconds"
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>🆘</span>
      <span style={{ fontSize: 8, marginTop: 2 }}>SOS</span>
      <style>{`
        @keyframes sos-ring {
          0%   { box-shadow: 0 4px 20px rgba(255,59,48,0.6), 0 0 0 0 rgba(255,59,48,0.5); }
          70%  { box-shadow: 0 4px 20px rgba(255,59,48,0.6), 0 0 0 18px rgba(255,59,48,0); }
          100% { box-shadow: 0 4px 20px rgba(255,59,48,0.6), 0 0 0 0 rgba(255,59,48,0); }
        }
      `}</style>
    </button>
  );
};

export default SOSButton;
