import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import {
  BellRing, Signal, Battery, Mountain, Send, Mail, ShieldAlert,
  CheckCircle2, Radio, Smartphone, ArrowRight, RefreshCw, AlertTriangle, Zap, ExternalLink
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import { Link } from 'react-router-dom';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Email & Dispatch State
  const [email, setEmail] = useState('sougatakarm29@gmail.com');
  const [selectedRegion, setSelectedRegion] = useState('sikkim');
  const [subscribedRegions, setSubscribedRegions] = useState(['CHERRA', 'WAYANAD', 'SIKKIM', 'MANIPUR']);
  const [isSending, setIsSending] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [dispatchReceipt, setDispatchReceipt] = useState(null);
  const [subscribeStatus, setSubscribeStatus] = useState(null);

  // Phone Mockup State
  const [smsStep, setSmsStep] = useState(0);
  const [phoneIncomingAlert, setPhoneIncomingAlert] = useState(null);
  const [phoneVibrating, setPhoneVibrating] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    fetchAlerts();

    // Cycling background SMS messages
    const interval = setInterval(() => {
      if (!phoneIncomingAlert) {
        setSmsStep(s => (s + 1) % 3);
      }
    }, 6000);

    // WebSocket live stream
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws/alerts`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'emergency_test_alert' || data.type === 'risk_alert') {
            const incoming = {
              alert_id: data.alert_id || `ALT-${Date.now()}`,
              region: data.region,
              region_name: data.region_name || data.region,
              risk_level: data.risk_level || 'RED',
              message: data.message,
              triggered_at: data.timestamp || new Date().toISOString(),
              rainfall_24h: data.rainfall_24h || 120.0,
              top_factor: 'pore_pressure_saturation',
              recommended_route: data.recommended_route || 'Divert to alternate bypass corridor',
              is_active: true,
              recipient: data.recipient || 'Community Broadcast',
            };
            setActiveAlerts(prev => [incoming, ...prev.filter(a => a.alert_id !== incoming.alert_id)]);
            setAlerts(prev => [incoming, ...prev.filter(a => a.alert_id !== incoming.alert_id)]);
            triggerPhoneAlert(incoming);
          }
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };
    } catch (wsErr) {
      console.warn('WS connect error:', wsErr);
    }

    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const fetchAlerts = async () => {
    try {
      const [r, a] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/alerts`),
        axios.get(`${API_BASE_URL}/api/alerts/active`),
      ]);
      setAlerts(r.data.alerts || []);
      setActiveAlerts(a.data.active_alerts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
      const res = await axios.post(`${API_BASE_URL}/api/alerts/send-test`, {
        email: email.trim(),
        region: selectedRegion,
        hazard_level: 'RED'
      });

      if (res.data.success) {
        setDispatchReceipt(res.data);
        const newAlert = res.data.alert;
        setActiveAlerts(prev => [newAlert, ...prev.filter(a => a.alert_id !== newAlert.alert_id)]);
        setAlerts(prev => [newAlert, ...prev.filter(a => a.alert_id !== newAlert.alert_id)]);
        triggerPhoneAlert(newAlert);
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
        regions: subscribedRegions,
      });
      setSubscribeStatus(res.data.message || `Subscribed ${email}`);
      setTimeout(() => setSubscribeStatus(null), 6000);
    } catch (err) {
      console.error('Subscription error:', err);
      alert('Subscription failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubscribing(false);
    }
  };

  const toggleRegion = (reg) => {
    setSubscribedRegions(prev =>
      prev.includes(reg) ? prev.filter(r => r !== reg) : [...prev, reg]
    );
  };

  const smsMessages = [
    { title: 'NH6 MANIPUR — CRITICAL', body: 'Active landslide risk near Mao Gate. Avoid travel. Safe route via NH102 (+18 min).', source: '3 users', verified: 'LITHOS AI' },
    { title: 'WAYANAD ALERT', body: 'Extreme rainfall (42mm/hr). High risk in Meppadi area. Emergency shelters active.', source: 'GPM Data', verified: 'LITHOS Model' },
    { title: 'SIKKIM HIGHWAY', body: 'Road blocked at Melli. Debris clearance in progress. Estimated delay: 4 hours.', source: '12 users', verified: 'Verified' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in pb-24">

      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-white/90 flex items-center gap-2.5" style={{ letterSpacing: '-0.02em' }}>
            <BellRing className="w-4 h-4 text-white/40" />
            Alert System
          </h1>
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mt-0.5">
            Email · CAP v1.2 · 2G SMS Broadcast
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="p-2 rounded border border-white/8 hover:border-white/18 text-white/30 hover:text-white/70 transition-all"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── TWO-COLUMN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">

        {/* LEFT COLUMN */}
        <div className="space-y-8">

          {/* SECTION 1 — DISPATCH */}
          <section>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/8">
              <Send className="w-3.5 h-3.5 text-white/30" />
              <h2 className="text-[11px] font-mono text-white/50 uppercase tracking-widest">Emergency Dispatch</h2>
            </div>

            <form onSubmit={handleSendTestAlert} className="space-y-4">
              {/* Email input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-white/35 uppercase tracking-wider">
                    Recipient
                  </label>
                  <button
                    type="button"
                    onClick={() => setEmail('sougatakarm29@gmail.com')}
                    className="text-[9px] font-mono text-white/30 hover:text-white/60 transition-colors"
                  >
                    Use preset
                  </button>
                </div>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-white/20 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    required
                    className="w-full rounded-lg px-3 py-2.5 pl-9 font-mono text-[11px] text-white/80 bg-white/[0.03] border border-white/10 focus:border-white/25 focus:outline-none transition-colors placeholder:text-white/20"
                  />
                </div>
              </div>

              {/* Region selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-white/35 uppercase tracking-wider block">
                  Region
                </label>
                <select
                  value={selectedRegion}
                  onChange={e => setSelectedRegion(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 font-mono text-[11px] text-white/80 bg-white/[0.03] border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
                >
                  {['sikkim', 'cherrapunji', 'wayanad', 'manipur', 'arunachal', 'uttarakhand', 'himachal'].map(r => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-wider text-white/80 hover:text-white border border-white/15 hover:border-white/30 bg-white/[0.04] hover:bg-white/[0.07] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {isSending ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> Dispatch Alert</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="py-2.5 px-4 rounded-lg font-mono text-[10px] uppercase tracking-wider text-white/40 hover:text-white/70 border border-white/8 hover:border-white/18 transition-all disabled:opacity-40"
                >
                  {isSubscribing ? 'Subscribing…' : 'Subscribe'}
                </button>
              </div>
            </form>

            {/* Subscribe confirmation */}
            {subscribeStatus && (
              <div className="mt-3 p-3 rounded-lg border border-white/10 text-[10px] font-mono text-white/50 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                {subscribeStatus}
              </div>
            )}

            {/* Dispatch receipt */}
            {dispatchReceipt && (
              <div className="mt-4 p-4 rounded-lg border border-white/10 bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
                    Transmitted · {dispatchReceipt.alert?.alert_id}
                  </span>
                  <span className="text-[9px] font-mono text-white/30">
                    {new Date(dispatchReceipt.alert?.triggered_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-[11px] text-white/65 leading-relaxed">{dispatchReceipt.alert?.message}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Recipient', val: dispatchReceipt.alert?.recipient },
                    { label: 'FoS', val: `${dispatchReceipt.alert?.fos_static} / ${dispatchReceipt.alert?.fos_seismic}` },
                    { label: 'Risk', val: `${((dispatchReceipt.alert?.pinn_failure_probability || 0) * 100).toFixed(1)}%` },
                  ].map(({ label, val }) => (
                    <div key={label} className="space-y-0.5">
                      <p className="text-[8px] font-mono text-white/25 uppercase tracking-wider">{label}</p>
                      <p className="text-[10px] font-mono text-white/65 truncate">{val}</p>
                    </div>
                  ))}
                </div>
                <div className="text-[8px] font-mono text-white/25 pt-1 border-t border-white/5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-white/20" />
                  {dispatchReceipt.email_delivery?.detail || 'Delivered to gateway'}
                </div>
              </div>
            )}
          </section>

          {/* SECTION 2 — ACTIVE ALERTS */}
          <section>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/8">
              <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse-dot" />
              <h2 className="text-[11px] font-mono text-white/50 uppercase tracking-widest">
                Active Alerts <span className="text-white/25">({activeAlerts.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg border border-white/5 bg-white/[0.01] animate-pulse" />)}
              </div>
            ) : activeAlerts.length > 0 ? (
              <div className="space-y-3">
                {activeAlerts.map(alert => (
                  <div
                    key={alert.alert_id}
                    className="p-4 rounded-lg border border-white/8 bg-white/[0.015] hover:border-white/14 transition-colors space-y-3"
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-white/30 border border-white/10 px-1.5 py-0.5 rounded uppercase">
                          {alert.risk_level || 'HIGH'}
                        </span>
                        <span className="text-[11px] font-mono text-white/60">
                          {alert.region_name || alert.region}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-white/25">
                        {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-[12px] text-white/75 leading-relaxed">{alert.message}</p>

                    {/* Stats */}
                    <div className="flex gap-6">
                      <div>
                        <p className="text-[8px] font-mono text-white/25 uppercase tracking-wider mb-0.5">Rain 24h</p>
                        <p className="text-[11px] font-mono text-white/60">{alert.rainfall_24h || 120}mm</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-mono text-white/25 uppercase tracking-wider mb-0.5">Driver</p>
                        <p className="text-[11px] font-mono text-white/60 capitalize">{alert.top_factor?.replace(/_/g, ' ') || 'Rainfall Saturation'}</p>
                      </div>
                    </div>

                    {/* Evacuation */}
                    {alert.recommended_route && (
                      <div className="px-3 py-2 rounded border border-white/8 bg-white/[0.02]">
                        <p className="text-[8px] font-mono text-white/25 uppercase tracking-wider mb-1">Evacuation Corridor</p>
                        <p className="text-[11px] text-white/60">{alert.recommended_route}</p>
                      </div>
                    )}

                    {/* Recipient + Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      {alert.recipient ? (
                        <span className="text-[9px] font-mono text-white/25 flex items-center gap-1.5">
                          <Mail className="w-3 h-3" />
                          {alert.recipient}
                        </span>
                      ) : <span />}
                      <div className="flex gap-2">
                        <Link
                          to="/safe-route"
                          className="text-[9px] font-mono text-white/40 hover:text-white/70 border border-white/8 hover:border-white/18 px-2.5 py-1 rounded transition-all flex items-center gap-1"
                        >
                          Safe Route <ArrowRight className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => triggerPhoneAlert(alert)}
                          className="text-[9px] font-mono text-white/30 hover:text-white/60 border border-white/6 hover:border-white/15 px-2.5 py-1 rounded transition-all"
                        >
                          Phone
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center border border-white/5 rounded-lg">
                <p className="text-[10px] font-mono text-white/20">No active alerts in monitored regions</p>
              </div>
            )}
          </section>

          {/* SECTION 3 — HISTORY */}
          <section>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/8">
              <h2 className="text-[11px] font-mono text-white/50 uppercase tracking-widest">History (30 days)</h2>
            </div>

            <div className="space-y-0">
              {loading ? (
                Array(4).fill(null).map((_, i) => (
                  <div key={i} className="py-3 border-b border-white/5 space-y-1.5 animate-pulse">
                    <div className="h-2 w-24 rounded bg-white/5" />
                    <div className="h-2 w-48 rounded bg-white/5" />
                  </div>
                ))
              ) : alerts.slice(0, 8).map((alert, i) => (
                <div key={i} className="py-3 border-b border-white/5 last:border-0 flex items-start justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[9px] font-mono text-white/25">
                      {new Date(alert.triggered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[11px] text-white/55 leading-snug truncate">
                      {alert.region_name || alert.region}: {alert.message?.slice(0, 90)}{alert.message?.length > 90 ? '…' : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[8px] font-mono text-white/20 border border-white/8 px-1.5 py-0.5 rounded uppercase">
                    {alert.risk_level}
                  </span>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN — Phone Mockup */}
        <div className="hidden lg:flex flex-col items-center gap-5 sticky top-6 self-start pt-1">
          <div className="text-center">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">2G SMS Receiver</p>
          </div>

          {/* Phone */}
          <div
            className={`relative w-[240px] h-[480px] flex flex-col overflow-hidden rounded-[2.5rem] transition-all duration-300 ${phoneVibrating ? 'ring-2 ring-white/30 scale-[1.015]' : 'ring-1 ring-white/10'
              }`}
            style={{ background: '#070b14', border: '5px solid rgba(255,255,255,0.08)' }}
          >
            {/* Notch */}
            <div className="w-16 h-4 self-center rounded-b-xl mb-3 bg-white/8 flex items-center justify-center">
              <div className="w-6 h-1 rounded-full bg-white/15" />
            </div>

            {/* Screen */}
            <div className="flex-grow px-3 space-y-3 overflow-y-auto">
              {/* Status bar */}
              <div className="flex justify-between items-center text-[9px] font-mono text-white/25 px-1">
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <div className="flex gap-1.5 items-center">
                  <Signal className="w-2.5 h-2.5" />
                  <span>2G</span>
                  <Battery className="w-3 h-3" />
                </div>
              </div>

              {/* Alert or cycling SMS */}
              {phoneIncomingAlert ? (
                <div className="rounded-xl p-3 border border-white/15 bg-white/[0.04] space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-mono text-white/35 uppercase tracking-widest">LITHOS Alert</span>
                    <span className="text-[8px] font-mono text-white/20 border border-white/8 px-1.5 py-0.5 rounded">ACTIVE</span>
                  </div>
                  <p className="text-[9px] font-mono text-white/30 truncate">TO: {phoneIncomingAlert.recipient || email}</p>
                  <p className="text-[10px] font-semibold text-white/80 leading-tight">
                    {phoneIncomingAlert.region_name || 'Region'} Hazard Warning
                  </p>
                  <p className="text-[9px] text-white/55 leading-relaxed">{phoneIncomingAlert.message}</p>
                  {phoneIncomingAlert.recommended_route && (
                    <div className="p-2 rounded border border-white/8 bg-white/[0.02]">
                      <p className="text-[8px] font-mono text-white/25 uppercase mb-0.5">Safe Route</p>
                      <p className="text-[9px] text-white/55">{phoneIncomingAlert.recommended_route}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <Link
                      to="/safe-route"
                      className="py-1.5 rounded-lg border border-white/12 text-[8px] font-mono text-white/50 hover:text-white text-center uppercase tracking-wider transition-all"
                    >
                      Safe Route
                    </Link>
                    <button
                      onClick={() => setPhoneIncomingAlert(null)}
                      className="py-1.5 rounded-lg border border-white/8 text-[8px] font-mono text-white/30 hover:text-white/60 uppercase tracking-wider transition-all"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : (
                <div key={smsStep} className="rounded-xl p-3 border border-white/10 bg-white/[0.02] space-y-2 animate-fade-in">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-white/6">
                    <Mountain className="w-3 h-3 text-white/25" />
                    <p className="text-[8px] font-mono text-white/30 uppercase tracking-widest">LITHOS SMS</p>
                  </div>
                  <p className="text-[10px] font-semibold text-white/75 uppercase">{smsMessages[smsStep].title}</p>
                  <p className="text-[9px] text-white/50 leading-relaxed">{smsMessages[smsStep].body}</p>
                  <div className="flex gap-2 pt-1">
                    {[['Source', smsMessages[smsStep].source], ['Verified', smsMessages[smsStep].verified]].map(([l, v]) => (
                      <div key={l}>
                        <p className="text-[7px] font-mono text-white/20 uppercase">{l}</p>
                        <p className="text-[9px] font-mono text-white/50">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Simulate button */}
              <button
                onClick={() => handleSendTestAlert()}
                className="w-full py-1.5 px-3 rounded-lg border border-white/8 hover:border-white/18 text-white/30 hover:text-white/60 font-mono text-[8px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
              >
                <Zap className="w-2.5 h-2.5" /> Simulate SMS
              </button>
            </div>

            {/* Home bar */}
            <div className="w-20 h-0.5 self-center my-3 rounded-full bg-white/15" />
          </div>

          <div className="text-center max-w-[220px] space-y-1">
            <p className="text-[9px] font-mono text-white/20 leading-relaxed">
              Delivers warnings via CAP protocol and 2G SMS even when internet is unavailable.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Alerts;
