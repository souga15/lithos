/**
 * BlockageReport.jsx
 * One-tap "Road Blocked" button during navigation.
 * Auto-expires in 4 hours. Instantly visible to all LITHOS users on that route.
 */
import React, { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';

const BlockageReport = ({ carPosition }) => {
  const [status, setStatus] = useState('idle'); // idle | confirming | sent | error

  const handleReport = async () => {
    if (status === 'confirming') {
      setStatus('sent');
      try {
        await axios.post(`${API_BASE_URL}/api/blockage`, {
          lat:     carPosition?.lat ?? 0,
          lon:     carPosition?.lng ?? 0,
          report_type: 'blockage',
          message: 'Road blocked — reported by LITHOS user',
        });
        setTimeout(() => setStatus('idle'), 8000);
      } catch {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 4000);
      }
    } else if (status === 'idle') {
      setStatus('confirming');
      setTimeout(() => { if (status !== 'sent') setStatus('idle'); }, 5000);
    }
  };

  const base = {
    position: 'absolute', bottom: 152, right: 16, zIndex: 2000,
    border: 'none', cursor: 'pointer',
    borderRadius: 14, padding: '10px 16px',
    display: 'flex', alignItems: 'center', gap: 8,
    backdropFilter: 'blur(12px)',
    transition: 'all 0.2s',
  };

  if (status === 'sent') return (
    <div style={{
      ...base, cursor: 'default',
      background: 'rgba(255,149,0,0.15)',
      border: '1px solid rgba(255,149,0,0.5)',
    }}>
      <span style={{ fontSize: 16 }}>🚧</span>
      <div>
        <p style={{ color: '#FF9500', fontWeight: 900, fontSize: 11, margin: 0 }}>BLOCKAGE REPORTED</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, margin: 0, fontWeight: 600 }}>
          All users on this route warned · Expires 4h
        </p>
      </div>
    </div>
  );

  if (status === 'error') return (
    <div style={{ ...base, background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.4)' }}>
      <span style={{ color: '#FF3B30', fontSize: 11, fontWeight: 800 }}>⚠ Failed to send</span>
    </div>
  );

  if (status === 'confirming') return (
    <div style={{ ...base, background: 'rgba(255,149,0,0.2)', border: '2px solid rgba(255,149,0,0.7)', gap: 12 }}>
      <span style={{ fontSize: 16 }}>🚧</span>
      <div>
        <p style={{ color: '#FF9500', fontWeight: 900, fontSize: 11, margin: 0 }}>Tap again to confirm</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, margin: 0 }}>Report road as blocked?</p>
      </div>
      <button
        onClick={handleReport}
        style={{
          background: '#FF9500', color: '#000', border: 'none',
          borderRadius: 8, padding: '5px 10px',
          fontSize: 9, fontWeight: 900, cursor: 'pointer',
          letterSpacing: '0.08em',
        }}
      >
        YES, BLOCKED
      </button>
    </div>
  );

  return (
    <button onClick={handleReport} style={{
      ...base,
      background: 'rgba(255,149,0,0.1)',
      border: '1px solid rgba(255,149,0,0.3)',
      color: '#FF9500',
    }}>
      <span style={{ fontSize: 16 }}>🚧</span>
      <div style={{ textAlign: 'left' }}>
        <p style={{ fontWeight: 900, fontSize: 11, margin: 0, letterSpacing: '0.05em' }}>ROAD BLOCKED</p>
        <p style={{ fontSize: 9, margin: 0, opacity: 0.6, fontWeight: 600 }}>Tap to warn others</p>
      </div>
    </button>
  );
};

export default BlockageReport;
