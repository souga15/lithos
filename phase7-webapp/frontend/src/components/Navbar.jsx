import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mountain, ShieldAlert, Bell, AlertTriangle, ArrowRight } from 'lucide-react';
import API_BASE_URL from '../apiConfig';
import { alertAudio, sendBrowserNotification } from '../utils/alertAudio';

const Navbar = ({ alertCount, isOffline }) => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Notification dropdown state
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const dropdownRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fetch initial alerts and connect WebSocket
  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/alerts/active`);
        if (res.ok) {
          const data = await res.json();
          if (data.active_alerts) {
            setRecentAlerts(data.active_alerts.slice(0, 3));
            setUnreadAlerts(data.active_alerts.length);
          }
        }
      } catch (e) {
        console.warn("Navbar alert fetch error", e);
      }
    };
    fetchActive();

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
              
              setRecentAlerts(prev => [incoming, ...prev].slice(0, 5));
              setUnreadAlerts(prev => prev + 1);
              
              const isSubscribed = localStorage.getItem('lithos_subscribed') === 'true';
              const notified = JSON.parse(localStorage.getItem('lithos_notified') || '[]');

              if (!showNotifications && isSubscribed && !notified.includes(incoming.alert_id)) {
                notified.push(incoming.alert_id);
                localStorage.setItem('lithos_notified', JSON.stringify(notified));
                
                alertAudio.playEmergencyChime();
                sendBrowserNotification(`🚨 [CRITICAL ALERT] ${incoming.region_name}`, {
                  body: `${incoming.message}`,
                  url: '/route'
                });
              }
            }
          } catch (e) {
            console.warn("[Navbar] WS parse error:", e);
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
  }, [showNotifications]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { name: 'Home',            path: '/'         },
    { name: 'Dashboard',       path: '/dashboard' },
    { name: 'Safe Route',      path: '/route'     },
    { name: 'Forecast',        path: '/forecast'  },
    { name: 'Alerts',          path: '/alerts',  badge: alertCount },
    { name: 'Sensors',         path: '/sensor'   },
    { name: 'Reports',         path: '/reports'  },
    { name: 'Regions',         path: '/regions'  },
    { name: 'Engineer Portal', path: '/engineer' },
    { name: 'About',           path: '/about'    },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav
      className="relative z-50 h-14 flex items-center px-5 border-b transition-all duration-200"
      style={{
        background: scrolled
          ? 'rgba(7,9,26,0.92)'
          : 'rgba(7,9,26,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottomColor: 'rgba(255,255,255,0.04)',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(43,158,255,0.4) 50%, transparent 100%)',
        }}
      />

      <div className="flex items-center justify-between w-full">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative">
            <img
              src="/logo.png"
              alt="LITHOS Logo"
              onError={(e) => {
                e.target.style.display = 'none';
                document.getElementById('navbar-fallback-logo').style.display = 'block';
              }}
              className="w-6 h-6 object-contain transition-all duration-200 group-hover:drop-shadow-[0_0_6px_rgba(43,158,255,0.6)]"
            />
            <Mountain
              id="navbar-fallback-logo"
              className="hidden w-5 h-5 text-accent"
            />
          </div>
          <span
            className="font-bold text-sm tracking-tight text-white/90 group-hover:text-white transition-colors"
            style={{ letterSpacing: '-0.01em' }}
          >
            LITHOS
          </span>
          <span
            className="hidden sm:inline-block text-2xs font-mono text-white/20 border border-white/10 px-1.5 py-0.5 rounded"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            v7.0
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link relative select-none ${isActive(item.path) ? 'active' : ''}`}
            >
              {item.name}
              {item.badge > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ background: 'var(--risk-red)', color: '#050814' }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Right Side Indicators & Actions */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Notifications Bell Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) setUnreadAlerts(0);
              }}
              className="relative p-1.5 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5 outline-none flex items-center justify-center"
              title="Recent Alerts"
            >
              <Bell className={`w-4 h-4 ${unreadAlerts > 0 ? 'text-red-400' : ''}`} />
              {unreadAlerts > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border border-[#050814] animate-pulse"></span>
              )}
            </button>

            {/* Dropdown Panel */}
            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-80 rounded-xl border border-slate-700/50 shadow-2xl bg-slate-900/95 backdrop-blur-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2.5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <span className="text-xs font-bold text-slate-200">Recent Alerts</span>
                  <Link to="/alerts" onClick={() => setShowNotifications(false)} className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300">
                    View All
                  </Link>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto">
                  {recentAlerts.length === 0 ? (
                    <div className="p-6 text-center">
                      <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-slate-400">No active alerts at this time.</p>
                    </div>
                  ) : (
                    recentAlerts.map(alert => (
                      <div key={alert.alert_id} className="p-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors group">
                        <div className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-bold text-red-200 truncate pr-2">{alert.region_name || alert.region}</span>
                              <span className="text-[9px] text-slate-500 font-mono shrink-0">
                                {new Date(alert.triggered_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight line-clamp-2 mb-1.5">
                              {alert.message}
                            </p>
                            <Link to="/route" onClick={() => setShowNotifications(false)} className="inline-flex items-center gap-1 text-[9px] font-semibold text-cyan-400 hover:text-cyan-300 group-hover:underline">
                              View Route <ArrowRight className="w-2.5 h-2.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live / Offline status */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isOffline ? '' : 'animate-pulse-dot'
              }`}
              style={{ background: isOffline ? 'var(--risk-orange)' : 'var(--risk-green)' }}
            />
            <span className="data-mono text-[10px] font-medium text-white/40 uppercase tracking-wider">
              {isOffline ? 'OFFLINE' : 'LIVE'}
            </span>
          </div>

          {/* Report CTA */}
          <Link
            to="/reports"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-all duration-150"
            style={{
              background: 'rgba(230,57,70,0.12)',
              color: 'var(--risk-red)',
              border: '1px solid rgba(230,57,70,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(230,57,70,0.2)';
              e.currentTarget.style.borderColor = 'rgba(230,57,70,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(230,57,70,0.12)';
              e.currentTarget.style.borderColor = 'rgba(230,57,70,0.2)';
            }}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">REPORT</span>
          </Link>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden p-1.5 text-white/40 hover:text-white/80 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <div className="w-5 h-5 flex flex-col justify-center gap-1.5">
              <div className={`h-px bg-current transition-all duration-200 ${isMenuOpen ? 'rotate-45 translate-y-[5px] w-full' : 'w-full'}`} />
              <div className={`h-px bg-current transition-all duration-200 ${isMenuOpen ? 'opacity-0 w-0' : 'w-3/4'}`} />
              <div className={`h-px bg-current transition-all duration-200 ${isMenuOpen ? '-rotate-45 -translate-y-[5px] w-full' : 'w-full'}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMenuOpen && (
        <div
          className="lg:hidden absolute top-14 left-0 right-0 animate-slide-down"
          style={{
            background: 'rgba(7,9,26,0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="p-3 flex flex-col gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2.5 rounded text-sm font-medium transition-all duration-100 flex justify-between items-center ${
                  isActive(item.path)
                    ? 'text-accent bg-accent/8 border-l-2 border-accent pl-4'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.03]'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
                {item.badge > 0 && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: 'var(--risk-red)', color: '#050814' }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
          <div className="px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <span className="data-mono text-[10px] text-white/20 uppercase tracking-wider">
              LITHOS v7.0.0
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${!isOffline && 'animate-pulse-dot'}`}
                style={{ background: isOffline ? 'var(--risk-orange)' : 'var(--risk-green)' }}
              />
              <span className="data-mono text-[10px] text-white/30 uppercase">
                {isOffline ? 'OFFLINE' : 'LIVE DATA'}
              </span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
