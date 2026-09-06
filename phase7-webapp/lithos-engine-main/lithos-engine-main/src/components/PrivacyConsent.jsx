import React, { useState, useEffect } from 'react';
import { Shield, Check, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyConsent = () => {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the user has already accepted the privacy policy
    // Note for User: You may have accepted this during my previous test. 
    // Clear your browser's local storage (LITHOS_PRIVACY_ACCEPTED) or use Incognito to see it again.
    const hasAccepted = localStorage.getItem('lithos_privacy_accepted');
    if (!hasAccepted) {
      const timer = setTimeout(() => setIsVisible(true), 200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('lithos_privacy_accepted', 'true');
    setIsVisible(false);
  };

  const handleReadFull = () => {
    setIsVisible(false);
    navigate('/privacy');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-bg/90 backdrop-blur-xl animate-fade-in">
      <div className="bg-nav border border-white/10 p-6 md:p-8 rounded-3xl max-w-lg w-full shadow-2xl shadow-accent/20 flex flex-col items-center text-center space-y-6 relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-16 -mt-16" />

        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20 mb-2">
          <Shield className="w-8 h-8 text-accent animate-pulse-slow" />
        </div>

        <div>
          <h2 className="text-2xl font-black mb-2 tracking-tight">Data & Privacy Notice</h2>
          <p className="text-white/70 text-sm leading-relaxed">
            LITHOS processes real-time satellite imagery, weather feeds, and your local device coordinates to provide life-saving landslide risk assessments.
          </p>
        </div>

        <div className="w-full bg-white/5 rounded-2xl p-4 text-left space-y-3 border border-white/5">
          <div className="flex gap-3">
            <div className="min-w-[5px] w-1.5 h-1.5 rounded-full bg-accent mt-1.5" />
            <p className="text-xs text-white/80"><strong className="text-white">No Personal Tracking:</strong> We do not store your name, email, or movement history.</p>
          </div>
          <div className="flex gap-3">
            <div className="min-w-[20px] w-1.5 h-1.5 rounded-full bg-accent mt-1.5" />
            <p className="text-xs text-white/80"><strong className="text-white">Local Location:</strong> Your GPS location is only mathematically processed on your device for proximity alerts.</p>
          </div>
        </div>

        <div className="flex flex-col w-full gap-3 pt-2">
          <button 
            onClick={handleAccept}
            className="w-full py-3.5 bg-accent hover:bg-accent-light text-bg font-bold rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-accent/20"
          >
            <Check className="w-5 h-5" />
            I Agree, Continue to LITHOS
          </button>
          
          <button 
            onClick={handleReadFull}
            className="text-xs font-semibold text-white/50 hover:text-white flex items-center justify-center gap-1.5 transition-colors p-2"
          >
            <FileText className="w-3.5 h-3.5" />
            Read Full Privacy Policy
          </button>
        </div>

      </div>
    </div>
  );
};

export default PrivacyConsent;
