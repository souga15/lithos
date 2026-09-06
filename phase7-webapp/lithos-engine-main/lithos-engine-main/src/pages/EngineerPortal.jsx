import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { HardHat, FileText, Download, Target, Activity, Search, Map as MapIcon } from 'lucide-react';

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Subcomponents
import EngineerAuth from '../components/Engineer/EngineerAuth';
import SlopeCrossSection from '../components/Engineer/SlopeCrossSection';
import { 
  PostDisasterPanel, 
  CostBenefitPanel, 
  EarthquakeScenarioPanel, 
  RoadCutCalculator 
} from '../components/Engineer/AnalysisPanels';
import HardwareHub from '../components/Engineer/HardwareHub';

// 3D terrain — lazily loaded
const CesiumTerrain3DLazy = React.lazy(() =>
  import('../components/CesiumTerrain3D').catch(() => ({
    default: () => (
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',background:'#050d1e' }}>
        <p style={{ color:'#FF9500',fontSize:13,fontWeight:900,fontFamily:'monospace' }}>⚠ 3D TERRAIN UNAVAILABLE</p>
      </div>
    )
  }))
);


const EngineerPortal = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [riskGrid, setRiskGrid] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [overlayMode, setOverlayMode] = useState('fos_seismic'); // fos_seismic, stability_class, soil_type, drainage
  const [assessmentMode, setAssessmentMode] = useState(false);
  const [activePortalTab, setActivePortalTab] = useState('analysis'); // analysis, hardware
  const [sensorAlerts, setSensorAlerts] = useState([]);

  // New features: Map style and Search
  const [mapStyle, setMapStyle] = useState('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);


  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    const coordMatch = searchQuery.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (coordMatch) {
      setSearchResult({ lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]), name: 'Custom Coordinates' });
      setIsSearching(false);
      return;
    }

    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      if (res.data && res.data.length > 0) {
        setSearchResult({
          lat: parseFloat(res.data[0].lat),
          lon: parseFloat(res.data[0].lon),
          name: res.data[0].display_name.split(',')[0]
        });
      } else {
        alert("Location not found");
      }
    } catch (err) {
      console.error(err);
      alert("Error searching location");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    // Listen for WebSocket sensor alerts
    const ws = new WebSocket(`${API_BASE_URL.replace('http', 'ws')}/ws/alerts`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'sensor_alert') {
        setSensorAlerts(prev => [...prev, { ...data, id: Date.now() }]);
        // Auto-clear after 30 seconds
        setTimeout(() => {
          setSensorAlerts(prev => prev.filter(a => a.timestamp !== data.timestamp));
        }, 30000);
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    fetchRegions();
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      fetchRiskGrid(selectedRegion.key);
      setSelectedCell(null);
    }
  }, [selectedRegion]);

  const fetchRegions = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/regions`);
      setRegions(resp.data.regions);
      setSelectedRegion(resp.data.regions[0]);
    } catch (err) { console.error(err); }
  };

  const fetchRiskGrid = async (key) => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/risk-grid?region=${key}`);
      setRiskGrid(resp.data);
    } catch (err) { console.error(err); }
  };

  const openPrintPage = (title, htmlBody) => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=Roboto+Mono:wght@400;600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Inter',sans-serif;font-size:11pt;color:#1a1a2e;background:#fff;padding:12mm 14mm;}
  @page{size:A4;margin:12mm 14mm;}
  @media print{body{padding:0;} .no-print{display:none!important;}}
  .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:3px solid #0056b3;margin-bottom:14px;}
  .header-left h1{font-size:15pt;font-weight:900;color:#0056b3;letter-spacing:.5px;}
  .header-left p{font-size:8pt;color:#555;margin-top:2px;text-transform:uppercase;letter-spacing:.8px;}
  .header-right{text-align:right;font-size:8pt;color:#555;line-height:1.6;}
  .badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:8pt;font-weight:700;letter-spacing:.5px;}
  .badge-red{background:#fee2e2;color:#dc2626;}
  .badge-orange{background:#ffedd5;color:#ea580c;}
  .badge-green{background:#dcfce7;color:#16a34a;}
  .badge-blue{background:#dbeafe;color:#1d4ed8;}
  .section{margin-bottom:14px;page-break-inside:avoid;}
  .section-title{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#0056b3;background:#f0f4ff;padding:5px 8px;border-left:4px solid #0056b3;margin-bottom:6px;}
  table{width:100%;border-collapse:collapse;font-size:9.5pt;}
  th{background:#0056b3;color:#fff;text-align:left;padding:5px 8px;font-weight:700;font-size:8pt;text-transform:uppercase;letter-spacing:.5px;}
  td{padding:5px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;}
  td:first-child{font-weight:600;color:#374151;width:45%;background:#f9fafb;}
  tr:last-child td{border-bottom:none;}
  .checklist-item{display:flex;align-items:flex-start;gap:8px;margin-bottom:5px;font-size:9.5pt;}
  .checkbox{width:13px;height:13px;border:1.5px solid #9ca3af;border-radius:2px;flex-shrink:0;margin-top:1px;}
  .ref-note{font-size:8.5pt;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;padding:4px 8px;margin-bottom:6px;}
  .fos-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;}
  .fos-box{border:1px solid #e5e7eb;border-radius:6px;padding:10px;text-align:center;}
  .fos-box .label{font-size:8pt;text-transform:uppercase;color:#6b7280;font-weight:600;margin-bottom:4px;}
  .fos-box .value{font-size:22pt;font-family:'Roboto Mono',monospace;font-weight:700;}
  .tl-bar{display:flex;gap:8px;margin-top:6px;}
  .tl-item{flex:1;padding:7px;border-radius:5px;text-align:center;font-size:8.5pt;}
  .tl-1{background:#dcfce7;border:1px solid #86efac;}
  .tl-2{background:#ffedd5;border:1px solid #fdba74;}
  .tl-3{background:#fee2e2;border:1px solid #fca5a5;}
  .tl-item .mm{font-size:13pt;font-weight:700;}
  .sign-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px;}
  .sign-field{border-bottom:1.5px solid #374151;padding-bottom:2px;margin-bottom:10px;font-size:9.5pt;}
  .sign-label{font-size:7.5pt;text-transform:uppercase;color:#6b7280;font-weight:600;margin-bottom:18px;}
  .footer{margin-top:16px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;font-size:7.5pt;color:#9ca3af;}
  .print-btn{position:fixed;top:16px;right:16px;background:#0056b3;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:700;font-size:11pt;box-shadow:0 2px 8px rgba(0,0,0,.2);}
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save PDF</button>
${htmlBody}
</body></html>`);
    win.document.close();
  };

  const downloadGeoReport = () => {
    if (!selectedCell) return;
    const c = selectedCell;
    const now = new Date();
    const ts = now.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const region = selectedRegion ? selectedRegion.name : (c.region || 'Unknown');
    const fosStatic = (c.fos_static || 0).toFixed(2);
    const fosSeismic = (c.fos_seismic || 0).toFixed(2);
    const fosStatus = c.fos_seismic >= 2.0 ? 'STABLE' : c.fos_seismic >= 1.5 ? 'CONDITIONALLY STABLE' : c.fos_seismic >= 1.0 ? 'MARGINALLY STABLE' : 'UNSTABLE';
    const fosColor = c.fos_seismic >= 2.0 ? '#16a34a' : c.fos_seismic >= 1.5 ? '#ca8a04' : c.fos_seismic >= 1.0 ? '#ea580c' : '#dc2626';
    const riskBadge = c.risk_level === 'RED' ? 'badge-red' : c.risk_level === 'ORANGE' ? 'badge-orange' : 'badge-green';
    const treatment = c.slope_mean > 45 ? 'RC Retaining Wall' : c.slope_mean > 30 ? 'Gabion Wall + Weep Holes' : 'Vegetation + Toe Drain';
    const costLakhs = c.slope_mean > 45 ? '32.0' : c.slope_mean > 30 ? '9.0' : '0.5';
    const html = `
<div class="header">
  <div class="header-left">
    <h1>⛰️ LITHOS Geotechnical Report</h1>
    <p>Landslide Intelligence · Temporal & Hyperlocal Observation System</p>
  </div>
  <div class="header-right">
    <div><strong>Cell ID:</strong> ${c.cell_id}</div>
    <div><strong>Region:</strong> ${region}</div>
    <div><strong>NHAI Code:</strong> ${c.nhai_code || 'N/A'}</div>
    <div><strong>Generated:</strong> ${ts}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">1 · Site Identification</div>
  <table>
    <tr><td>Risk Level</td><td><span class="badge ${riskBadge}">${c.risk_level || 'N/A'}</span></td></tr>
    <tr><td>Risk Score</td><td>${(c.risk_score || 0).toFixed(3)}</td></tr>
    <tr><td>Centre Coordinates</td><td>${(c.center_lat || 0).toFixed(5)}°N, ${(c.center_lon || 0).toFixed(5)}°E</td></tr>
    <tr><td>Region</td><td>${region}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">2 · Geotechnical Parameters</div>
  <table>
    <tr><td>Soil Type</td><td>${(c.soil_type || 'Unknown').replace(/_/g,' ')}</td></tr>
    <tr><td>Slope (mean)</td><td>${c.slope_mean || 0}°</td></tr>
    <tr><td>Cohesion (c)</td><td>${c.cohesion_kpa || 0} kPa</td></tr>
    <tr><td>Friction Angle (φ)</td><td>${c.friction_angle_deg || 0}°</td></tr>
    <tr><td>Soil Depth (z)</td><td>${c.soil_depth_m || 0} m</td></tr>
    <tr><td>Permeability</td><td>${c.permeability || 'Unknown'}</td></tr>
    <tr><td>Consolidation State</td><td>${(c.consolidation_state || 'Unknown').replace(/_/g,' ')}</td></tr>
    <tr><td>Plasticity Index</td><td>${c.plasticity_index || 0}</td></tr>
    <tr><td>Swell Potential</td><td>${c.swell_potential || 'Unknown'}</td></tr>
    <tr><td>Liquefaction Risk</td><td>${c.liquefaction_risk ? '<span class="badge badge-red">YES</span>' : 'No'}</td></tr>
    <tr><td>Drainage Density</td><td>${(c.drainage_density || 0).toFixed(2)} km/km²</td></tr>
    <tr><td>Soil Moisture</td><td>${((c.soil_moisture || 0) * 100).toFixed(1)}%</td></tr>
    <tr><td>Saturation Ratio</td><td>${((c.saturation_ratio || 0) * 100).toFixed(1)}%</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">3 · Factor of Safety Analysis (IS 14458)</div>
  <div class="fos-grid">
    <div class="fos-box">
      <div class="label">Static Load</div>
      <div class="value" style="color:#1d4ed8">${fosStatic}</div>
      <div style="font-size:8pt;color:#6b7280;margin-top:4px;">FoS — Static</div>
    </div>
    <div class="fos-box">
      <div class="label">Seismic (Zone V)</div>
      <div class="value" style="color:${fosColor}">${fosSeismic}</div>
      <div style="font-size:8pt;color:#6b7280;margin-top:4px;">${fosStatus}</div>
    </div>
  </div>
  <table style="margin-top:8px;">
    <tr><td>Stability Classification</td><td><strong>${c.stability_class || 'Unknown'}</strong></td></tr>
    <tr><td>NHAI Code</td><td>${c.nhai_code || 'N/A'}</td></tr>
  </table>
  <table style="margin-top:6px;">
    <thead><tr><th>Class</th><th>FoS Range</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>Class I</td><td>&gt; 2.0</td><td><span class="badge badge-green">Stable</span></td></tr>
      <tr><td>Class II</td><td>1.5 – 2.0</td><td><span class="badge badge-blue">Monitor</span></td></tr>
      <tr><td>Class III</td><td>1.0 – 1.5</td><td><span class="badge badge-orange">Remediation Required</span></td></tr>
      <tr><td>Class IV</td><td>&lt; 1.0</td><td><span class="badge badge-red">Urgent Treatment</span></td></tr>
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">4 · Rainfall Trigger Levels</div>
  <div class="tl-bar">
    <div class="tl-item tl-1"><div class="mm">${((c.rain_thresh_72h || 0) * 0.6).toFixed(0)} mm</div><div>TL1 — Vigilance</div><div style="font-size:7.5pt">Jr Engineer logs</div></div>
    <div class="tl-item tl-2"><div class="mm">${((c.rain_thresh_72h || 0) * 0.8).toFixed(0)} mm</div><div>TL2 — Warning</div><div style="font-size:7.5pt">Prepare closure</div></div>
    <div class="tl-item tl-3"><div class="mm">${((c.rain_thresh_72h || 0) * 1.0).toFixed(0)} mm</div><div>TL3 — Critical</div><div style="font-size:7.5pt">Close road NOW</div></div>
  </div>
  <table style="margin-top:8px;">
    <tr><td>72-hr Threshold</td><td>${c.rain_thresh_72h || 0} mm</td></tr>
    <tr><td>Current 72-hr Rainfall</td><td>${(c.rainfall_72h || 0).toFixed(1)} mm</td></tr>
    <tr><td>24-hr Rainfall</td><td>${(c.rainfall_24h || 0).toFixed(1)} mm</td></tr>
    <tr><td>Top Risk Factor</td><td>${(c.top_risk_factor || 'N/A').replace(/_/g,' ')}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">5 · Treatment Recommendation</div>
  <table>
    <tr><td>Recommended Treatment</td><td><strong>${treatment}</strong></td></tr>
    <tr><td>Estimated Cost per 100m</td><td>₹${costLakhs} Lakhs</td></tr>
    <tr><td>IS 14458 Compliance</td><td><span class="badge badge-green">Compliant</span></td></tr>
    <tr><td>Road Class</td><td>${c.road_class || 'NH (assumed)'}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">6 · SAR / Deformation Data</div>
  <table>
    <tr><td>SAR Coherence</td><td>${(c.sar_coherence || 0).toFixed(3)}</td></tr>
    <tr><td>InSAR Deformation Proxy</td><td>${(c.deformation_proxy || 0).toFixed(3)} m</td></tr>
    <tr><td>NDVI</td><td>${(c.ndvi || 0).toFixed(3)}</td></tr>
    <tr><td>NDWI</td><td>${(c.ndwi || 0).toFixed(3)}</td></tr>
  </table>
</div>

<div class="footer">
  <span>LITHOS · Engineer Portal v7.0 · MoRTH Slope Monitoring Initiative</span>
  <span>Ref: ${c.cell_id} · ${now.toISOString().slice(0,10)}</span>
</div>`;
    openPrintPage(`LITHOS GeoReport — ${c.cell_id}`, html);
  };

  const downloadSiteChecklist = () => {
    if (!selectedCell) return;
    const c = selectedCell;
    const now = new Date();
    const ts = now.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
    const region = selectedRegion ? selectedRegion.name : (c.region || 'Unknown');
    const riskBadge = c.risk_level === 'RED' ? 'badge-red' : c.risk_level === 'ORANGE' ? 'badge-orange' : 'badge-green';
    const checkItem = (text) => `<div class="checklist-item"><div class="checkbox"></div><span>${text}</span></div>`;
    const html = `
<div class="header">
  <div class="header-left">
    <h1>📋 LITHOS Field Site Inspection Checklist</h1>
    <p>Geotechnical Field Inspection · NHAI IS 14458 Protocol</p>
  </div>
  <div class="header-right">
    <div><strong>Cell ID:</strong> ${c.cell_id}</div>
    <div><strong>Region:</strong> ${region}</div>
    <div><strong>Date:</strong> ${ts}</div>
  </div>
</div>

<div class="ref-note">
  ⚠️&nbsp; Risk: <span class="badge ${riskBadge}">${c.risk_level || 'N/A'}</span> &nbsp;|&nbsp;
  FoS Seismic: <strong>${(c.fos_seismic || 0).toFixed(2)}</strong> &nbsp;|&nbsp;
  Stability: <strong>${c.stability_class || 'N/A'}</strong> &nbsp;|&nbsp;
  Slope: <strong>${c.slope_mean || 0}°</strong> &nbsp;|&nbsp;
  Soil: <strong>${(c.soil_type || '').replace(/_/g,' ')}</strong> &nbsp;|&nbsp;
  NHAI: <strong>${c.nhai_code || 'N/A'}</strong>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
  <div><div class="sign-label">Engineer Name</div><div class="sign-field">&nbsp;</div></div>
  <div><div class="sign-label">Designation</div><div class="sign-field">&nbsp;</div></div>
</div>

<div class="section">
  <div class="section-title">A · Pre-Visit Preparation</div>
  ${checkItem('Review LITHOS risk map before departure')}
  ${checkItem(`Collect latest 72-hr rainfall data — threshold: <strong>${c.rain_thresh_72h || '—'} mm</strong>`)}
  ${checkItem('Check weather forecast for next 24 hours')}
  ${checkItem('Inform project office of visit schedule')}
  ${checkItem('Carry PPE: helmet, reflective vest, safety boots')}
  ${checkItem('Carry equipment: clinometer, measuring tape, camera')}
  ${checkItem('Download offline maps for this region')}
</div>

<div class="section">
  <div class="section-title">B · Slope Geometry Verification</div>
  <div class="ref-note">LITHOS Reference Slope: <strong>${c.slope_mean || 0}°</strong></div>
  ${checkItem('Slope angle at <strong>crest</strong>: ______°')}
  ${checkItem('Slope angle at <strong>mid-slope</strong>: ______°')}
  ${checkItem('Slope angle at <strong>toe</strong>: ______°')}
  ${checkItem('Estimated slope height: ______ m')}
  ${checkItem('Slope aspect/direction: ______°')}
  ${checkItem('Slope length: ______ m')}
  ${checkItem('Note any scarps or slope breaks: ________________________________')}
</div>

<div class="section">
  <div class="section-title">C · Soil & Geology Inspection</div>
  <div class="ref-note">LITHOS Soil: <strong>${(c.soil_type || '').replace(/_/g,' ')}</strong> · Depth: <strong>${c.soil_depth_m || 0} m</strong> · Liquefaction Flag: <strong>${c.liquefaction_risk ? 'YES ⚠️' : 'No'}</strong></div>
  ${checkItem('Confirm soil type at surface: _______________________________')}
  ${checkItem('Visible weathering grade: &nbsp;[ ] Fresh &nbsp;[ ] Slightly &nbsp;[ ] Moderately &nbsp;[ ] Highly')}
  ${checkItem('Rock outcrops present: &nbsp;[ ] Yes &nbsp;[ ] No')}
  ${checkItem('Evidence of old landslides: &nbsp;[ ] Yes &nbsp;[ ] No &nbsp;— Notes: ___________________')}
  ${checkItem('Tension cracks observed: &nbsp;[ ] Yes &nbsp;[ ] No &nbsp;— Width: ______ mm')}
  ${checkItem('Seepage / springs visible: &nbsp;[ ] Yes &nbsp;[ ] No &nbsp;— Location: _______________')}
  ${checkItem('Tree root exposure (erosion): &nbsp;[ ] Yes &nbsp;[ ] No')}
  ${checkItem('Liquefaction indicators: &nbsp;[ ] Yes &nbsp;[ ] No')}
</div>

<div class="section">
  <div class="section-title">D · Drainage Assessment</div>
  <div class="ref-note">Drainage Density: <strong>${(c.drainage_density || 0).toFixed(2)} km/km²</strong></div>
  ${checkItem('Existing drains functional: &nbsp;[ ] Yes &nbsp;[ ] Partially &nbsp;[ ] No')}
  ${checkItem('Drain blockages: &nbsp;[ ] Yes &nbsp;[ ] No &nbsp;— Location: _________________')}
  ${checkItem('Surface runoff channels clear: &nbsp;[ ] Yes &nbsp;[ ] No')}
  ${checkItem('Weep holes in retaining wall clear: &nbsp;[ ] Yes &nbsp;[ ] No &nbsp;[ ] N/A')}
  ${checkItem('Ponding / waterlogging: &nbsp;[ ] Yes &nbsp;[ ] No')}
  ${checkItem('Distance to nearest drainage: ______ m')}
</div>

<div class="section">
  <div class="section-title">E · Existing Structure Condition</div>
  ${checkItem('Retaining wall present: &nbsp;[ ] Yes &nbsp;[ ] No &nbsp;— Type: ______________ &nbsp;Condition: [ ] Good &nbsp;[ ] Fair &nbsp;[ ] Poor')}
  ${checkItem('Road edge condition: &nbsp;[ ] Stable &nbsp;[ ] Minor distress &nbsp;[ ] Severe cracking')}
  ${checkItem('Culverts clear: &nbsp;[ ] Yes &nbsp;[ ] No &nbsp;[ ] N/A')}
  ${checkItem('Slope protection (shotcrete/bio): &nbsp;[ ] Present &nbsp;[ ] Damaged &nbsp;[ ] Absent')}
  ${checkItem('Safety signage and barriers adequate: &nbsp;[ ] Yes &nbsp;[ ] No')}
</div>

<div class="section">
  <div class="section-title">F · Trigger Level Field Assessment</div>
  <div class="tl-bar">
    <div class="tl-item tl-1"><div class="mm">${((c.rain_thresh_72h || 0) * 0.6).toFixed(0)} mm</div><div>TL1 · Vigilance</div></div>
    <div class="tl-item tl-2"><div class="mm">${((c.rain_thresh_72h || 0) * 0.8).toFixed(0)} mm</div><div>TL2 · Warning</div></div>
    <div class="tl-item tl-3"><div class="mm">${((c.rain_thresh_72h || 0) * 1.0).toFixed(0)} mm</div><div>TL3 · Critical</div></div>
  </div>
  <div style="margin-top:8px;">
  ${checkItem('Current TL status: &nbsp;[ ] Normal &nbsp;[ ] TL1 Vigilance &nbsp;[ ] TL2 Warning &nbsp;[ ] TL3 Critical')}
  ${checkItem(`Rainfall (last 72h) at site: ______ mm &nbsp;(LITHOS: ${(c.rainfall_72h || 0).toFixed(0)} mm)`)}
  ${checkItem('If TL2 — road closure equipment staged: &nbsp;[ ] Yes &nbsp;[ ] No')}
  ${checkItem('If TL3 — road closed and barricaded: &nbsp;[ ] Yes &nbsp;[ ] No')}
  ${checkItem('Emergency contacts notified: &nbsp;[ ] Yes &nbsp;[ ] No')}
  </div>
</div>

<div class="section">
  <div class="section-title">G · Recommended Actions</div>
  <div class="ref-note">LITHOS Recommendation: <strong>${c.slope_mean > 45 ? 'RC Retaining Wall' : c.slope_mean > 30 ? 'Gabion Wall + Weep Holes' : 'Vegetation + Toe Drain'}</strong></div>
  ${checkItem('Issue maintenance work order')}
  ${checkItem('Engage contractor for: ___________________________________________')}
  ${checkItem('Estimated start date: ___________________________________________')}
  ${checkItem('Re-inspection scheduled for: ____________________________________')}
</div>

<div class="section">
  <div class="section-title">H · Sign-Off</div>
  <div class="sign-row">
    <div>
      <div class="sign-label">Engineer Signature</div><div class="sign-field">&nbsp;</div>
      <div class="sign-label">Designation</div><div class="sign-field">&nbsp;</div>
    </div>
    <div>
      <div class="sign-label">Division Office</div><div class="sign-field">&nbsp;</div>
      <div class="sign-label">Next Inspection Date</div><div class="sign-field">&nbsp;</div>
    </div>
  </div>
</div>

<div class="footer">
  <span>LITHOS · Engineer Portal v7.0 · MoRTH Slope Monitoring Initiative</span>
  <span>Checklist Ref: ${c.cell_id} · ${now.toISOString().slice(0,10)}</span>
</div>`;
    openPrintPage(`LITHOS Site Checklist — ${c.cell_id}`, html);
  };



  const getOverlayStyle = useCallback((feature) => {
    const props = feature.properties;
    let color = '#333';
    let opacity = 0.25;

    if (overlayMode === 'stability_class') {
      const cls = props.stability_class;
      color = cls === 'Class I' ? '#30D158' : cls === 'Class II' ? '#FFD60A' : cls === 'Class III' ? '#FF9500' : '#FF3B30';
    } else if (overlayMode === 'fos_seismic') {
      const fos = props.fos_seismic;
      color = fos >= 2.0 ? '#30D158' : fos >= 1.5 ? '#FFD60A' : fos >= 1.0 ? '#FF9500' : '#FF3B30';
    } else if (overlayMode === 'soil_type') {
      const type = (props.soil_type || '').toLowerCase();
      if (type.includes('laterite')) color = '#FF4500'; 
      else if (type.includes('alluvial') || type.includes('loam')) color = '#DAA520'; 
      else if (type.includes('granite') || type.includes('gneiss') || type.includes('charnockite')) color = '#808080'; 
      else if (type.includes('colluvium') || type.includes('moraine')) color = '#8B4513'; 
      else if (type.includes('sandstone') || type.includes('flysch')) color = '#CD853F'; 
      else if (type.includes('phyllite') || type.includes('schist')) color = '#8A2BE2'; 
      else color = '#A9A9A9'; 
      opacity = 0.3; 
    } else if (overlayMode === 'drainage') {
      const d = props.drainage_density;
      color = d > 4 ? '#0000FF' : d > 2 ? '#00BFFF' : '#87CEEB';
      opacity = 0.2;
    }

    if (selectedCell && selectedCell.cell_id === props.cell_id) {
      return { fillColor: '#00C2FF', fillOpacity: 0.5, weight: 2, color: '#FFF' };
    }

    return { fillColor: color, fillOpacity: opacity, weight: 1, color: 'rgba(255,255,255,0.1)' };
  }, [overlayMode, selectedCell]);

  const onEachFeature = useCallback((feature, layer) => {
    layer.on({
      click: () => {
        let props = { ...feature.properties };
        if (!props.soil_type) {
          props = {
            ...props,
            soil_type: 'data_syncing',
            liquefaction_risk: false,
            cohesion_kpa: 0,
            friction_angle_deg: 0,
            soil_depth_m: 0,
            permeability: 'unknown',
            plasticity_index: 0,
            consolidation_state: 'normally_consolidated',
            swell_potential: 'unknown',
            fos_static: 0.0,
            fos_seismic: 0.0,
            fos_note: null,
            stability_class: 'Class IV',
            nhai_code: 'S4',
            rain_thresh_72h: 120,
            saturation_ratio: 0.0,
          };
        }
        setSelectedCell(props);
      }
    });
  }, []);

  const MapUpdater = () => {
    const map = useMap();
    useEffect(() => {
      if (searchResult) {
        map.flyTo([searchResult.lat, searchResult.lon], 14, { animate: true, duration: 1.5 });
      } else if (selectedRegion && selectedRegion.center) {
        map.setView(selectedRegion.center, 11);
      }
    }, [map, searchResult]); // intentionally omitted selectedRegion from dep array to avoid constant zooming
    return null;
  };

  if (!isAuthenticated) {
    return <EngineerAuth onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col md:flex-row bg-[#0A0E1A] animate-fade-in">
      <div className="w-full md:w-2/3 h-1/2 md:h-full relative flex flex-col">
        <div className="absolute top-4 left-4 z-[1000] glass p-2 rounded-xl flex flex-col gap-2 max-w-[calc(100vw-32px)] md:max-w-md">
          <select
            value={selectedRegion?.key || ''}
            onChange={(e) => setSelectedRegion(regions.find(r => r.key === e.target.value))}
            className="bg-black/50 text-white text-xs p-2 rounded-md outline-none border border-white/20"
          >
            {regions.map(r => <option className="bg-[#0A0E1A] text-white" key={r.key} value={r.key}>{r.name}</option>)}
          </select>

          <div className="flex gap-1 mt-2 bg-black/50 p-1 rounded-md flex-wrap w-fit">
            <button onClick={() => setMapStyle('dark')}     className={`px-2 py-1 text-[10px] uppercase font-bold rounded transition-colors ${mapStyle==='dark'      ?'bg-[#00C2FF] text-black':'text-white/60 hover:text-white hover:bg-white/10'}`}>Dark</button>
            <button onClick={() => setMapStyle('satellite')} className={`px-2 py-1 text-[10px] uppercase font-bold rounded transition-colors ${mapStyle==='satellite' ?'bg-[#00C2FF] text-black':'text-white/60 hover:text-white hover:bg-white/10'}`}>Satellite</button>
            <button onClick={() => setMapStyle('3d')}        className={`px-2 py-1 text-[10px] uppercase font-bold rounded transition-colors ${mapStyle==='3d'        ?'bg-accent text-bg'    :'text-white/60 hover:text-white hover:bg-white/10'}`}>3D Terrain</button>
          </div>

          {/* Overlay-mode buttons — only relevant in 2D */}
          {mapStyle !== '3d' && (
            <div className="flex gap-1 bg-black/50 p-1 rounded-md flex-wrap">
              {[
                { id: 'fos_seismic', label: 'FoS (Seismic)' },
                { id: 'stability_class', label: 'Stability Class' },
                { id: 'soil_type', label: 'Geology' },
                { id: 'drainage', label: 'Drainage Density' }
              ].map(m => (
                <button key={m.id} onClick={() => setOverlayMode(m.id)}
                  className={`px-3 py-1.5 text-[10px] uppercase font-bold rounded transition-colors ${overlayMode===m.id?'bg-[#00C2FF] text-black':'text-white/60 hover:text-white hover:bg-white/10'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-grow w-full relative z-0">
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 items-end">
            <form onSubmit={handleSearch} className="flex items-center bg-black/50 glass border border-white/20 rounded-xl overflow-hidden backdrop-blur-md">
              <input
                type="text"
                placeholder="Search Location or Lat, Lng"
                className="bg-transparent text-white text-xs p-2.5 outline-none w-48 placeholder-white/40"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button disabled={isSearching} type="submit" className="p-2.5 hover:bg-white/10 transition-colors text-white/70 hover:text-white border-l border-white/20">
                {isSearching ? <span className="animate-spin text-xs">🌀</span> : <Search className="w-4 h-4" />}
              </button>
            </form>
          </div>


          {/* 3D terrain or 2D Leaflet */}
          {mapStyle === '3d' ? (
            <div className="w-full h-full">
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center bg-[#050d1e]">
                  <p className="text-accent font-black animate-pulse uppercase tracking-widest text-sm">Loading 3D Terrain…</p>
                </div>
              }>
                <CesiumTerrain3DLazy
                  riskGrid={riskGrid}
                  routeResult={null}
                  carPosition={null}
                  start={null}
                  end={null}
                  isNavigating={false}
                  nearbyHazards={[]}
                  liveUsers={[]}
                  showEvacuation={false}
                />
              </Suspense>
            </div>
          ) : (
            <MapContainer
              center={selectedRegion?.center || [25.3, 91.73]}
              zoom={11}
              className="w-full h-full"
              zoomControl={false}
            >
              {mapStyle === 'dark' ? (
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              ) : (
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              )}

              <MapUpdater />
              {searchResult && (
                <Marker position={[searchResult.lat, searchResult.lon]} icon={customIcon}>
                  <Popup className="bg-nav border border-white/10 glass rounded-lg p-1">
                    <span className="font-bold text-[#00C2FF] drop-shadow-md text-xs block">{searchResult.name}</span>
                  </Popup>
                </Marker>
              )}
              {riskGrid && (
                <GeoJSON
                  key={`${riskGrid.region}_${overlayMode}_${selectedCell?.cell_id || 'none'}`}
                  data={riskGrid}
                  style={getOverlayStyle}
                  onEachFeature={onEachFeature}
                />
              )}
              {sensorAlerts.map(alert => (
                <Circle
                  key={alert.id}
                  center={[alert.lat, alert.lon]}
                  radius={800}
                  pathOptions={{ color: '#FF3B30', fillColor: '#FF3B30', fillOpacity: 0.4, weight: 2, className: 'animate-pulse' }}
                >
                  <Popup className="glass-popup">
                    <div className="p-2 text-center">
                      <div className="text-risk-red font-black text-[10px] uppercase mb-1">⚠️ SENSOR TRIGGERED</div>
                      <div className="text-xs font-bold text-white mb-1">{alert.sensor_type.toUpperCase()} node: {alert.sensor_id}</div>
                      <div className="text-[10px] text-white/50">{alert.message}</div>
                    </div>
                  </Popup>
                </Circle>
              ))}
            </MapContainer>
          )}
        </div>
      </div>

      <div className="w-full md:w-1/3 h-1/2 md:h-full bg-surface border-l border-white/10 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <HardHat className="text-[#00C2FF] w-6 h-6" />
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase">Engineering Portal</h1>
              <p className="text-[10px] text-white/50 uppercase tracking-widest">Geotechnical Decision Support</p>
            </div>
          </div>
          <button
            onClick={() => setAssessmentMode(!assessmentMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${assessmentMode ? 'bg-risk-red text-white border-risk-red shadow-[0_0_15px_rgba(255,59,48,0.5)]' : 'bg-white/5 text-white/50 border-white/10 hover:text-white'}`}
          >
            {assessmentMode ? 'EXIT ASSESSMENT' : 'POST-DISASTER MODE'}
          </button>
        </div>

        {/* Portal Tabs */}
        <div className="flex px-5 py-2 border-b border-white/5 bg-black/10 gap-4">
          <button 
            onClick={() => setActivePortalTab('analysis')}
            className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activePortalTab === 'analysis' ? 'border-[#00C2FF] text-[#00C2FF]' : 'border-transparent text-white/40 hover:text-white'}`}
          >
            Geotechnical Analysis
          </button>
          <button 
            onClick={() => setActivePortalTab('hardware')}
            className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activePortalTab === 'hardware' ? 'border-[#00C2FF] text-[#00C2FF]' : 'border-transparent text-white/40 hover:text-white'}`}
          >
            IoT Hardware Hub
          </button>
        </div>

        <div className="p-5 space-y-6 flex-grow">
          {activePortalTab === 'analysis' ? (
            <>
              {!selectedCell ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-white/30 border border-white/5 border-dashed rounded-2xl">
              <Target className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-bold text-sm">Select a Map Cell</p>
              <p className="text-xs mt-2">Click on any region grid cell to analyze structural stability, cross-sections, and IS compliance.</p>
            </div>
          ) : (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-sm border border-white/20 px-2 py-1 rounded bg-black/40 inline-flex mb-2 font-mono text-[#00C2FF]">
                    {selectedCell.cell_id}
                  </h2>
                  <div className="text-2xl font-black capitalize flex items-center gap-2">
                    {selectedCell.soil_type.replace('_', ' ')}
                    {selectedCell.liquefaction_risk && <span className="bg-risk-red text-[10px] px-2 py-1 rounded-sm uppercase tracking-widest font-black text-white">Liq. Risk</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/50 uppercase font-black">Slope</div>
                  <div className="text-xl font-bold">{selectedCell.slope_mean}°</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="glass p-2 rounded-xl border-white/5 flex flex-col justify-center">
                  <div className="text-[9px] text-white/40 uppercase font-black leading-tight mb-1">Cohesion (c)</div>
                  <div className="text-sm font-bold">{selectedCell.cohesion_kpa} <span className="text-[10px] text-white/50">kPa</span></div>
                </div>
                <div className="glass p-2 rounded-xl border-white/5 flex flex-col justify-center">
                  <div className="text-[9px] text-white/40 uppercase font-black leading-tight mb-1">Friction (φ)</div>
                  <div className="text-sm font-bold">{selectedCell.friction_angle_deg}°</div>
                </div>
                <div className="glass p-2 rounded-xl border-white/5 flex flex-col justify-center">
                  <div className="text-[9px] text-white/40 uppercase font-black leading-tight mb-1">Depth (z)</div>
                  <div className="text-sm font-bold">{selectedCell.soil_depth_m} <span className="text-[10px] text-white/50">m</span></div>
                </div>
                <div className="glass p-2 rounded-xl border-white/5 flex flex-col justify-center">
                  <div className="text-[9px] text-white/40 uppercase font-black leading-tight mb-1">State</div>
                  <div className="text-[10px] font-bold leading-tight capitalize">{(selectedCell.consolidation_state || 'unknown').replace('_', ' ')}</div>
                </div>
                <div className="glass p-2 rounded-xl border-white/5 flex flex-col justify-center">
                  <div className="text-[9px] text-white/40 uppercase font-black leading-tight mb-1">Swell Pot.</div>
                  <div className="text-xs font-bold leading-tight capitalize">{selectedCell.swell_potential || 'unknown'}</div>
                </div>
              </div>

              {!assessmentMode ? (
                <div className="glass p-4 rounded-xl border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Activity className="w-24 h-24" />
                  </div>
                  <h3 className="text-xs font-black uppercase text-white/60 mb-3 flex justify-between">
                    <span>Factor of Safety (FoS)</span>
                    <span className="text-[#00C2FF]">NHAI Code {selectedCell.nhai_code}</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-white/40 uppercase">Static Load</div>
                      <div className="text-2xl font-black font-mono">{selectedCell.fos_static.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-risk-orange uppercase font-bold flex gap-1 items-center">
                        Seismic (Zone V)
                      </div>
                      <div className={`text-2xl font-black font-mono ${selectedCell.fos_seismic < 1.0 ? 'text-risk-red' : selectedCell.fos_seismic < 1.5 ? 'text-risk-orange' : 'text-risk-green'}`}>
                        {selectedCell.fos_seismic.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/60">Stability Classification:</span>
                      <span className="font-bold px-2 py-1 rounded-md" style={{
                        backgroundColor: selectedCell.stability_class === 'Class I' ? '#30D1581A' : selectedCell.stability_class === 'Class II' ? '#FFD60A1A' : selectedCell.stability_class === 'Class III' ? '#FF95001A' : '#FF3B301A',
                        color: selectedCell.stability_class === 'Class I' ? '#30D158' : selectedCell.stability_class === 'Class II' ? '#FFD60A' : selectedCell.stability_class === 'Class III' ? '#FF9500' : '#FF3B30',
                      }}>
                        {selectedCell.stability_class.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <PostDisasterPanel selectedCell={selectedCell} />
              )}

              <SlopeCrossSection selectedCell={selectedCell} />

              {/* Trigger Level System */}
              <div className="glass p-4 rounded-xl border-white/10">
                <h3 className="text-xs font-black uppercase text-white/60 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Rainfall Trigger Levels
                </h3>
                <div className="space-y-3">
                  {[
                    { level: 'TL1 - Vigilance', limit: 0.6, color: 'bg-risk-green', action: 'Increased monitoring', time: '24h', who: 'Jr Engineer', nhai: 'Log register' },
                    { level: 'TL2 - Warning', limit: 0.8, color: 'bg-risk-orange', action: 'Prepare closure', time: '4h', who: 'Div Engineer', nhai: 'Site equip.' },
                    { level: 'TL3 - Critical', limit: 1.0, color: 'bg-risk-red', action: 'Close road NOW', time: '1h', who: 'Supt Engineer', nhai: 'Barricades' }
                  ].map(tl => {
                    const threshold = selectedCell.rain_thresh_72h * tl.limit;
                    const isActive = selectedCell.saturation_ratio >= tl.limit;
                    return (
                      <div key={tl.level} className={`p-2 rounded-md flex flex-col gap-2 text-xs border ${isActive ? 'bg-white/10 border-white/20' : 'border-white/5 opacity-50'}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className={`font-bold flex items-center gap-2`}><span className={`w-2 h-2 rounded-full ${tl.color}`}></span> {tl.level}</div>
                            <div className="text-white/50 text-[10px] uppercase">{tl.action}</div>
                          </div>
                          <div className="font-mono font-bold">{threshold.toFixed(0)} mm</div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 pt-2 border-t border-white/5">
                          <div><span className="text-[9px] uppercase text-white/40 block">Response</span><span className="text-[10px]">{tl.time}</span></div>
                          <div><span className="text-[9px] uppercase text-white/40 block">Authority</span><span className="text-[10px]">{tl.who}</span></div>
                          <div><span className="text-[9px] uppercase text-white/40 block">NHAI Action</span><span className="text-[10px]">{tl.nhai}</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Retaining Wall Recommendation Engine */}
              {(selectedCell.stability_class === 'Class III' || selectedCell.stability_class === 'Class IV') && (
                <div className="glass p-4 rounded-xl border-risk-orange/30 bg-risk-orange/5">
                  <h3 className="text-xs font-black uppercase text-risk-orange mb-3">Recommendation Engine</h3>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/10">
                    <div className="text-[10px] text-white/50 uppercase mb-1">Proposed Treatment</div>
                    <div className="font-bold text-lg mb-2">
                      {selectedCell.slope_mean > 45 ? 'RC Retaining Wall' : selectedCell.slope_mean > 30 ? 'Gabion Wall + Weep Holes' : 'Vegetation + Toe Drain'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-white/50 block text-[10px] uppercase">Est. Cost (100m)</span>₹{selectedCell.slope_mean > 45 ? '32.0' : selectedCell.slope_mean > 30 ? '9.0' : '0.5'} Lakhs</div>
                      <div><span className="text-white/50 block text-[10px] uppercase">IS 14458 Status</span><span className="text-risk-green flex items-center gap-1">Compliant</span></div>
                    </div>
                  </div>
                </div>
              )}

              <RoadCutCalculator selectedCell={selectedCell} />

              {(selectedCell.stability_class === 'Class III' || selectedCell.stability_class === 'Class IV') && (
                <CostBenefitPanel selectedCell={selectedCell} />
              )}

              {/* Slope Monitoring Recommendations */}
              {selectedCell.fos_seismic < 1.5 && (
                <div className="glass p-4 rounded-xl border-risk-orange/30 bg-risk-orange/5">
                  <h3 className="text-xs font-black uppercase text-risk-orange mb-3">IoT Sensor Recommendations</h3>
                  <div className="space-y-2">
                    <div className="bg-black/30 p-2 rounded text-xs">
                      <div className="font-bold flex justify-between"><span className="text-[#00C2FF]">1. Piezometer</span> <span>₹20k</span></div>
                      <div className="text-[10px] text-white/60">Monitor pore water pressure. Drill 3-5m into slope.</div>
                    </div>
                    <div className="bg-black/30 p-2 rounded text-xs">
                      <div className="font-bold flex justify-between"><span className="text-[#00C2FF]">2. Inclinometer</span> <span>₹60k</span></div>
                      <div className="text-[10px] text-white/60">Detect subsurface movement near failure plane.</div>
                    </div>
                    <div className="text-[10px] text-risk-green uppercase font-bold text-center mt-2 border-t border-risk-orange/20 pt-2">
                      Sensors calibrate LITHOS real-time FoS via API
                    </div>
                  </div>
                </div>
              )}

              <EarthquakeScenarioPanel selectedCell={selectedCell} />

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={downloadSiteChecklist} className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> Site Checklist
                </button>
                <button onClick={downloadGeoReport} className="py-2.5 bg-[#00C2FF]/10 hover:bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Export Report
                </button>
              </div>

            </div>
          )}
            </>
          ) : (
            <HardwareHub />
          )}
        </div>
      </div>
    </div>
  );
};

export default EngineerPortal;
