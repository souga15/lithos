import React from 'react';

const AlertBanner = ({ alert }) => {
  if (!alert) return null;

  const getLevelColor = () => {
    switch (alert.type) {
      case 'risk_alert': return 'bg-risk-red shadow-red-900/40';
      case 'community_report': return 'bg-risk-yellow text-bg shadow-yellow-900/40';
      case 'weather_alert': return 'bg-risk-orange shadow-orange-900/40';
      default: return 'bg-accent shadow-accent/40';
    }
  };

  const getTypeLabel = () => alert.type.replace('_',' ').toUpperCase();

  return (
    <div className="h-full flex items-center px-4 animate-fade-in whitespace-nowrap overflow-hidden">
      <div className={`px-2 py-0.5 rounded text-[9px] font-black mr-4 shadow-xl flex-shrink-0 ${getLevelColor()}`}>
        {getTypeLabel()}
      </div>
      <p className="text-[11px] font-bold tracking-tight text-white/90">
        <span className="text-accent uppercase mr-2">{alert.region}:</span>
        {alert.message}
      </p>
      <span className="mx-4 text-white/20 text-[10px]">|</span>
      <p className="text-[10px] font-medium opacity-50 flex-shrink-0">
        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
};

export default AlertBanner;
