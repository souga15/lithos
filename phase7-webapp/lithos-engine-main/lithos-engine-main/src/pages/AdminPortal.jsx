/**
 * AdminPortal.jsx
 * NDRF / BRO officer command dashboard.
 * Shows live user counts, SOS incidents, active blockages, and mass evacuation trigger.
 * Password-protected (simple PIN for demo).
 */
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { Shield, AlertTriangle, Users, MapPin, Radio, LogOut, Zap } from 'lucide-react';

const ADMIN_PIN = '1157'; // change this before deployment

const AdminPortal = () => {
  const [authed,      setAuthed]      = useState(false);
  const [pin,         setPin]         = useState('');
  const [pinError,    setPinError]    = useState(false);
  const [stats,       setStats]       = useState(null);
  const [sosList,     setSosList]     = useState([]);
  const [blockages,   setBlockages]   = useState([]);
  const [userCounts,  setUserCounts]  = useState(null);
  const [evacuSent,   setEvacuSent]   = useState(false);
  const [liveAlert,   setLiveAlert]   = useState(null);
  const wsRef = useRef(null);

  const handleLogin = () => {
    if (pin === ADMIN_PIN) {
      setAuthed(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  useEffect(() => {
    if (!authed) return;
    const load = async () => {
      try {
        const [s, sos, blk, uc] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/stats`),
          axios.get(`${API_BASE_URL}/api/admin/sos-log`),
          axios.get(`${API_BASE_URL}/api/blockages`),
          axios.get(`${API_BASE_URL}/api/admin/user-counts`),
        ]);
        setStats(s.data);
        setSosList(sos.data.events ?? []);
        setBlockages(blk.data.features ?? []);
        setUserCounts(uc.data);
      } catch (e) { console.error('Admin load failed', e); }
    };
    load();
    const id = setInterval(load, 10000);

    // Live WebSocket for SOS pings
    try {
      const wsBase = API_BASE_URL.replace('http', 'ws');
      wsRef.current = new WebSocket(`${wsBase}/ws/alerts`);
      wsRef.current.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.type === 'sos_alert') {
          setLiveAlert(d);
          setTimeout(() => setLiveAlert(null), 15000);
        }
      };
    } catch (_) {}

    return () => {
      clearInterval(id);
      wsRef.current?.close();
    };
  }, [authed]);

  const triggerEvacuation = async () => {
    if (!window.confirm('Broadcast MASS EVACUATION to all users?')) return;
    try {
      await axios.post(`${API_BASE_URL}/api/admin/evacuation`, {
        message: 'CRITICAL: Mass evacuation order issued by district authority. Move to nearest assembly point immediately.',
      });
      setEvacuSent(true);
      setTimeout(() => setEvacuSent(false), 30000);
    } catch (e) { console.error('Evacuation broadcast failed', e); }
  };

  // ── Login Screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a1628 0%, #050d1e 100%)' }}>
        <div className="glass p-10 rounded-3xl border border-white/10 w-80 text-center">
          <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-xl font-black tracking-widest uppercase mb-1">Admin Portal</h1>
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-8">
            NDRF / BRO Officer Access
          </p>
          <input
            type="password"
            value={pin}
            onChange={e => { setPin(e.target.value); setPinError(false); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter PIN"
            maxLength={6}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-center text-lg font-black tracking-[0.4em] outline-none focus:border-accent mb-3"
          />
          {pinError && (
            <p className="text-risk-red text-[10px] font-bold mb-3">❌ Incorrect PIN</p>
          )}
          <button
            onClick={handleLogin}
            className="w-full py-3 rounded-xl bg-accent text-bg font-black text-sm uppercase tracking-wider hover:scale-[1.02] transition-all shadow-glow"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-20">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <Shield className="w-7 h-7 text-accent" />
            Command Dashboard
          </h1>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">
            LITHOS Emergency Operations · Live Data
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={triggerEvacuation}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
              evacuSent
                ? 'bg-risk-red/30 text-risk-red border border-risk-red/50 cursor-default'
                : 'bg-risk-red text-white hover:scale-[1.02] shadow-lg shadow-red-900/40 animate-pulse'
            }`}
            disabled={evacuSent}
          >
            <Zap className="w-4 h-4" />
            {evacuSent ? '✓ Evacuation Broadcast Sent' : 'Mass Evacuation Alert'}
          </button>
          <button
            onClick={() => setAuthed(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs text-white/40 hover:text-white border border-white/10 hover:border-white/30 transition-all uppercase"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {/* Live SOS alert banner */}
      {liveAlert && (
        <div className="glass border-2 border-risk-red rounded-2xl p-4 flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-risk-red flex items-center justify-center text-white font-black text-lg flex-shrink-0">
            🆘
          </div>
          <div>
            <p className="text-risk-red font-black text-sm uppercase tracking-wider">LIVE SOS RECEIVED</p>
            <p className="text-white/70 text-xs font-bold mt-0.5">
              {liveAlert.message} · ({liveAlert.lat?.toFixed(4)}, {liveAlert.lon?.toFixed(4)}) · {liveAlert.region}
            </p>
          </div>
        </div>
      )}

      {/* Zone counters */}
      {userCounts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Users', val: userCounts.total,  icon: <Users className="w-5 h-5 text-accent" />,        color: 'text-white' },
            { label: 'In RED Zones', val: userCounts.RED,    icon: <AlertTriangle className="w-5 h-5 text-risk-red" />, color: 'text-risk-red' },
            { label: 'In ORANGE Zones', val: userCounts.ORANGE, icon: <Radio className="w-5 h-5 text-risk-orange" />, color: 'text-risk-orange' },
            { label: 'SOS Incidents', val: sosList.length,   icon: <MapPin className="w-5 h-5 text-risk-red" />,      color: 'text-risk-red' },
          ].map((item, i) => (
            <div key={i} className="glass p-4 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
              <span className="block mb-2">{item.icon}</span>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">{item.label}</h4>
              <p className={`text-2xl font-black ${item.color}`}>{item.val ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SOS Log */}
        <div className="glass p-6 rounded-3xl">
          <h3 className="text-sm font-black tracking-tight mb-4 flex items-center gap-2">
            🆘 SOS Incident Log
            <span className="ml-auto text-[10px] text-white/30 font-bold">Latest {sosList.length}</span>
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {sosList.length === 0 && (
              <p className="text-[10px] text-white/30 font-bold text-center py-6">No active incidents</p>
            )}
            {sosList.map((s, i) => (
              <div key={i} className="bg-risk-red/5 border border-risk-red/20 p-3 rounded-xl flex justify-between items-start gap-3">
                <div>
                  <p className="text-xs font-black text-risk-red">{s.sos_id}</p>
                  <p className="text-[10px] text-white/60 font-bold mt-0.5">
                    ({s.lat?.toFixed(4)}, {s.lon?.toFixed(4)}) · {s.region}
                  </p>
                  <p className="text-[9px] text-white/30 mt-0.5 italic">{s.message}</p>
                </div>
                <span className="text-[9px] text-white/30 font-bold flex-shrink-0">
                  {new Date(s.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active blockages */}
        <div className="glass p-6 rounded-3xl">
          <h3 className="text-sm font-black tracking-tight mb-4 flex items-center gap-2">
            🚧 Active Road Blockages
            <span className="ml-auto text-[10px] text-white/30 font-bold">{blockages.length} active</span>
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {blockages.length === 0 && (
              <p className="text-[10px] text-white/30 font-bold text-center py-6">No active blockages</p>
            )}
            {blockages.map((f, i) => (
              <div key={i} className="bg-risk-orange/5 border border-risk-orange/20 p-3 rounded-xl">
                <p className="text-xs font-black text-risk-orange">{f.properties?.message}</p>
                <p className="text-[10px] text-white/40 font-bold mt-0.5">
                  Confirmed: {f.properties?.confirm_count} · Expires: {new Date(f.properties?.expires_at).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="glass p-6 rounded-3xl">
          <h3 className="text-sm font-black tracking-tight mb-4">📊 System Status</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Monitored Cells', val: stats.total_cells_monitored?.toLocaleString() },
              { label: 'RED Zones Active', val: stats.red_zones_active, color: 'text-risk-red' },
              { label: 'Reports Today', val: stats.community_reports_today, color: 'text-accent' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <p className={`text-xl font-black ${item.color ?? 'text-white'}`}>{item.val ?? '—'}</p>
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPortal;
