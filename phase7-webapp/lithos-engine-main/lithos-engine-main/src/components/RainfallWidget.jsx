import React from 'react';
import { CloudRain } from 'lucide-react';

const RainfallWidget = ({ weather, regionName }) => {
  if (!weather) return <div className="animate-pulse glass h-48 rounded-xl" />;

  const getIntensityColor = (v) => {
    if (v > 50) return 'text-risk-red';
    if (v > 20) return 'text-risk-orange';
    return 'text-risk-green';
  };

  return (
    <div className="glass p-4 rounded-xl space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-[10px] font-black tracking-widest text-white/40 uppercase mb-0.5">LOCATION</h3>
          <p className="text-sm font-bold truncate max-w-[140px]">{regionName}</p>
        </div>
        <div className="text-right">
          <h3 className="text-[10px] font-black tracking-widest text-white/40 uppercase mb-0.5">SOURCE</h3>
          <p className="text-[10px] font-bold text-accent">NASA GPM + OPEN-METEO</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <CloudRain className="w-10 h-10 text-risk-orange" />
        </div>
        <div>
          <p className={`text-3xl font-black tracking-tighter ${getIntensityColor(weather.rainfall_1h * 10)}`}>
            {weather.rainfall_1h}<span className="text-xs ml-1 opacity-50 uppercase font-bold">mm/hr</span>
          </p>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Live Rainfall Intensity</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '6H', val: weather.rainfall_6h },
          { label: '24H', val: weather.rainfall_24h },
          { label: '72H', val: weather.rainfall_72h || 0 }
        ].map(item => (
          <div key={item.label} className="bg-white/5 border border-white/5 p-2 rounded-lg text-center">
            <p className="text-[8px] font-black text-white/30 uppercase mb-1">{item.label}</p>
            <p className={`text-xs font-black ${getIntensityColor(item.val)}`}>{item.val}mm</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <div className="flex justify-between text-[10px] font-bold mb-1.5 uppercase">
            <span className="opacity-40">Soil Moisture</span>
            <span className="text-accent">{Math.round(weather.soil_moisture * 100)}%</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${weather.soil_moisture * 100}%` }} />
          </div>
        </div>

        <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
          <div>
            <p className="text-[8px] font-black text-white/30 uppercase">MODIS LST</p>
            <p className="text-xs font-bold">{weather.temperature}°C</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-white/30 uppercase">ANOMALY</p>
            <p className="text-xs font-bold text-risk-orange">+2.4°C</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 pt-1">
        <span className="w-1.5 h-1.5 rounded-full bg-risk-green animate-pulse-dot" />
        <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">
          Last Updated: 14 min ago
        </p>
      </div>
    </div>
  );
};

export default RainfallWidget;
