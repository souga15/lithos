import React from 'react';
import { AlertTriangle } from 'lucide-react';

const OfflineBanner = () => {
  return (
    <div className="bg-risk-orange/90 text-bg py-1 px-4 flex items-center justify-center gap-3 animate-slide-down sticky top-14 z-40 backdrop-blur-sm">
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <p className="text-xs font-bold tracking-wide uppercase">
        YOU ARE OFFLINE — SHOWING CACHED DATA. <span className="hidden sm:inline ml-2 opacity-80 uppercase">WEBSITE WILL AUTO-SYNC WHEN CONNECTION RETURNS.</span>
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="text-[10px] font-black border border-bg/20 px-2 py-0.5 rounded hover:bg-bg/10 transition-all ml-auto"
      >
        RETRY
      </button>
    </div>
  );
};

export default OfflineBanner;
