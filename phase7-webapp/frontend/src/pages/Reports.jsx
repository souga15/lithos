import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { AlertTriangle, ShieldAlert, Mountain, Sparkles, CloudRain, ShieldOff, Users, MapPin, CheckCircle } from 'lucide-react';
import RiskBadge from '../components/RiskBadge';

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({
    type: 'road_blocked',
    severity: 'minor',
    lat: 25.278,
    lon: 91.734,
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchReports();
    // Get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setForm(f => ({ ...f, lat: pos.coords.latitude, lon: pos.coords.longitude }));
      });
    }
  }, []);

  const fetchReports = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/reports/history`);
      setReports(resp.data.reports);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/api/reports/submit`, {
        ...form,
        user_id: 'anonymous_' + Math.floor(Math.random() * 9999)
      });
      setSuccess(resp.data);
      fetchReports();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error(err);
      alert('Error submitting report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const MapPicker = () => {
    useMapEvents({
      click(e) {
        setForm(f => ({ ...f, lat: e.latlng.lat, lon: e.latlng.lng }));
      },
    });
    return null;
  };

  const reportTypes = [
    { id: 'active_landslide', label: 'ACTIVE LANDSLIDE HAPPENING', color: 'risk-red', icon: <ShieldAlert className="w-5 h-5 text-risk-red" /> },
    { id: 'road_blocked', label: 'ROAD COMPLETELY BLOCKED', color: 'risk-red', icon: <ShieldOff className="w-5 h-5 text-risk-red" /> },
    { id: 'debris_on_road', label: 'DEBRIS PARTIALLY ON ROAD', color: 'risk-orange', icon: <Mountain className="w-5 h-5 text-risk-orange" /> },
    { id: 'cracks_visible', label: 'LARGE CRACKS IN ROAD/HILL', color: 'risk-orange', icon: <Sparkles className="w-5 h-5 text-risk-orange" /> },
    { id: 'mudflow', label: 'HEAVY MUDFLOW NEAR ROAD', color: 'risk-yellow', icon: <CloudRain className="w-5 h-5 text-risk-yellow" /> },
    { id: 'warning_leaving_area', label: 'I AM LEAVING AS PRECAUTION', color: 'risk-yellow', icon: <AlertTriangle className="w-5 h-5 text-risk-yellow" /> }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-12 animate-fade-in relative pb-24">
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase flex items-center justify-center gap-3">
          <Users className="w-8 h-8 text-accent" /> COMMUNITY HAZARD REPORTING
        </h1>
        <p className="text-sm font-bold text-white/40 uppercase tracking-[0.2em]">Collective intelligence protecting local travelers</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Submit Form */}
        <div className="space-y-6">
          <div className="glass p-8 rounded-[2.5rem] border-white/10 shadow-glow relative overflow-hidden">
            <h2 className="text-sm font-black uppercase mb-6 tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-risk-red animate-pulse" />
              SUBMIT NEW REPORT
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-accent tracking-widest">What are you seeing?</p>
                <div className="grid grid-cols-1 gap-2">
                  {reportTypes.map(t => (
                    <label 
                      key={t.id} 
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        form.type === t.id ? `bg-white/10 border-${t.color}/40 text-white shadow-lg` : 'bg-white/3 border-white/5 text-white/40 hover:bg-white/5'
                      }`}
                    >
                      <input type="radio" name="rtype" className="hidden" onClick={() => setForm(f => ({ ...f, type: t.id }))} />
                      <span className="text-lg">{t.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-tight">{t.label}</span>
                      {form.type === t.id && <span className="ml-auto text-accent">●</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-accent tracking-widest">Severity</p>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-[10px] font-black uppercase outline-none"
                    value={form.severity}
                    onChange={(e) => setForm(f => ({ ...f, severity: e.target.value }))}
                  >
                    <option value="minor">MINOR</option>
                    <option value="serious">SERIOUS</option>
                    <option value="life_threatening">LIFE THREATENING</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-accent tracking-widest">Location</p>
                  <p className="text-[10px] font-bold opacity-60 bg-white/5 p-3.5 rounded-xl border border-white/10">GPS SYNCED ✅</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-accent tracking-widest">Description (Optional)</p>
                <textarea 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-medium outline-none h-24 uppercase placeholder:opacity-20"
                  placeholder="ADD DETAILS FOR OTHER USERS..."
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-risk-red text-white py-4 rounded-2xl font-black shadow-xl shadow-red-900/20 hover:scale-[1.02] transition-all disabled:opacity-30 flex items-center justify-center gap-3"
              >
                {isSubmitting ? <span className="animate-spin text-xl"></span> : <><AlertTriangle className="w-5 h-5" /> SUBMIT REPORT</>}
              </button>
            </form>

            {success && (
              <div className="absolute inset-0 bg-nav/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-fade-in z-20">
                <div className="w-16 h-16 bg-risk-green/20 rounded-full flex items-center justify-center text-risk-green mb-4 hover:scale-110 transition-transform">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-2">REPORT RECEIVED</h3>
                <p className="text-sm font-medium opacity-70 mb-6 max-w-[200px]">{success.message}</p>
                <button onClick={() => setSuccess(null)} className="text-[10px] font-black text-accent uppercase tracking-widest">DISMISS</button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Reports Map & Feed */}
        <div className="space-y-8">
          <div className="glass rounded-[2.5rem] p-5 h-[400px] border-white/10 relative overflow-hidden">
            <h3 className="text-[10px] font-black tracking-widest text-white/30 uppercase mb-4 pl-2">ACTIVE REPORTS MAP</h3>
            <div className="h-full rounded-2xl overflow-hidden grayscale contrast-125 hover:grayscale-0 transition-all duration-700">
              <MapContainer center={[25.27, 91.73]} zoom={8} className="h-full w-full" zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <MapPicker />
                {reports.map(r => (
                  <Marker key={r.report_id} position={[r.lat, r.lon]} icon={L.divIcon({ className: `w-3 h-3 rounded-full ${r.verified ? 'bg-risk-red animate-pulse' : 'bg-risk-yellow'} border border-white shadow-xl` })}>
                    <Popup className="glass-popup"><p className="text-[10px] font-black uppercase text-accent">{r.description}</p></Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black tracking-widest text-white/30 uppercase pl-2 flex items-center gap-2">
              <MapPin className="w-3 h-3 text-accent" /> RECENT ACTIVITY FEED
            </h3>
            <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[600px] pr-2">
              {reports.map((r, i) => {
                const isNews = r.description?.includes('📰');
                
                if (isNews) {
                  const sourceStr = r.description.match(/\((.*?)\)/)?.[1] || 'News Source';
                  const titleStr = r.description.split('): ')?.[1] || r.description;
                  return (
                    <div key={r.report_id || i} className="glass p-5 rounded-2xl border border-[#00C2FF]/30 backdrop-blur-xl group relative overflow-hidden">
                      <div className="absolute inset-0 bg-[#00C2FF]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 relative z-10">
                        <div className="flex items-center gap-2 group cursor-help">
                          <span className="text-lg">📰</span>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#00C2FF]">AUTO-DETECTED FROM NEWS</h4>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-10 left-0 bg-black/90 text-white text-[9px] p-2 rounded-lg border border-white/10 w-48 shadow-2xl z-20 normal-case">
                            LITHOS automatically monitors news sources for hazard events and converts them to community reports using AI.
                          </span>
                        </div>
                        <p className="text-[9px] font-bold text-white/40 uppercase">{new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>

                      {/* Content */}
                      <div className="space-y-4 relative z-10">
                        <div>
                          <p className="text-[10px] font-bold text-white/60 uppercase mb-1">{sourceStr}</p>
                          <p className="text-sm font-black leading-tight">"{titleStr}"</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 bg-white/5 rounded-xl p-3 border border-white/5">
                          <div>
                            <p className="text-[8px] font-black text-white/40 uppercase mb-0.5 tracking-widest flex items-center gap-1"><MapPin className="w-2 h-2"/> Location</p>
                            <p className="text-[10px] font-bold">{r.lat}, {r.lon}</p>
                            <p className="text-[9px] text-[#00C2FF] font-medium">{r.region_name}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-white/40 uppercase mb-0.5 tracking-widest flex items-center gap-1"><AlertTriangle className="w-2 h-2"/> Severity</p>
                            <p className={`text-[10px] font-black uppercase ${r.severity === 'life_threatening' ? 'text-risk-red' : 'text-risk-orange'}`}>
                              {r.severity.replace('_', ' ')}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">LITHOS Response</p>
                          <p className="text-[10px] font-medium text-white/80 flex gap-2"><span className="text-[#00C2FF]">→</span> Report created automatically</p>
                          <p className="text-[10px] font-medium text-white/80 flex gap-2"><span className="text-[#00C2FF]">→</span> {r.users_alerted || 47} users in region alerted</p>
                          <p className="text-[10px] font-medium text-white/80 flex gap-2"><span className="text-[#00C2FF]">→</span> Cell #{r.cell_id || r.region} flagged {r.lithos_level}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-5 relative z-10 border-t border-white/5 pt-4">
                        {r.link && (
                          <a href={r.link} target="_blank" rel="noreferrer" className="flex-1 text-center bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-[9px] font-black uppercase transition-all tracking-wider">
                            Source Article ↗
                          </a>
                        )}
                        <button className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 rounded-xl text-[9px] font-black uppercase transition-all tracking-wider border border-white/10">
                          View Map
                        </button>
                      </div>
                    </div>
                  );
                }

                // Standard Community Report
                return (
                  <div key={r.report_id || i} className="glass p-5 rounded-2xl border-white/5 hover:border-white/20 transition-all flex gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0 uppercase border border-white/10">
                      {r.type.includes('landslide') ? <ShieldAlert className="w-6 h-6 text-risk-red" /> : r.type.includes('road') ? <ShieldOff className="w-6 h-6 text-risk-red" /> : <AlertTriangle className="w-6 h-6 text-risk-yellow" />}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-xs font-black uppercase truncate">{r.description}</h4>
                        <RiskBadge level={r.verified ? 'RED' : 'YELLOW'} className="scale-75 origin-right shrink-0" />
                      </div>
                      <p className="text-[10px] font-bold text-white/40 uppercase mb-3 truncate">NEAR {r.region_name} • {r.confirm_count} CONFIRMATIONS</p>
                      <div className="flex gap-2">
                        {!r.verified && <button className="text-[8px] font-black text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-lg uppercase transition-all hover:bg-accent/20">CONFIRM</button>}
                        <button className="text-[8px] font-black text-white/40 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg uppercase transition-all hover:bg-white/5">Report Clear</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
