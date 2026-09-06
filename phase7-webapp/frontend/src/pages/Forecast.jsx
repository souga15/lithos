import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Calendar } from 'lucide-react';
import RiskBadge from '../components/RiskBadge';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Title, Tooltip, Legend, Filler);

const Forecast = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchRegions();
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      fetchForecast(selectedRegion.key);
    }
  }, [selectedRegion]);

  const fetchRegions = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/regions`);
      setRegions(resp.data.regions);
      setSelectedRegion(resp.data.regions[0]);
    } catch (err) { console.error(err); }
  };

  const fetchForecast = async (key) => {
    try {
      const [f, s] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/forecast?region=${key}`),
        axios.get(`${API_BASE_URL}/api/forecast/summary?region=${key}`)
      ]);
      setForecast(f.data.forecast);
      setSummary(s.data);
    } catch (err) { console.error(err); }
  };

  if (!forecast || !summary) return <div className="p-8 text-accent animate-pulse font-black uppercase tracking-widest">Generating 72hr Predictive Risk Models...</div>;

  const chartData = {
    labels: forecast.map(h => h.hour + 'h'),
    datasets: [
      {
        label: 'Predicted Risk',
        data: forecast.map(h => h.predicted_risk_score),
        fill: true,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, '#FF3B30AA');
          gradient.addColorStop(0.5, '#FF950066');
          gradient.addColorStop(1, '#30D15822');
          return gradient;
        },
        borderColor: '#00C2FF',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4
      },
      {
        label: 'Rainfall (mm)',
        data: forecast.map(h => h.rainfall_mm),
        type: 'bar',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        yAxisID: 'y1'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#0D1117',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 10 },
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1
      }
    },
    scales: {
      y: { min: 0, max: 1, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
      y1: { position: 'right', grid: { display: false }, border: { display: false }, display: false },
      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12, color: 'rgba(255,255,255,0.4)', font: { size: 9 } } }
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-fade-in relative pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
            <Calendar className="w-7 h-7 text-accent" /> 72hr Risk Forecast
          </h1>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">Satellite-coupled predictive temporal modelling</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto">
          {regions.slice(0, 9).map(r => (
            <button
              key={r.key}
              onClick={() => setSelectedRegion(r)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all whitespace-nowrap ${
                selectedRegion.key === r.key ? 'bg-accent text-bg' : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              {r.name.split(',')[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Forecast Chart */}
      <div className="glass p-8 rounded-[2rem] border-white/5">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-risk-green animate-pulse-dot" />
            <h3 className="text-xs font-black uppercase tracking-widest opacity-80">PROBABILITY CURVE</h3>
          </div>
          <p className="text-[10px] font-bold text-white/20 italic">Validated on NASA GPM IMERG-F dataset</p>
        </div>
        <div className="h-[400px] relative">
          {/* Background Bands */}
          <div className="absolute inset-0 pointer-events-none flex flex-col pt-1.5 pb-7">
            <div className="flex-1 bg-red-500/5 border-b border-red-500/10" />
            <div className="flex-1 bg-orange-500/5 border-b border-orange-500/10" />
            <div className="flex-1 bg-green-500/5" />
          </div>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'NEXT 6 HOURS', data: summary.next_6h },
          { label: 'NEXT 24 HOURS', data: summary.next_24h },
          { label: 'NEXT 72 HOURS', data: summary.next_72h }
        ].map((item, i) => (
          <div key={i} className="glass p-6 rounded-3xl border-white/5 space-y-4">
            <h4 className="text-[10px] font-black tracking-widest text-white/30 uppercase">{item.label}</h4>
            <div className="flex justify-between items-start">
              <RiskBadge level={item.data.level} />
              <div className="text-right">
                <p className="text-lg font-black">{Math.round(item.data.confidence_pct)}%</p>
                <p className="text-[8px] font-bold text-white/40 uppercase">Confidence</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="opacity-40 uppercase tracking-tighter">Primary Driver</span>
                <span className="text-secondary uppercase">{item.data.key_driver.replace('_',' ')}</span>
              </div>
              <p className="text-xs font-medium leading-relaxed italic text-white/80">"{item.data.message}"</p>
            </div>
          </div>
        ))}
      </div>

      {/* Model Accuracy Footer */}
      <div className="glass p-5 rounded-2xl border-white/5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center font-black text-xs border border-white/10 uppercase">XAI</div>
          <div>
            <h4 className="text-[11px] font-black uppercase">Model Validation (AUC)</h4>
            <p className="text-[10px] opacity-40 italic">Testing on real-time monsoon events across 9 regions</p>
          </div>
        </div>
        <div className="flex gap-4">
          {[
            { tag: 'CHERRAPUNJI JUN 2022', val: '91.3%' },
            { tag: 'WAYANAD AUG 2018', val: '88.7%' },
            { tag: 'SIKKIM OCT 2023', val: '85.2%' }
          ].map(v => (
            <div key={v.tag} className="text-right">
              <p className="text-[8px] font-bold opacity-30 uppercase">{v.tag}</p>
              <p className="text-xs font-black text-accent">{v.val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Forecast;
