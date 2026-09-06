import React, { useState } from 'react';
import axios from 'axios';
import { HardHat } from 'lucide-react';
import API_BASE_URL from '../../apiConfig';

const EngineerAuth = ({ onAuthenticated }) => {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authAccessCode, setAuthAccessCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    const url = `${API_BASE_URL}/api/engineer/auth`;
    console.log('🔑 [EngineerAuth] Attempting login to:', url);
    console.log('🔑 [EngineerAuth] Email:', authEmail, '| Mode:', authMode);

    try {
      const res = await axios.post(url, {
        email: authEmail,
        password: authPassword,
        mode: authMode,
        access_code: authAccessCode
      });
      
      console.log('✅ [EngineerAuth] Response:', res.data);
      if (res.data.success) {
        onAuthenticated(res.data.token);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Authentication failed. Please check credentials.';
      console.error('❌ [EngineerAuth] Error:', err.response?.status, detail, err);
      setAuthError(detail);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center bg-[#0A0E1A] relative overflow-hidden">
      {/* Abstract Backgrounds */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#00C2FF]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#FF3B30]/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="glass p-10 rounded-3xl border border-white/10 shadow-2xl w-full max-w-md relative z-10 animate-slide-up backdrop-blur-xl bg-black/40">
        <div className="flex flex-col items-center mb-8 text-center group">
          <img 
            src="/lithos-demo.gif" 
            alt="LITHOS Animation" 
            className="w-24 h-24 object-cover rounded-2xl mb-4 border border-white/10 shadow-[0_0_40px_rgba(0,194,255,0.2)] group-hover:shadow-[0_0_50px_rgba(0,194,255,0.4)] transition-all duration-500"
            onError={(e) => { e.target.style.display='none'; document.getElementById('auth-fallback-icon').style.display='flex'; }}
          />
          <div id="auth-fallback-icon" className="hidden w-16 h-16 bg-[#00C2FF]/10 border border-[#00C2FF]/30 rounded-2xl items-center justify-center mb-4 shadow-[0_0_30px_rgba(0,194,255,0.2)]">
            <HardHat className="w-8 h-8 text-[#00C2FF]" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Engineer Portal</h1>
          <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">Geotechnical Decision Support System</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {authError && (
            <div className="bg-risk-red/10 border border-risk-red/30 text-risk-red text-xs p-3 rounded-lg text-center font-medium animate-pulse">
              {authError}
            </div>
          )}
          
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 block">Government Email</label>
              <input 
                type="email" 
                autoFocus
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#00C2FF]/50 transition-colors"
                placeholder="name@agency.gov"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 block">Password</label>
              <input 
                type="password" 
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#00C2FF]/50 transition-colors"
                placeholder="••••••••"
              />
            </div>
            {authMode === 'signup' && (
              <div className="animate-fade-in">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#FF9500] mb-1 block">Engineering Access Code</label>
                <input 
                  type="password" 
                  required
                  value={authAccessCode}
                  onChange={(e) => setAuthAccessCode(e.target.value)}
                  className="w-full bg-black/50 border border-[#FF9500]/30 rounded-xl px-4 py-3 text-sm text-[#FF9500] outline-none focus:border-[#FF9500] transition-colors"
                  placeholder="Enter Security Code"
                />
                <p className="text-[9px] text-white/30 uppercase mt-2">Required to provision a new geotechnical analyst account.</p>
              </div>
            )}
          </div>

          <button type="submit" disabled={isLoading} className="w-full py-4 bg-[#00C2FF] hover:bg-[#009ACC] disabled:opacity-50 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(0,194,255,0.4)] hover:shadow-[0_0_30px_rgba(0,194,255,0.6)] mt-4">
            {isLoading ? 'Authenticating...' : authMode === 'login' ? 'Authenticate' : 'Request Access'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/10 pt-6">
          <button 
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login');
              setAuthError('');
            }}
            className="text-xs text-white/50 hover:text-white transition-colors"
          >
            {authMode === 'login' ? 'Need an account? Request Engineering Access' : 'Already have access? Proceed to Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EngineerAuth;
