import React, { useState, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Globe, AlertTriangle, BellRing, Users, RadioTower } from 'lucide-react';

// Framer Motion Animated Counter Component
const AnimatedCounter = ({ value, duration = 2, colorVar }) => {
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(spring, (current) => Math.floor(current).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span className="data-mono text-3xl font-bold" style={{ color: colorVar }}>{display}</motion.span>;
};

const StatCard = ({ label, val, icon, colorVar, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="glass p-5 rounded topo-texture group relative overflow-hidden"
    style={{ borderTop: `2px solid ${colorVar || 'rgba(200,245,122,0.1)'}` }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
  >
    <div className="flex items-start justify-between mb-4">
      <div style={{ color: colorVar || 'var(--silver)' }} className="transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
    </div>
    <p className="label-micro mb-2">{label}</p>
    <AnimatedCounter value={val} colorVar={colorVar || 'white'} />
  </motion.div>
);

const Dashboard = () => {
  // Mock Stats Data
  const stats = [
    { label: 'MONITORED CELLS', val: 14250, icon: <Globe size={20} />, colorVar: 'white' },
    { label: 'CRITICAL ZONES',  val: 12,    icon: <AlertTriangle size={20} />, colorVar: 'var(--risk-red)' },
    { label: 'ACTIVE ALERTS',   val: 3,     icon: <BellRing size={20} />, colorVar: 'var(--risk-orange)' },
    { label: 'REPORTS TODAY',   val: 145,   icon: <Users size={20} />, colorVar: 'var(--accent)' },
    { label: 'DATA LATENCY',    val: 14,    icon: <RadioTower size={20} />, colorVar: 'var(--risk-green)' },
  ];

  // Placeholder for Pretext-rendered items in the future
  // Pretext is highly specialized for complex text-layout geometry
  // This list simulates what would be virtualized text measured by pretext in a heavy UI
  const alertsList = Array.from({ length: 5 }).map((_, i) => ({
    id: i,
    region: 'CHERRAPUNJI',
    risk: 'RED',
    status: 'ACTIVE',
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto pb-24">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <h1 className="font-display text-5xl tracking-wide uppercase">Command Center</h1>
        <p className="data-mono text-silver text-xs">Live telemetry analysis</p>
      </motion.div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((s, i) => (
          <StatCard key={i} {...s} delay={0.1 * i} />
        ))}
      </div>

      {/* Complex Data Layout Area (The "Pretext.js" Use-Case Area) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Alerts Feed */}
        <motion.div 
          className="glass-elevated rounded-lg col-span-2 overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="p-5 border-b border-[rgba(200,245,122,0.1)]">
            <h3 className="font-display text-2xl text-accent">ACTIVE CRITICAL ZONES</h3>
          </div>
          
          <div className="flex flex-col">
            {alertsList.map((alert, i) => (
              <motion.div 
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.6 + (i * 0.1) }}
                className="p-5 border-b border-[rgba(200,245,122,0.05)] flex items-center justify-between hover:bg-surface/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-risk-red shadow-glow-red"></div>
                  <div>
                    <div className="font-display text-2xl leading-none mb-1">{alert.region}</div>
                    <div className="data-mono text-[10px] text-silver">Cell Cluster {700 + i * 14}</div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  <span className="data-mono text-xs font-bold text-risk-red border border-risk-red/30 bg-risk-red/10 px-2 py-0.5 rounded">
                    RISK SCORE: {(0.85 + Math.random() * 0.1).toFixed(2)}
                  </span>
                  <span className="data-mono text-[10px] text-silver">Last updated 2m ago</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        
        <motion.div 
          className="glass rounded-lg topo-texture p-5 flex flex-col justify-between"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
           <h3 className="font-display text-2xl text-silver">SYSTEM STATUS</h3>
           
           <div className="space-y-4 my-8">
             <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="data-mono text-xs text-white">TERRAIN ENGINE</span>
                  <span className="data-mono text-[10px] text-accent">NOMINAL</span>
                </div>
                <div className="h-1 bg-surface rounded overflow-hidden">
                  <div className="h-full bg-accent w-full" />
                </div>
             </div>
             
             <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="data-mono text-xs text-white">AI INFERENCE</span>
                  <span className="data-mono text-[10px] text-risk-orange">HIGH LOAD</span>
                </div>
                <div className="h-1 bg-surface rounded overflow-hidden">
                  <div className="h-full bg-risk-orange w-[85%]" />
                </div>
             </div>
           </div>
           
           <button className="w-full btn-primary font-bold tracking-widest text-sm">
             VIEW FULL METRICS
           </button>
        </motion.div>
      </div>

    </div>
  );
};

export default Dashboard;
