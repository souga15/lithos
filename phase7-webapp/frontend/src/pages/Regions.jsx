import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { Map } from 'lucide-react';
import RiskBadge from '../components/RiskBadge';

const Regions = () => {
  const navigate = useNavigate();
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/regions`);
      setRegions(resp.data.regions);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="p-8 text-accent animate-pulse font-black uppercase tracking-widest text-center">SCANNING LITHOS REGIONAL NODES...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10 animate-fade-in pb-24">
      <header className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2 flex items-center gap-3">
            <Map className="w-8 h-8 text-accent" /> Monitored Regions
          </h1>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest italic flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-risk-green animate-pulse-dot" />
            9 Active Observation Clusters • 5,400km² Coverage
          </p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-1">Architecture</p>
          <p className="text-xs font-bold">DISTRIBUTED EDGE NODES</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {regions.map((reg, i) => (
          <div key={reg.key} className="glass rounded-[2rem] border-white/5 hover:border-accent/30 hover:scale-[1.02] hover:shadow-glow transition-all duration-500 group overflow-hidden flex flex-col h-full">
            {/* Top Stat Strip */}
            <div className={`h-1.5 w-full bg-risk-${reg.red_pct > 15 ? 'red' : reg.orange_count > 10 ? 'orange' : 'green'}`} />
            
            <div className="p-6 space-y-4 flex-grow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black italic tracking-tighter uppercase group-hover:text-accent transition-colors">{reg.name}</h3>
                  <p className="text-[10px] font-bold opacity-30 uppercase">{reg.state} • {reg.zone}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black font-mono text-risk-red">{reg.red_pct}%</p>
                  <p className="text-[8px] font-bold opacity-20 uppercase">Critical</p>
                </div>
              </div>

              <p className="text-xs font-medium leading-relaxed opacity-60 h-10 overflow-hidden text-ellipsis line-clamp-2 italic">
                "{reg.description}"
              </p>

              <div className="grid grid-cols-3 gap-2 py-2">
                {[
                  { label: 'RED', val: reg.red_count, color: 'risk-red' },
                  { label: 'ORANGE', val: reg.orange_count, color: 'risk-orange' },
                  { label: 'GREEN', val: reg.green_count, color: 'risk-green' }
                ].map(stat => (
                  <div key={stat.label} className="bg-white/5 p-2 rounded-xl text-center border border-white/5">
                    <p className="text-[8px] font-black opacity-30 mb-0.5">{stat.label}</p>
                    <p className={`text-xs font-black font-mono text-${stat.color}`}>{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-[10px] font-bold">
                   <span className="opacity-40 uppercase">Satellite Coverage</span>
                   <span className="text-accent">100% (ACTIVE)</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-accent w-full" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/3 border-t border-white/5 flex gap-2">
              <button onClick={() => navigate('/', { state: { bypassIntro: true, regionKey: reg.key } })} className="flex-1 bg-accent text-bg font-black py-2 rounded-xl text-[10px] uppercase shadow-lg shadow-accent/20 hover:scale-105 transition-all">VIEW LIVE MAP</button>
              <button onClick={() => navigate('/forecast')} className="flex-1 bg-white/5 hover:bg-white/10 text-[10px] font-black py-2 rounded-xl uppercase transition-all">FORECAST</button>
            </div>
          </div>
        ))}
      </div>

      {/* Global Summary Footer */}
      <div className="glass p-10 rounded-[3rem] border-white/10 bg-gradient-to-br from-white/5 to-transparent relative overflow-hidden group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent/10 rounded-full blur-[80px] group-hover:bg-accent/20 transition-all" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-lg text-center md:text-left">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase">LITHOS Multi-Region Engine</h2>
            <p className="text-xs font-medium opacity-60 leading-relaxed uppercase tracking-wide">
              Scaleable infrastructure supporting sub-2km grid precision across diverse Indian terrains. New regions can be integrated in <span className="text-accent underline font-black italic">under 48 hours</span> with historical satellite backtesting.
            </p>
            <div className="flex gap-4 justify-center md:justify-start">
               <div className="flex items-center gap-1.5"><span className="text-accent">●</span><span className="text-[10px] font-bold opacity-40 uppercase">Sentinel-1/2 Ready</span></div>
               <div className="flex items-center gap-1.5"><span className="text-accent">●</span><span className="text-[10px] font-bold opacity-40 uppercase">NASA GPM Piped</span></div>
            </div>
          </div>
          <button className="px-10 py-5 bg-white text-bg font-black rounded-2xl hover:bg-accent hover:text-bg transition-all uppercase tracking-widest text-xs shadow-2xl">REQUEST NEW REGION</button>
        </div>
      </div>
    </div>
  );
};

export default Regions;
