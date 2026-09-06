import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { BellRing, Signal, Battery, Mountain } from 'lucide-react';
import RiskBadge from '../components/RiskBadge';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [smsStep, setSmsStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => setSmsStep(s => (s + 1) % 3), 6000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const [r, a] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/alerts`),
        axios.get(`${API_BASE_URL}/api/alerts/active`),
      ]);
      setAlerts(r.data.alerts);
      setActiveAlerts(a.data.active_alerts);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const smsMessages = [
    { title: 'NH6 MANIPUR — CRITICAL',  body: 'Active landslide risk near Mao Gate. Avoid travel. Safe route via NH102 (+18 min).', source: '3 users',  verified: 'LITHOS AI' },
    { title: 'WAYANAD ALERT',           body: 'Extreme rainfall (42mm/hr). High risk in Meppadi area. Emergency shelters active.',    source: 'GPM Data', verified: 'LITHOS Model' },
    { title: 'SIKKIM HIGHWAY',          body: 'Road blocked at Melli. Debris clearance in progress. Estimated delay: 4 hours.',         source: '12 users', verified: 'Verified' },
  ];

  return (
    <div className="p-5 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in pb-24">

      {/* Left Column */}
      <div className="space-y-8">
        <header>
          <h1 className="flex items-center gap-2.5 text-xl font-semibold text-white/90 mb-1" style={{ letterSpacing: '-0.02em' }}>
            <BellRing className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            LITHOS Alerts
          </h1>
          <p className="data-mono text-[10px] text-white/25 uppercase tracking-widest">Multi-channel early warning system</p>
        </header>

        {/* Active Critical Alerts */}
        <section className="space-y-3">
          <div className="heading-accent mb-4">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--risk-red)' }} />
            Active Critical Alerts
          </div>

          {loading ? (
            <div className="glass rounded p-5 space-y-3">
              {[80,60,90].map(w => <div key={w} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />)}
            </div>
          ) : activeAlerts.length > 0 ? activeAlerts.map(alert => (
            <div
              key={alert.alert_id}
              className="glass rounded overflow-hidden"
              style={{ borderLeft: `3px solid var(--risk-${alert.risk_level?.toLowerCase() === 'red' ? 'red' : 'orange'})` }}
            >
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <RiskBadge level={alert.risk_level} />
                  <span className="data-mono text-[9px] text-white/25 uppercase">
                    {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white/85 leading-snug" style={{ letterSpacing: '-0.01em' }}>
                  {alert.message}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    { label: 'RAIN 24H', val: `${alert.rainfall_24h}mm`, color: 'var(--accent)' },
                    { label: 'DRIVER',   val: alert.top_factor?.replace('_', ' '), color: 'rgba(255,255,255,0.6)' },
                  ].map(item => (
                    <div key={item.label} className="rounded p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <p className="label-micro mb-1">{item.label}</p>
                      <p className="data-mono text-xs font-bold" style={{ color: item.color }}>{item.val}</p>
                    </div>
                  ))}
                </div>
                {alert.recommended_route && (
                  <div className="mt-2 px-3 py-2 rounded text-xs" style={{ background: 'rgba(230,57,70,0.04)', border: '1px solid rgba(230,57,70,0.1)' }}>
                    <span className="label-micro mr-2" style={{ color: 'var(--risk-red)' }}>RECOMMENDED:</span>
                    <span className="text-white/40">{alert.recommended_route}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {['View Map', 'Dismiss'].map(label => (
                    <button
                      key={label}
                      className="flex-1 data-mono text-[10px] font-medium py-2 rounded uppercase tracking-wider transition-all duration-100"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                    >{label}</button>
                  ))}
                </div>
              </div>
            </div>
          )) : (
            <div className="glass rounded p-6 text-center">
              <p className="data-mono text-xs text-white/20">No active critical alerts in monitored regions.</p>
            </div>
          )}
        </section>

        {/* Alert History Timeline */}
        <section className="space-y-1">
          <div className="heading-accent mb-5">Alert History (30 days)</div>
          <div className="space-y-0 relative pl-4" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            {loading
              ? Array(5).fill(null).map((_, i) => (
                  <div key={i} className="py-3 space-y-1.5">
                    <div className="skeleton h-2.5 w-28 rounded" /><div className="skeleton h-2 w-48 rounded" />
                  </div>
                ))
              : alerts.slice(0, 8).map((alert, i) => (
                  <div key={i} className="relative py-3">
                    <div
                      className="absolute -left-[21px] top-4 w-2 h-2 rounded-full border-2"
                      style={{ background: alert.risk_level === 'RED' ? 'var(--risk-red)' : 'var(--risk-orange)', borderColor: 'var(--bg)' }}
                    />
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="data-mono text-[9px] text-white/30">
                        {new Date(alert.triggered_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <RiskBadge level={alert.risk_level} />
                    </div>
                    <p className="text-xs text-white/50 font-medium leading-snug">{alert.region_name}: {alert.message}</p>
                  </div>
                ))
            }
          </div>
        </section>

        {/* Subscribe */}
        <section
          className="glass rounded p-6 space-y-4"
          style={{ borderTop: '1px solid rgba(43,158,255,0.12)' }}
        >
          <div>
            <h2 className="text-sm font-semibold text-white/80 mb-1" style={{ letterSpacing: '-0.01em' }}>Get Notified</h2>
            <p className="data-mono text-[10px] text-white/30 leading-relaxed">
              Zero-spam landslide alerts for your travel regions via SMS and Email.
            </p>
          </div>
          <input
            type="email"
            placeholder="Enter email address"
            className="w-full rounded px-4 py-3 data-mono text-xs text-white/70 placeholder-white/20 outline-none transition-all duration-150"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent), 0 0 8px rgba(43,158,255,0.15)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = ''; }}
          />
          <div className="grid grid-cols-2 gap-2">
            {['CHERRA', 'WAYANAD', 'SIKKIM', 'MANIPUR'].map(r => (
              <label key={r} className="flex items-center gap-3 rounded px-3 py-2 cursor-pointer transition-all duration-100"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              >
                <input type="checkbox" style={{ accentColor: 'var(--accent)' }} />
                <span className="data-mono text-[10px] text-white/40 uppercase">{r}</span>
              </label>
            ))}
          </div>
          <button className="btn-primary w-full">Subscribe to Alerts</button>
        </section>
      </div>

      {/* Right Column — Phone Mockup */}
      <div className="hidden lg:flex flex-col items-center justify-center gap-8 sticky top-6 self-start pt-12">
        <div
          className="relative w-[280px] h-[560px] flex flex-col overflow-hidden rounded-[2.5rem]"
          style={{ background: 'var(--nav)', border: '6px solid rgba(255,255,255,0.08)' }}
        >
          {/* Notch */}
          <div className="w-20 h-5 self-center rounded-b-2xl mb-6" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="w-8 h-0.5 mx-auto mt-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Screen content */}
          <div className="flex-grow px-4 space-y-4 relative">
            {/* Status bar */}
            <div className="flex justify-between items-center opacity-30 mb-4">
              <span className="data-mono text-[10px]">10:44</span>
              <div className="flex gap-1.5 items-center">
                <Signal className="w-3 h-3" /><Battery className="w-3 h-3" />
              </div>
            </div>

            {/* Notification card — animated cycling */}
            <div key={smsStep} className="glass-elevated rounded-xl p-4 animate-fade-in">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                  <Mountain className="w-3.5 h-3.5" style={{ color: 'var(--bg)' }} />
                </div>
                <div>
                  <p className="data-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>LITHOS ALERT</p>
                  <p className="data-mono text-[8px] text-white/25">SMS Backup System</p>
                </div>
              </div>
              <h5 className="text-xs font-semibold text-white/90 uppercase mb-2 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', letterSpacing: '-0.01em' }}>
                {smsMessages[smsStep].title}
              </h5>
              <p className="text-[11px] text-white/60 leading-relaxed mb-3">{smsMessages[smsStep].body}</p>
              <div className="grid grid-cols-2 gap-2">
                {[['SOURCE', smsMessages[smsStep].source], ['VERIFIED', smsMessages[smsStep].verified]].map(([label, val]) => (
                  <div key={label} className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <p className="data-mono text-[7px] text-white/25 uppercase mb-0.5">{label}</p>
                    <p className="data-mono text-[9px] font-bold text-white/60">{val}</p>
                  </div>
                ))}
              </div>
              <p className="data-mono text-[8px] mt-3" style={{ color: 'var(--accent)' }}>lith0s.me/route</p>
            </div>
          </div>

          {/* Home indicator */}
          <div className="w-24 h-0.5 self-center my-4 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <div className="text-center space-y-1">
          <h4 className="text-sm font-semibold text-white/60" style={{ letterSpacing: '-0.01em' }}>Hill Area SMS Backup</h4>
          <p className="data-mono text-[10px] text-white/25 max-w-[240px] mx-auto leading-relaxed">
            Works without data signal. Critical alerts delivered even on 2G networks.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Alerts;
