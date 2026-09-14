import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { 
  BellRing, Signal, Battery, Mountain, Send, Mail, ShieldAlert, 
  CheckCircle2, Radio, Smartphone, ArrowRight, RefreshCw, AlertTriangle, Zap, ExternalLink 
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import { Link } from 'react-router-dom';

const REGION_OPTIONS = [
  { id: 'sikkim', label: 'Sikkim (NH-10 Sevoke–Gangtok)', tag: 'NH-10' },
  { id: 'cherrapunji', label: 'Cherrapunji (Sohra Plateau)', tag: 'CHERRA' },
  { id: 'manipur_nh2', label: 'Manipur (NH-2 / NH-37 Corridor)', tag: 'NH-2' },
  { id: 'wayanad', label: 'Wayanad (Western Ghats Escarpment)', tag: 'WAYANAD' },
  { id: 'assam_hills', label: 'Assam Hills (Dima Hasao / Haflong)', tag: 'ASSAM' },
];

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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsHost = window.location.host;
    // In dev, if frontend is 5173/5174 and backend is 8000
    if (window.location.port !== '8000') {
      wsHost = `${window.location.hostname}:8000`;
    }
    const wsUrl = `${protocol}//${wsHost}/ws/alerts`;

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
    <div className="p-5 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in pb-24">

      {/* Left Column — Alert Feeds & Dispatch Controller */}
      <div className="space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-xl font-semibold text-white/90 mb-1" style={{ letterSpacing: '-0.02em' }}>
              <BellRing className="w-5 h-5 text-accent" />
              LITHOS Multi-Channel Alert Engine
            </h1>
            <p className="data-mono text-[10px] text-white/35 uppercase tracking-widest">
              Automated Geotechnical Warning • Email • CAP v1.2 XML • 2G SMS Broadcast
            </p>
          </div>
          <button 
            onClick={fetchAlerts}
            className="p-2 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
            title="Refresh alert feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </header>

        {/* ── LIVE EMERGENCY DISPATCH CONTROLLER ──────────────────────────── */}
        <section className="glass rounded-xl p-6 space-y-5 relative overflow-hidden border border-accent/20 bg-gradient-to-br from-bg/90 via-surface/60 to-accent/5 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-accent/20 text-accent">
                <Zap className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  Emergency Alert Dispatcher
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-mono">LIVE DEMO</span>
                </h2>
                <p className="data-mono text-[10px] text-white/40">
                  Trigger and dispatch geotechnical landslide bulletins instantly to email & cell broadcast
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSendTestAlert} className="space-y-4">
            {/* Target Email with quick preset badge */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="data-mono text-[10px] uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-accent" /> Recipient Emergency Contact:
                </label>
                <button
                  type="button"
                  onClick={() => setEmail('sougatakarm29@gmail.com')}
                  className="data-mono text-[9px] px-2 py-0.5 rounded bg-accent/15 hover:bg-accent/25 text-accent transition-all flex items-center gap-1"
                >
                  Preset: sougatakarm29@gmail.com
                </button>
              </div>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter recipient email (e.g. sougatakarm29@gmail.com)"
                  required
                  className="w-full rounded-lg px-4 py-3 pl-10 data-mono text-xs text-white bg-black/40 border border-white/15 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                />
                <Mail className="w-4 h-4 text-white/30 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Target Corridor Selector */}
            <div className="space-y-1.5">
              <label className="data-mono text-[10px] uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <Mountain className="w-3 h-3 text-accent" /> Monitored Mountain Corridor:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REGION_OPTIONS.map(reg => (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => setSelectedRegion(reg.id)}
                    className={`px-3 py-2.5 rounded-lg text-left text-xs transition-all flex items-center justify-between border ${
                      selectedRegion === reg.id
                        ? 'bg-accent/20 border-accent text-white shadow-[0_0_12px_rgba(43,158,255,0.25)]'
                        : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate pr-2 font-medium">{reg.label}</span>
                    <span className="data-mono text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-accent font-bold">
                      {reg.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isSending}
                className="flex-1 bg-accent hover:bg-accent-hover text-bg font-bold py-3 px-5 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(43,158,255,0.4)] disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-bg" />
                    Transmitting Bulletin...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-bg" />
                    Dispatch Emergency Alert to {email.split('@')[0] || 'Email'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSubscribe}
                disabled={isSubscribing}
                className="py-3 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white data-mono text-xs uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5 text-accent" />
                {isSubscribing ? 'Subscribing...' : 'Subscribe'}
              </button>
            </div>
          </form>

          {/* Subscribe status message */}
          {subscribeStatus && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{subscribeStatus}</span>
            </div>
          )}

          {/* Transmission Receipt Proof */}
          {dispatchReceipt && (
            <div className="rounded-lg p-4 bg-black/60 border border-risk-red/40 space-y-3 animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-risk-red animate-ping" />
                  <span className="data-mono text-[11px] font-bold text-risk-red uppercase tracking-wider">
                    ALERT TRANSMITTED: {dispatchReceipt.alert?.alert_id}
                  </span>
                </div>
                <span className="data-mono text-[9px] text-white/40">
                  {new Date(dispatchReceipt.alert?.triggered_at).toLocaleTimeString()}
                </span>
              </div>

              <div className="p-3 rounded bg-white/5 border border-white/5 space-y-2">
                <p className="text-xs text-white/90 font-medium leading-relaxed">
                  {dispatchReceipt.alert?.message}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded bg-black/40 text-center">
                    <span className="data-mono text-[8px] text-white/40 uppercase block">Recipient</span>
                    <span className="data-mono text-[10px] text-accent font-bold truncate block">
                      {dispatchReceipt.alert?.recipient}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 text-center">
                    <span className="data-mono text-[8px] text-white/40 uppercase block">FoS (Seismic)</span>
                    <span className="data-mono text-[10px] text-amber-400 font-bold block">
                      {dispatchReceipt.alert?.fos_static} / {dispatchReceipt.alert?.fos_seismic}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 text-center">
                    <span className="data-mono text-[8px] text-white/40 uppercase block">PINN Risk</span>
                    <span className="data-mono text-[10px] text-risk-red font-bold block">
                      {(dispatchReceipt.alert?.pinn_failure_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between text-[9px] data-mono text-white/40 gap-2 pt-1 border-t border-white/5">
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {dispatchReceipt.email_delivery?.detail || 'Delivered to gateway'}
                </span>
                <span className="text-white/30">
                  DIGITAL HASH: {dispatchReceipt.digital_hash}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ── ACTIVE CRITICAL ALERTS FEED ─────────────────────────────────── */}
        <section className="space-y-3">
          <div className="heading-accent mb-4">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--risk-red)' }} />
            Active Critical Alerts ({activeAlerts.length})
          </div>

          {loading ? (
            <div className="glass rounded p-5 space-y-3">
              {[80, 60, 90].map(w => <div key={w} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />)}
            </div>
          ) : activeAlerts.length > 0 ? (
            activeAlerts.map(alert => (
              <div
                key={alert.alert_id}
                className="glass rounded-xl overflow-hidden transition-all hover:border-white/20"
                style={{ borderLeft: `4px solid var(--risk-${alert.risk_level?.toLowerCase() === 'red' ? 'red' : 'orange'})` }}
              >
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <RiskBadge level={alert.risk_level} />
                      <span className="data-mono text-[10px] font-bold text-white/70">
                        {alert.region_name || alert.region}
                      </span>
                    </div>
                    <span className="data-mono text-[9px] text-white/40 uppercase">
                      {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-white/90 leading-snug">
                    {alert.message}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[
                      { label: 'RAIN 24H', val: `${alert.rainfall_24h || 120}mm`, color: 'var(--accent)' },
                      { label: 'DRIVER', val: alert.top_factor?.replace('_', ' ') || 'Rainfall Saturation', color: 'rgba(255,255,255,0.7)' },
                    ].map(item => (
                      <div key={item.label} className="rounded-lg p-2.5 bg-white/[0.02] border border-white/[0.05]">
                        <p className="label-micro mb-1">{item.label}</p>
                        <p className="data-mono text-xs font-bold" style={{ color: item.color }}>{item.val}</p>
                      </div>
                    ))}
                  </div>

                  {alert.recommended_route && (
                    <div className="mt-2 px-3.5 py-2.5 rounded-lg text-xs bg-risk-red/10 border border-risk-red/20 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-risk-red shrink-0 mt-0.5" />
                      <div>
                        <span className="label-micro text-risk-red block font-bold mb-0.5">RECOMMENDED EVACUATION CORRIDOR</span>
                        <span className="text-white/70">{alert.recommended_route}</span>
                      </div>
                    </div>
                  )}

                  {alert.recipient && (
                    <div className="data-mono text-[9px] text-white/35 flex items-center gap-1.5 pt-1">
                      <Mail className="w-3 h-3 text-accent" />
                      Dispatched to contact: <span className="text-accent font-medium">{alert.recipient}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Link
                      to="/safe-route"
                      className="flex-1 data-mono text-[10px] font-bold py-2 rounded-lg uppercase tracking-wider text-center bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 transition-all flex items-center justify-center gap-1"
                    >
                      Navigate Safe Route in 3D <ArrowRight className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => triggerPhoneAlert(alert)}
                      className="px-4 data-mono text-[10px] font-medium py-2 rounded-lg uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 transition-all"
                    >
                      Show on Phone
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="glass rounded p-6 text-center">
              <p className="data-mono text-xs text-white/25">No active critical alerts in monitored regions.</p>
            </div>
          )}
        </section>

        {/* ── ALERT HISTORY (30 DAYS) ─────────────────────────────────────── */}
        <section className="space-y-1">
          <div className="heading-accent mb-4">Historical Audit Trail (30 days)</div>
          <div className="space-y-0 relative pl-4 border-l border-white/10">
            {loading ? (
              Array(4).fill(null).map((_, i) => (
                <div key={i} className="py-3 space-y-1.5">
                  <div className="skeleton h-2.5 w-28 rounded" />
                  <div className="skeleton h-2 w-48 rounded" />
                </div>
              ))
            ) : alerts.slice(0, 8).map((alert, i) => (
              <div key={i} className="relative py-3">
                <div
                  className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2"
                  style={{ 
                    background: alert.risk_level === 'RED' ? 'var(--risk-red)' : 'var(--risk-orange)', 
                    borderColor: 'var(--bg)' 
                  }}
                />
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="data-mono text-[9px] text-white/40">
                    {new Date(alert.triggered_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <RiskBadge level={alert.risk_level} />
                </div>
                <p className="text-xs text-white/60 font-medium leading-snug">
                  {alert.region_name || alert.region}: {alert.message}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right Column — Interactive Smartphone Mockup */}
      <div className="hidden lg:flex flex-col items-center justify-start gap-6 sticky top-6 self-start pt-6">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-white/80">Offline 2G SMS & App Receiver</h3>
        </div>

        {/* Phone Body */}
        <div
          className={`relative w-[300px] h-[600px] flex flex-col overflow-hidden rounded-[3rem] transition-all duration-300 shadow-2xl ${
            phoneVibrating ? 'ring-4 ring-risk-red scale-[1.02] shadow-[0_0_30px_rgba(230,57,70,0.5)]' : 'ring-1 ring-white/15'
          }`}
          style={{ background: '#070b14', border: '6px solid rgba(255,255,255,0.12)' }}
        >
          {/* Top Speaker & Notch */}
          <div className="w-24 h-5 self-center rounded-b-2xl mb-4 bg-white/10 flex items-center justify-center">
            <div className="w-8 h-1 rounded-full bg-white/20" />
          </div>

          {/* Screen Content */}
          <div className="flex-grow px-4 space-y-3 relative overflow-y-auto">
            {/* Status Bar */}
            <div className="flex justify-between items-center opacity-40 px-1">
              <span className="data-mono text-[10px]">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="flex gap-1.5 items-center">
                <Signal className="w-3 h-3 text-white" />
                <span className="data-mono text-[8px]">2G/SMS</span>
                <Battery className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* If there's an incoming test alert, show Priority Emergency Notification */}
            {phoneIncomingAlert ? (
              <div className="rounded-2xl p-4 bg-gradient-to-b from-risk-red/25 to-bg border-2 border-risk-red/60 animate-fade-in shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-risk-red/30">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-risk-red flex items-center justify-center">
                      <ShieldAlert className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <p className="data-mono text-[9px] font-black text-risk-red uppercase tracking-widest">
                        CRITICAL P1 ALERT
                      </p>
                      <p className="data-mono text-[7px] text-white/50">Cell Broadcast & Email Gateway</p>
                    </div>
                  </div>
                  <span className="data-mono text-[8px] px-1.5 py-0.5 rounded bg-risk-red text-white font-bold">
                    ACTIVE
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="data-mono text-[8px] text-accent font-bold truncate">
                    TO: {phoneIncomingAlert.recipient || email}
                  </div>
                  <h4 className="text-xs font-black text-white uppercase leading-tight">
                    {phoneIncomingAlert.region_name || 'Himalayan Corridor'} Hazard Warning
                  </h4>
                  <p className="text-[11px] text-white/80 leading-relaxed font-normal">
                    {phoneIncomingAlert.message}
                  </p>
                </div>

                {phoneIncomingAlert.recommended_route && (
                  <div className="p-2 rounded bg-black/50 border border-white/10 text-[10px] space-y-0.5">
                    <span className="data-mono text-[8px] text-emerald-400 font-bold uppercase block">
                      SAFE ROUTE ADVISORY:
                    </span>
                    <span className="text-white/70 block leading-snug">
                      {phoneIncomingAlert.recommended_route}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to="/safe-route"
                    className="p-2 rounded-lg bg-accent text-bg font-bold data-mono text-[9px] text-center uppercase tracking-wider block hover:opacity-90"
                  >
                    3D Safe Route
                  </Link>
                  <button
                    onClick={() => setPhoneIncomingAlert(null)}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:text-white data-mono text-[9px] uppercase tracking-wider"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              /* Normal SMS Broadcast Cycling */
              <div key={smsStep} className="glass rounded-2xl p-4 animate-fade-in border border-white/10 space-y-3">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                    <Mountain className="w-3.5 h-3.5 text-bg" />
                  </div>
                  <div>
                    <p className="data-mono text-[9px] font-bold text-accent uppercase tracking-widest">
                      LITHOS SMS ENGINE
                    </p>
                    <p className="data-mono text-[7px] text-white/30">Low-Bandwidth Cell Broadcast</p>
                  </div>
                </div>

                <h5 className="text-xs font-bold text-white uppercase pb-1">
                  {smsMessages[smsStep].title}
                </h5>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  {smsMessages[smsStep].body}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    ['SOURCE', smsMessages[smsStep].source],
                    ['VERIFIED', smsMessages[smsStep].verified],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="p-1.5 rounded bg-black/40 border border-white/5">
                      <p className="data-mono text-[7px] text-white/30 uppercase">{lbl}</p>
                      <p className="data-mono text-[9px] font-bold text-white/70">{val}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-center">
                  <span className="data-mono text-[8px] text-accent tracking-widest">
                    lithos-system.gov.in/sms-relay
                  </span>
                </div>
              </div>
            )}

            {/* Quick action buttons on phone */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => handleSendTestAlert()}
                className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white data-mono text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
              >
                <Zap className="w-3 h-3 text-accent" />
                Simulate Direct Incoming SMS
              </button>
            </div>
          </div>

          {/* Home Indicator */}
          <div className="w-28 h-1 self-center my-3 rounded-full bg-white/20" />
        </div>

        <div className="text-center space-y-1 max-w-[280px]">
          <h4 className="text-xs font-semibold text-white/70 tracking-wide">
            Zero-Signal & Low-Bandwidth Resilience
          </h4>
          <p className="data-mono text-[9px] text-white/30 leading-relaxed">
            Delivers life-saving landslide warnings via Common Alerting Protocol (CAP) and 2G SMS even when cell internet is disrupted.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Alerts;
