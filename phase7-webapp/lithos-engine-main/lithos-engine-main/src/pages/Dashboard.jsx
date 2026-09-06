import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Globe, AlertTriangle, BellRing, Users, RadioTower } from 'lucide-react';
import RiskBadge from '../components/RiskBadge';

ChartJS.register(...registerables);

// Skeleton row for table loading states
const SkeletonRow = ({ cols = 4 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="py-3 px-3">
        <div className="skeleton h-3 rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
      </td>
    ))}
  </tr>
);

const StatCard = ({ label, val, icon, colorVar, loading }) => (
  <div
    className="glass p-4 rounded transition-all duration-150 group relative overflow-hidden"
    style={{ borderTop: `1px solid ${colorVar ? colorVar + '30' : 'rgba(255,255,255,0.05)'}` }}
    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
    onMouseLeave={e => (e.currentTarget.style.background = '')}
  >
    <div className="flex items-start justify-between mb-3">
      <div style={{ color: colorVar || 'rgba(255,255,255,0.3)' }} className="transition-transform duration-200 group-hover:scale-105">
        {icon}
      </div>
    </div>
    <p className="label-micro mb-1">{label}</p>
    {loading
      ? <div className="skeleton h-5 w-16 rounded" />
      : <p className="data-mono text-xl font-bold text-white" style={{ color: colorVar }}>{val}</p>
    }
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [regions, setRegions] = useState([]);
  const [dangerCells, setDangerCells] = useState([]);
  const [freshness, setFreshness] = useState([]);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [s, r, f, t] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/stats?t=${Date.now()}`),
        axios.get(`${API_BASE_URL}/api/regions?t=${Date.now()}`),
        axios.get(`${API_BASE_URL}/api/freshness?t=${Date.now()}`),
        axios.get(`${API_BASE_URL}/api/timeline?t=${Date.now()}`)
      ]);
      setStats(s.data); setRegions(r.data.regions);
      setFreshness(f.data.sources); setTimeline(t.data);
      localStorage.setItem('lithos_dashboard_cache', JSON.stringify({ s: s.data, r: r.data.regions, f: f.data.sources, t: t.data }));

      const topResp = await axios.get(`${API_BASE_URL}/api/risk-grid?region=cherrapunji&t=${Date.now()}`);
      const topData = topResp.data.features.slice(0, 10).map(f => f.properties).sort((a, b) => b.risk_score - a.risk_score);
      setDangerCells(topData);
      localStorage.setItem('lithos_danger_cache', JSON.stringify(topData));
    } catch (err) {
      console.error('Network failed. Loading from offline cache...', err);
      const cached = localStorage.getItem('lithos_dashboard_cache');
      if (cached) { const p = JSON.parse(cached); setStats(p.s); setRegions(p.r); setFreshness(p.f); setTimeline(p.t); }
      const cachedDanger = localStorage.getItem('lithos_danger_cache');
      if (cachedDanger) setDangerCells(JSON.parse(cachedDanger));
    } finally { setLoading(false); }
  };

  const donutData = stats ? {
    labels: ['RED', 'ORANGE', 'GREEN'],
    datasets: [{
      data: [stats.red_zones_active, stats.orange_zones_active, stats.green_zones],
      backgroundColor: ['#E63946', '#F4A261', '#2DC77A'],
      borderWidth: 0, hoverOffset: 6,
    }]
  } : null;

  const lineData = {
    labels: timeline?.labels   || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    datasets: [
      {
        label: 'Rainfall (mm)',
        data: timeline?.rainfall || [12, 45, 89, 124, 67, 34, 15],
        borderColor: '#2B9EFF', borderWidth: 1.5,
        backgroundColor: 'rgba(43,158,255,0.05)',
        fill: true, tension: 0.4, pointRadius: 2,
      },
      {
        label: 'Risk Score (avg)',
        data: timeline?.risk_score || [0.1, 0.3, 0.6, 0.85, 0.6, 0.4, 0.2],
        borderColor: '#E63946', borderWidth: 1.5,
        borderDash: [4, 4], tension: 0.4, pointRadius: 2,
      }
    ]
  };

  const chartOpts = {
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.35)', font: { size: 10, family: '"JetBrains Mono"' }, boxWidth: 10 } } },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9, family: '"JetBrains Mono"' } }, border: { color: 'rgba(255,255,255,0.04)' } },
      x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9, family: '"JetBrains Mono"' } }, border: { color: 'rgba(255,255,255,0.04)' } }
    }
  };

  const statItems = stats ? [
    { label: 'MONITORED CELLS', val: stats.total_cells_monitored.toLocaleString(), icon: <Globe className="w-4 h-4" />, colorVar: 'rgba(255,255,255,0.5)' },
    { label: 'CRITICAL ZONES',  val: stats.red_zones_active,                        icon: <AlertTriangle className="w-4 h-4" />, colorVar: 'var(--risk-red)'    },
    { label: 'ACTIVE ALERTS',   val: stats.active_alerts || 0,                       icon: <BellRing className="w-4 h-4" />,     colorVar: 'var(--risk-orange)' },
    { label: 'REPORTS TODAY',   val: stats.community_reports_today,                  icon: <Users className="w-4 h-4" />,        colorVar: 'var(--accent)'      },
    { label: 'DATA LATENCY',    val: '14 min',                                       icon: <RadioTower className="w-4 h-4" />,   colorVar: 'var(--risk-green)'  },
  ] : [];

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5 animate-fade-in pb-20">

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {loading
          ? Array(5).fill(null).map((_, i) => (
              <div key={i} className="glass p-4 rounded space-y-3">
                <div className="skeleton h-4 w-4 rounded" />
                <div className="skeleton h-2 w-20 rounded" />
                <div className="skeleton h-5 w-12 rounded" />
              </div>
            ))
          : statItems.map((item, i) => <StatCard key={i} {...item} />)
        }
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Donut */}
        <div className="glass p-5 rounded">
          <h3 className="heading-accent mb-5">GLOBAL RISK DISTRIBUTION</h3>
          <div className="h-56 flex items-center justify-center relative">
            {donutData
              ? <><Doughnut data={donutData} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
                  <div className="absolute text-center">
                    <p className="text-2xl font-black font-mono">{stats.total_cells_monitored.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Total Cells</p>
                  </div></>
              : <div className="skeleton w-40 h-40 rounded-full" />
            }
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {[['RED','var(--risk-red)'],['ORANGE','var(--risk-orange)'],['GREEN','var(--risk-green)']].map(([lvl, col]) => (
              <div key={lvl} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm" style={{ background: col }} />
                <span className="data-mono text-[10px] text-white/40">{lvl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line Chart */}
        <div className="glass p-5 rounded">
          <h3 className="heading-accent mb-5">RAINFALL VS RISK TIMELINE</h3>
          <div className="h-56">
            <Line data={lineData} options={chartOpts} />
          </div>
        </div>
      </div>

      {/* Live Data Sources */}
      <div className="glass rounded overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          <h3 className="heading-accent"><RadioTower className="w-4 h-4" style={{ color: 'var(--accent)' }} />LIVE DATA SOURCES</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {['Source','Last Update','Frequency','Status'].map(h => (
                  <th key={h} className="py-2.5 px-4 text-left label-micro">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(4).fill(null).map((_, i) => <SkeletonRow key={i} cols={4} />)
                : freshness.map(src => (
                    <tr key={src.source} className="data-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.025)' }}>
                      <td className="py-3 px-4 text-xs font-medium text-white/80">{src.label}</td>
                      <td className="py-3 px-4 data-mono text-[11px] text-white/40">{src.last_updated_human}</td>
                      <td className="py-3 px-4 data-mono text-[11px] text-white/40">{src.frequency}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--risk-${src.status})` }} />
                          <span className="data-mono text-[10px] uppercase font-bold" style={{ color: `var(--risk-${src.status})` }}>{src.status}</span>
                          {src.note && <span className="data-mono text-[10px] text-white/20 italic ml-1">{src.note}</span>}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Danger Cells */}
      <div className="glass rounded overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: 'var(--risk-red)' }} />
          <h3 className="heading-accent" style={{ gap: 0 }}>HIGHEST RISK CELLS</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {['ID','Region','Risk','Top Factor','Rain 72h',''].map(h => (
                  <th key={h} className="py-2.5 px-4 text-left label-micro">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(5).fill(null).map((_, i) => <SkeletonRow key={i} cols={6} />)
                : dangerCells.map(cell => (
                    <tr key={cell.cell_id} className="hover:bg-white/3 transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.025)' }}>
                      <td className="py-3.5 px-4 data-mono text-[11px] text-white/50">{cell.cell_id}</td>
                      <td className="py-3.5 px-4 text-xs font-medium uppercase text-white/70">{cell.region}</td>
                      <td className="py-3.5 px-4"><RiskBadge level={cell.risk_level} score={cell.risk_score} /></td>
                      <td className="py-3.5 px-4 text-xs text-white/40 uppercase">{cell.top_risk_factor.replace('_', ' ')}</td>
                      <td className="py-3.5 px-4 data-mono text-xs font-medium" style={{ color: 'var(--risk-orange)' }}>{cell.rainfall_72h}mm</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate('/', { state: { bypassIntro: true, regionKey: cell.region.toLowerCase() } })}
                          className="data-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded border transition-all duration-100"
                          style={{ color: 'var(--accent)', borderColor: 'rgba(43,158,255,0.2)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(43,158,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(43,158,255,0.4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = 'rgba(43,158,255,0.2)'; }}
                        >
                          View Map
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Region Risk Bars */}
      <div className="glass p-5 rounded">
        <h3 className="heading-accent mb-5">RISK % BY REGION</h3>
        <div className="space-y-3.5">
          {loading
            ? Array(5).fill(null).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between"><div className="skeleton h-3 w-24 rounded" /><div className="skeleton h-3 w-16 rounded" /></div>
                  <div className="skeleton h-1 w-full rounded" />
                </div>
              ))
            : regions.sort((a, b) => b.red_pct - a.red_pct).map(reg => (
                <div key={reg.key} className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-medium text-white/60 uppercase tracking-tight">{reg.name}</span>
                    <span className="data-mono text-[10px] font-bold" style={{ color: 'var(--risk-red)' }}>{reg.red_pct}% critical</span>
                  </div>
                  <div className="h-1 flex rounded overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full transition-all" style={{ width: `${reg.red_pct}%`, background: 'var(--risk-red)' }} />
                    <div className="h-full transition-all" style={{ width: `${(reg.orange_count / reg.cell_count) * 100}%`, background: 'var(--risk-orange)' }} />
                    <div className="h-full transition-all" style={{ width: `${(reg.green_count / reg.cell_count) * 100}%`, background: 'rgba(45,199,122,0.35)' }} />
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
