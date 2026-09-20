import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight, X, Volume2, ShieldAlert, CheckCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import API_BASE_URL from '../apiConfig';
import { alertAudio, sendBrowserNotification } from '../utils/alertAudio';

export default function AlertBanner() {
  const [activeAlert, setActiveAlert] = useState(null);
  const [dismissedId, setDismissedId] = useState(null);
  const socketRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    // 1. Initial check for active emergency alerts from backend
    const checkActive = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/alerts/active`);
        if (res.ok) {
          const data = await res.json();
          if (data.active_alerts && data.active_alerts.length > 0) {
            const top = data.active_alerts[0];
            if (top.alert_id !== dismissedId) {
              setActiveAlert(top);
            }
          }
        }
      } catch (_) {}
    };
    checkActive();

    // 2. Connect WebSocket for instant real-time broadcast
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws/alerts`;

    let ws = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'emergency_test_alert' || data.type === 'risk_alert' || data.risk_level === 'RED') {
              const incoming = {
                alert_id: data.alert_id || `ALT-${Date.now()}`,
                region: data.region,
                region_name: data.region_name || data.region,
                risk_level: data.risk_level || 'RED',
                message: data.message,
                triggered_at: data.timestamp || new Date().toISOString(),
                recommended_route: data.recommended_route || 'Divert via safe alternate corridor',
                rainfall_24h: data.rainfall_24h || 120.0
              };

              setActiveAlert(incoming);
              setDismissedId(null);

              // Play audible chime & trigger desktop/mobile push
              alertAudio.playEmergencyChime();
              sendBrowserNotification(`🚨 [CRITICAL LITHOS ALERT] ${incoming.region_name}`, {
                body: `${incoming.message} Evac route: ${incoming.recommended_route}`,
                url: '/route'
              });
            }
          } catch (e) {
            console.warn("[AlertBanner] WS parse error:", e);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 5000);
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connectWs, 8000);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [dismissedId]);

  if (!activeAlert || activeAlert.alert_id === dismissedId) {
    return null;
  }

  return (
    <aside 
      aria-label="Critical Emergency Landslide Alert"
      className="bg-gradient-to-r from-red-950 via-rose-900 to-red-950 border-b border-red-500/50 text-white shadow-2xl relative z-[9999] px-4 py-2.5 animate-in slide-in-from-top duration-300"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-red-600/30 border border-red-400 flex items-center justify-center shrink-0 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-red-300" />
          </div>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-red-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                CRITICAL WARNING
              </span>
              <span className="text-xs font-bold text-red-100 truncate">
                {activeAlert.region_name || 'Himalayan Corridor'}
              </span>
              <span className="text-[10px] text-red-300 font-mono hidden sm:inline">
                {new Date(activeAlert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-xs text-slate-200 truncate max-w-2xl font-medium mt-0.5">
              {activeAlert.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            onClick={() => alertAudio.playEmergencyChime()}
            className="p-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 transition-colors"
            title="Replay Alert Chime"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
          <Link
            to="/route"
            className="text-xs font-semibold bg-white hover:bg-slate-100 text-slate-950 px-3 py-1.5 rounded-lg shadow transition-all flex items-center gap-1.5"
          >
            <span>Safe Route</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setDismissedId(activeAlert.alert_id)}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/70 hover:text-white transition-colors"
            title="Dismiss Banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
