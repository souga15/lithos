import React from 'react';
import { Map, Satellite, RadioTower } from 'lucide-react';

const SatelliteToggle = ({ active, onChange }) => {
  const options = [
    { id: 'street', icon: <Map className="w-3.5 h-3.5" />, label: 'Street' },
    { id: 'satellite', icon: <Satellite className="w-3.5 h-3.5" />, label: 'Sat' },
    { id: 'sar', icon: <RadioTower className="w-3.5 h-3.5" />, label: 'SAR' },
  ];

  return (
    <div className="glass rounded-full p-1 flex gap-1 border-white/20 shadow-glow">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
            active === opt.id 
              ? 'bg-accent text-bg shadow-md' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>{opt.icon}</span>
          <span>{opt.label.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
};

export default SatelliteToggle;
