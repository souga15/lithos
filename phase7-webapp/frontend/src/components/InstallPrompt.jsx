import React, { useState, useEffect } from 'react';
import { Smartphone } from 'lucide-react';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait 30 seconds before showing the prompt as per spec
      setTimeout(() => setIsVisible(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-fade-in">
      <div className="glass p-5 rounded-2xl flex items-center gap-5 border-accent/30 shadow-glow">
        <div className="w-14 h-14 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-8 h-8 text-accent" />
        </div>
        <div className="flex-grow">
          <h3 className="font-bold text-sm">Add LITHOS to Home Screen</h3>
          <p className="text-[10px] text-white/60 leading-relaxed mt-0.5">
            Works offline in hill areas. No app store needed. Fast & data-efficient.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button 
            onClick={handleInstall}
            className="bg-accent text-bg font-black text-[10px] px-3 py-2 rounded-lg hover:scale-105 active:scale-95 transition-all"
          >
            INSTALL
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            className="text-[10px] font-bold text-white/40 hover:text-white"
          >
            NOT NOW
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
