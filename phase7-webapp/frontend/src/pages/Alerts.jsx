import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import {
  BellRing, Signal, Battery, Mountain, Send, Mail, ShieldAlert,
  CheckCircle2, Radio, Smartphone, ArrowRight, RefreshCw, AlertTriangle,
  Zap, ExternalLink, Volume2, VolumeX, Download, Users, ShieldCheck, Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { alertAudio, requestNotificationPermission, sendBrowserNotification } from '../utils/alertAudio';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Email & Dispatch State
  const [email, setEmail] = useState('sougatakarm29@gmail.com');
  const [selectedRegion, setSelectedRegion] = useState('sikkim');
  const [customRegionsStr, setCustomRegionsStr] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [dispatchReceipt, setDispatchReceipt] = useState(null);
  const [subscribeStatus, setSubscribeStatus] = useState(null);
  const [subscriberCount, setSubscriberCount] = useState(0);

  // Browser Push Permission & Sound State
  const [notificationPerm, setNotificationPerm] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Phone Mockup / Live Receiver State
  const [phoneIncomingAlert, setPhoneIncomingAlert] = useState(null);
  const [phoneVibrating, setPhoneVibrating] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    fetchAlerts();
    fetchSubscribers();

    // WebSocket live stream
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws/alerts`;

    try {
      const ws = new WebSocket(wsUrl);
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
              rainfall_24h: data.rainfall_24h || 134.8,
              top_factor: 'pore_pressure_saturation',
              recommended_route: data.recommended_route || 'Divert to alternate bypass corridor',
              is_active: true,
              recipient: data.recipient || 'Community Broadcast',
            };
            setActiveAlerts(prev => [incoming, ...prev.filter(a => a.alert_id !== incoming.alert_id)]);
            setAlerts(prev => [incoming, ...prev.filter(a => a.alert_id !== incoming.alert_id)]);
            triggerPhoneAlert(incoming);

            // Trigger browser notification only if subscribed & not yet notified
            const isSubscribed = localStorage.getItem('lithos_subscribed') === 'true';
            const notified = JSON.parse(localStorage.getItem('lithos_notified') || '[]');
            
            if (isSubscribed && !notified.includes(incoming.alert_id)) {
              notified.push(incoming.alert_id);
              localStorage.setItem('lithos_notified', JSON.stringify(notified));
              if (!isAudioMuted) {
                alertAudio.playEmergencyChime();
              }
              sendBrowserNotification(`🚨 [CRITICAL LITHOS ALERT] ${incoming.region_name}`, {
                body: incoming.message,
                url: '/route'
              });
            }
          }
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };
    } catch (wsErr) {
      console.warn('WS connect error:', wsErr);
    }

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [isAudioMuted]);

  const fetchAlerts = async () => {
    try {
      const [r, a] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/alerts`),
        axios.get(`${API_BASE_URL}/api/alerts/active`),
      ]);
      const fetchedAlerts = r.data.alerts || [];
      const fetchedActive = a.data.active_alerts || [];
      setAlerts(fetchedAlerts);
      setActiveAlerts(fetchedActive);
      if (fetchedActive.length > 0) {
        setPhoneIncomingAlert(fetchedActive[0]);
      } else if (fetchedAlerts.length > 0) {
        setPhoneIncomingAlert(fetchedAlerts[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/alerts/subscribers`);
      if (res.data) {
        setSubscriberCount(res.data.count || 0);
      }
    } catch (_) {}
  };

  const handleEnableNotifications = async () => {
    const status = await requestNotificationPermission();
    setNotificationPerm(status);
    if (status === 'granted') {
      alertAudio.playSuccessTone();
      sendBrowserNotification("✅ LITHOS Push Alerts Activated", {
        body: "You will receive real-time desktop & mobile alerts whenever critical landslide risks occur.",
        url: '/alerts'
      });
    }
  };

  const triggerPhoneAlert = (alertObj) => {
    setPhoneIncomingAlert(alertObj);
    setPhoneVibrating(true);
    setTimeout(() => setPhoneVibrating(false), 2000);
  };

  const handleSendTestAlert = async (e) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      alert('Please provide a valid email address');
      return;
    }

    setIsSending(true);
    setDispatchReceipt(null);

    try {
      const firstCustomRegion = customRegionsStr.split(',')[0].trim() || 'sikkim';
      const res = await axios.post(`${API_BASE_URL}/api/alerts/send-test`, {
        email: email.trim(),
        region: firstCustomRegion,
        hazard_level: 'RED'
      });

      if (res.data.success) {
        setDispatchReceipt(res.data);
        const newAlert = res.data.alert;
        setActiveAlerts(prev => [newAlert, ...prev.filter(a => a.alert_id !== newAlert.alert_id)]);
        setAlerts(prev => [newAlert, ...prev.filter(a => a.alert_id !== newAlert.alert_id)]);
        triggerPhoneAlert(newAlert);

        // Real OS push notification
        if (!isAudioMuted) {
          alertAudio.playEmergencyChime();
        }
        sendBrowserNotification(`🚨 [CRITICAL LITHOS ALERT] ${newAlert.region_name || selectedRegion}`, {
          body: newAlert.message,
          url: '/route'
        });
      }
    } catch (err) {
      console.error('Dispatch failed:', err);
      alert('Dispatch failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSending(false);
    }
  };

  const handleSubscribe = async () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }
    setIsSubscribing(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/alerts/subscribe`, {
        email: email.trim(),
        regions: customRegionsStr.split(',').map(s => s.trim()).filter(Boolean),
      });
      setSubscribeStatus(res.data.message || `Subscribed ${email}`);
      if (res.data.total_subscribers != null) {
        setSubscriberCount(res.data.total_subscribers);
      }
      localStorage.setItem('lithos_subscribed', 'true');
      alertAudio.playSuccessTone();
      setTimeout(() => setSubscribeStatus(null), 6000);
    } catch (err) {
      console.error('Subscription error:', err);
      alert('Subscription failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubscribing(false);
    }
  };



  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in pb-24 font-sans">

      {/* ── REAL BROWSER NOTIFICATION & AUDIO CONTROLS BAR ── */}
      <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-950 to-slate-900/90 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            notificationPerm === 'granted' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
          }`}>
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Live System Alert Status
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                notificationPerm === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {notificationPerm === 'granted' ? 'OS PUSH ACTIVE' : 'PUSH STANDBY'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {notificationPerm === 'granted'
                ? 'Desktop & mobile system notifications are enabled for real-time hazard broadcasts.'
                : 'Enable browser notifications to receive instant emergency landslide warnings on your device.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {notificationPerm !== 'granted' && (
            <button
              onClick={handleEnableNotifications}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Enable Browser Alerts</span>
            </button>
          )}

          <button
            onClick={() => alertAudio.playEmergencyChime()}
            className="px-3 py-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Test audible emergency siren"
          >
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test Alarm Chime</span>
          </button>

          <a
            href={`${API_BASE_URL}/api/alerts/cap.xml`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs transition-all flex items-center gap-1.5"
            title="Download official CAP v1.2 XML feed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CAP v1.2 XML</span>
          </a>
        </div>
      </div>

      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-white/90 flex items-center gap-2.5" style={{ letterSpacing: '-0.02em' }}>
            <BellRing className="w-4 h-4 text-cyan-400" />
            Multi-Channel Hazard Warning System
          </h1>
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mt-0.5">
            Real-Time Push · CAP v1.2 Protocol · Multi-Region Subscriber Gateway
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-lg text-slate-400 text-xs">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-white font-bold">{subscriberCount}</span>
            <span className="text-[11px]">Subscribers</span>
          </div>
          <button
            onClick={fetchAlerts}
            className="p-2 rounded border border-white/8 hover:border-white/18 text-white/30 hover:text-white/70 transition-all cursor-pointer"
            title="Refresh alerts"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── ALERTS DASHBOARD ── */}
      <div className="max-w-4xl mx-auto gap-8">

        {/* LEFT COLUMN */}
        <div className="space-y-8">

          {/* SECTION 1 — EMERGENCY DISPATCH & SUBSCRIPTION */}
          <section className="bg-slate-900/40 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/8">
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              <h2 className="text-[11px] font-mono text-white/60 uppercase tracking-widest font-semibold">
                Live Alert Dispatch & Subscriber Broadcast
              </h2>
            </div>

            <form onSubmit={handleSendTestAlert} className="space-y-4">
              {/* Email input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                    Recipient / Monitored Email Address
                  </label>
                  <button
                    type="button"
                    onClick={() => setEmail('sougatakarm29@gmail.com')}
                    className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    Preset: sougatakarm29@gmail.com
                  </button>
                </div>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    required
                    className="w-full rounded-xl px-3 py-2.5 pl-9 font-mono text-xs text-white bg-slate-950/80 border border-white/10 focus:border-cyan-400 focus:outline-none transition-colors placeholder:text-white/20"
                  />
                </div>
              </div>



              {/* Region Subscription Input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider block">
                  Subscribed Hazard Zones (Comma separated)
                </label>
                <input
                  type="text"
                  value={customRegionsStr}
                  onChange={e => setCustomRegionsStr(e.target.value)}
                  placeholder="e.g. gangtok, nathula, mechuka etc"
                  className="w-full rounded-xl px-3 py-2.5 font-mono text-xs text-white bg-slate-950/80 border border-white/10 focus:border-cyan-400 focus:outline-none transition-colors placeholder:text-white/20"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg cursor-pointer"
                >
                  {isSending ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Transmitting Warning...</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> Dispatch Emergency Alert</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="py-2.5 px-5 rounded-xl font-bold text-xs uppercase tracking-wider text-white hover:text-cyan-300 border border-white/10 hover:border-cyan-400/40 bg-white/[0.04] transition-all disabled:opacity-40 cursor-pointer"
                >
                  {isSubscribing ? 'Saving...' : 'Subscribe'}
                </button>
              </div>
            </form>

            {/* Subscribe confirmation */}
            {subscribeStatus && (
              <div className="mt-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-mono text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{subscribeStatus}</span>
              </div>
            )}

            {/* Dispatch receipt */}
            {dispatchReceipt && (
              <div className="mt-4 p-4 rounded-xl border border-red-500/30 bg-red-950/20 space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-red-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    Broadcast Confirmed · {dispatchReceipt.alert?.alert_id}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(dispatchReceipt.alert?.triggered_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {dispatchReceipt.alert?.message}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                  {[
                    { label: 'Recipient', val: dispatchReceipt.alert?.recipient },
                    { label: 'FoS Static/Seismic', val: `${dispatchReceipt.alert?.fos_static} / ${dispatchReceipt.alert?.fos_seismic}` },
                    { label: 'Failure Prob.', val: `${((dispatchReceipt.alert?.pinn_failure_probability || 0) * 100).toFixed(1)}%` },
                  ].map(({ label, val }) => (
                    <div key={label} className="space-y-0.5">
                      <p className="text-[8px] font-mono text-slate-400 uppercase tracking-wider">{label}</p>
                      <p className="text-[11px] font-mono text-cyan-300 truncate font-semibold">{val}</p>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{dispatchReceipt.email_delivery?.detail || 'Delivered to Alert Gateway'}</span>
                  </div>
                  <span className="text-[9px] text-slate-500">SHA256: {dispatchReceipt.digital_hash}</span>
                </div>
              </div>
            )}
          </section>

          {/* SECTION 2 — ACTIVE MONITORED ALERTS */}
          <section>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/8">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-[11px] font-mono text-white/60 uppercase tracking-widest font-semibold">
                Active Critical Corridors <span className="text-white/30">({activeAlerts.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl border border-white/5 bg-white/[0.01] animate-pulse" />)}
              </div>
            ) : activeAlerts.length > 0 ? (
              <div className="space-y-3">
                {activeAlerts.map(alert => (
                  <div
                    key={alert.alert_id}
                    className="p-4 rounded-xl border border-white/10 bg-slate-900/50 hover:border-white/20 transition-colors space-y-3"
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-bold uppercase">
                          {alert.risk_level || 'CRITICAL'}
                        </span>
                        <span className="text-xs font-bold text-white">
                          {alert.region_name || alert.region}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">{alert.message}</p>

                    {/* Stats */}
                    <div className="flex gap-6 pt-1">
                      <div>
                        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-0.5">Rainfall 24h</p>
                        <p className="text-xs font-mono text-cyan-300 font-bold">{alert.rainfall_24h || 120} mm</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-0.5">Failure Mechanism</p>
                        <p className="text-xs font-mono text-amber-300 capitalize">{alert.top_factor?.replace(/_/g, ' ') || 'Pore-water Saturation'}</p>
                      </div>
                    </div>

                    {/* Evacuation Route */}
                    {alert.recommended_route && (
                      <div className="px-3 py-2 rounded-lg border border-red-500/20 bg-red-950/20 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[9px] font-mono text-red-300 uppercase tracking-wider font-semibold">Recommended Evacuation Corridor</p>
                          <p className="text-xs text-slate-200 mt-0.5">{alert.recommended_route}</p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      {alert.recipient ? (
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-cyan-400" />
                          {alert.recipient}
                        </span>
                      ) : <span />}
                      <div className="flex gap-2">
                        <Link
                          to="/route"
                          className="text-[10px] font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow"
                        >
                          Safe Route <ArrowRight className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => triggerPhoneAlert(alert)}
                          className="text-[10px] font-mono text-slate-300 hover:text-white border border-white/10 hover:border-white/20 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          Push to Phone
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center border border-white/5 rounded-2xl bg-slate-900/20">
                <ShieldCheck className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">All monitored corridors currently stable (FoS &gt; 1.25)</p>
              </div>
            )}
          </section>

          {/* SECTION 3 — RECENT INCIDENT LOGS */}
          <section>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/8">
              <h2 className="text-[11px] font-mono text-white/50 uppercase tracking-widest font-semibold">
                Historical Incident Archive (30 Days)
              </h2>
            </div>

            <div className="space-y-1">
              {loading ? (
                Array(3).fill(null).map((_, i) => (
                  <div key={i} className="py-3 border-b border-white/5 space-y-1.5 animate-pulse">
                    <div className="h-2 w-24 rounded bg-white/5" />
                    <div className="h-2 w-48 rounded bg-white/5" />
                  </div>
                ))
              ) : alerts.slice(0, 8).map((alert, i) => (
                <div key={i} className="py-2.5 border-b border-white/5 last:border-0 flex items-start justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[9px] font-mono text-slate-500">
                      {new Date(alert.triggered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-slate-300 leading-snug truncate">
                      <span className="font-semibold text-white">{alert.region_name || alert.region}:</span> {alert.message}
                    </p>
                  </div>
                  <span className="shrink-0 text-[9px] font-mono text-slate-400 border border-white/8 px-1.5 py-0.5 rounded uppercase">
                    {alert.risk_level}
                  </span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Alerts;
