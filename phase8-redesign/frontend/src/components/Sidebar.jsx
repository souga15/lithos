import React from 'react';
import { NavLink } from 'react-router-dom';
import { Globe, LayoutDashboard, Route, CloudLightning, ShieldAlert, FileText, Map, Users, Info } from 'lucide-react';
import { motion } from 'framer-motion';

const Sidebar = ({ isOffline, alertCount = 0 }) => {
  const navItems = [
    { name: 'Home',            path: '/',          icon: <Globe size={18} /> },
    { name: 'Dashboard',       path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Live Recon',      path: '/recon',     icon: <Globe size={18} /> },
    { name: 'Safe Route',      path: '/route',     icon: <Route size={18} /> },
    { name: 'Forecast',        path: '/forecast',  icon: <CloudLightning size={18} /> },
    { name: 'Alerts',          path: '/alerts',    icon: <ShieldAlert size={18} />, badge: alertCount },
    { name: 'Reports',         path: '/reports',   icon: <FileText size={18} /> },
    { name: 'Regions',         path: '/regions',   icon: <Map size={18} /> },
    { name: 'Engineer Portal', path: '/engineer',  icon: <Users size={18} /> },
    { name: 'About',           path: '/about',     icon: <Info size={18} /> },
  ];

  return (
    <div className="w-64 h-screen bg-nav border-r border-[rgba(200,245,122,0.05)] flex flex-col justify-between hidden md:flex shrink-0 relative z-50">
      
      {/* Topographic overlay for sidebar */}
      <div className="absolute inset-0 pointer-events-none topo-texture opacity-30 mix-blend-overlay"></div>

      <div className="relative z-10 p-6">
        {/* Brand */}
        <div className="mb-10 flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-surface border border-accent/20 text-accent font-display font-bold text-xl select-none">
            L
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl leading-none tracking-tight">LITHOS</span>
            <span className="data-mono text-[9px] text-silver tracking-[0.2em] uppercase">Intelligence</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                relative flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-200
                ${isActive 
                  ? 'text-accent bg-accent/10 border border-accent/20 shadow-[0_0_15px_rgba(200,245,122,0.1)]' 
                  : 'text-silver hover:text-white hover:bg-surface border border-transparent'}
              `}
            >
              {({ isActive }) => (
                <>
                  <motion.div 
                    initial={false}
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    {item.icon}
                  </motion.div>
                  <span className="font-display text-lg mt-1 tracking-wide">{item.name}</span>
                  
                  {item.badge > 0 && (
                    <span className="absolute right-3 bg-risk-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded data-mono">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer / Status */}
      <div className="relative z-10 p-6 border-t border-[rgba(200,245,122,0.05)] bg-surface/50">
        <div className="flex items-center justify-between mb-4">
          <span className="data-mono text-[10px] text-silver">SYS.VER.8.0.0</span>
          <div className="flex items-center gap-2">
            <span className="data-mono text-[10px] uppercase font-bold text-silver">
              {isOffline ? 'OFFLINE' : 'LIVE'}
            </span>
            <div className="relative flex h-2 w-2">
              {!isOffline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-risk-green opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOffline ? 'bg-risk-orange' : 'bg-risk-green'}`}></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
