import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Popup, Circle, Polyline, Polygon } from 'react-leaflet';
import { NE_STATE_BOUNDARIES, STATE_BORDER_COLORS } from '../constants/NE_STATE_BOUNDARIES';
import L from 'leaflet';
import { HardHat, FileText, Download, Target, Activity, Search, Map as MapIcon, Loader2, X, ExternalLink } from 'lucide-react';

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
import DebrisFlowPanel from '../components/Engineer/DebrisFlowPanel';
import { 
  PostDisasterPanel, 
  EarthquakeScenarioPanel, 
  RoadCutCalculator 
} from '../components/Engineer/AnalysisPanels';
import HardwareHub from '../components/Engineer/HardwareHub';

// 3D terrain — lazily loaded
const CesiumTerrain3DLazy = React.lazy(() =>
  import('../components/CesiumTerrain3D').catch(() => ({
    default: () => (
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',background:'#050d1e' }}>
        <p style={{ color:'#FF9500',fontSize:12,fontWeight:900,fontFamily:'monospace',letterSpacing:'0.05em' }}>[3D TERRAIN UNAVAILABLE]</p>
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
  const [activeRunoutData, setActiveRunoutData] = useState(null);
  const [showSensorGuide, setShowSensorGuide] = useState(false);

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
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, Georgia, serif;
    font-size: 10pt;
    line-height: 1.35;
    color: #000;
    background: #fff;
    padding: 14mm 16mm;
  }
  @page { size: A4 portrait; margin: 14mm 16mm; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
  .gov-header {
    text-align: center;
    border-bottom: 2px solid #000;
    padding-bottom: 6px;
    margin-bottom: 10px;
  }
  .gov-sup {
    font-size: 8.5pt;
    font-weight: bold;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .gov-dept {
    font-size: 8pt;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #222;
    margin-top: 2px;
  }
  .gov-title-main {
    font-size: 13pt;
    font-weight: bold;
    letter-spacing: 0.8px;
    margin: 4px 0 2px 0;
    text-transform: uppercase;
  }
  .gov-sub {
    font-size: 8pt;
    font-style: italic;
    color: #444;
  }
  .gov-meta-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
    border: 1px solid #000;
    font-size: 8.5pt;
  }
  .gov-meta-table td {
    padding: 3px 6px;
    border: 1px solid #000;
  }
  .section {
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 9pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
    margin-bottom: 4px;
  }
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-bottom: 6px;
  }
  table.data-table th, table.data-table td {
    border: 1px solid #000;
    padding: 3.5px 6px;
    vertical-align: top;
  }
  table.data-table th {
    background: #f2f2f2;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 8pt;
    text-align: left;
  }
  td.label-col {
    width: 38%;
    font-weight: bold;
    background: #fafafa;
  }
  .sign-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 14px;
    border: 1px solid #000;
    page-break-inside: avoid;
  }
  .sign-table td {
    border: 1px solid #000;
    padding: 6px;
    height: 60px;
    vertical-align: top;
    font-size: 8pt;
  }
  .checklist-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 3.5px;
    font-size: 8.5pt;
  }
  .box {
    width: 10px;
    height: 10px;
    border: 1px solid #000;
    display: inline-block;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .footer-note {
    margin-top: 10px;
    padding-top: 4px;
    border-top: 1px solid #000;
    font-size: 7pt;
    display: flex;
    justify-content: space-between;
  }
  .print-btn {
    position: fixed;
    top: 12px;
    right: 12px;
    background: #000;
    color: #fff;
    border: 1px solid #000;
    padding: 8px 16px;
    font-family: 'Times New Roman', Times, serif;
    font-size: 9.5pt;
    font-weight: bold;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">[ Print / Save Official PDF ]</button>
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
    const fosStatus = c.fos_seismic >= 2.0 ? 'CLASS I (STABLE)' : c.fos_seismic >= 1.5 ? 'CLASS II (CONDITIONALLY STABLE)' : c.fos_seismic >= 1.0 ? 'CLASS III (MARGINALLY STABLE)' : 'CLASS IV (CRITICAL / UNSTABLE)';
    const treatment = c.slope_mean > 45 ? 'Reinforced Concrete Retaining Wall' : c.slope_mean > 30 ? 'Gabion Gravity Wall with Subsurface Weep Holes' : 'Bio-Engineering & Subsurface Toe Interceptor Drain';
    const treatmentClass = c.slope_mean > 45 ? 'Heavy Structural Retaining' : c.slope_mean > 30 ? 'Gravity Mass Retaining' : 'Surface Drainage & Revegetation';

    const html = `
<div class="gov-header">
  <div class="gov-sup">GOVERNMENT OF INDIA · MINISTRY OF ROAD TRANSPORT &amp; HIGHWAYS</div>
  <div class="gov-dept">NATIONAL HIGHWAYS AUTHORITY OF INDIA — GEOTECHNICAL INVESTIGATION DIVISION</div>
  <div class="gov-title-main">TECHNICAL DOSSIER FOR HILL SLOPE STABILITY</div>
  <div class="gov-sub">Codified under Indian Standard IS 14458 (Parts 1–4) &amp; IRC:75 Guidelines for Hill Road Slopes</div>
</div>

<table class="gov-meta-table">
  <tr>
    <td style="width:25%;"><strong>Dossier Ref:</strong> MoRTH/LITHOS/SLP-${c.cell_id}</td>
    <td style="width:25%;"><strong>Region / State:</strong> ${region}</td>
    <td style="width:25%;"><strong>NHAI Highway Code:</strong> ${c.nhai_code || 'NH-CORRIDOR'}</td>
    <td style="width:25%;"><strong>Inspection Date:</strong> ${ts}</td>
  </tr>
  <tr>
    <td><strong>Coordinates:</strong> ${(c.center_lat || 0).toFixed(5)}° N, ${(c.center_lon || 0).toFixed(5)}° E</td>
    <td><strong>Risk Category:</strong> [${c.risk_level || 'N/A'}]</td>
    <td><strong>Mean Slope Angle:</strong> ${c.slope_mean || 0}°</td>
    <td><strong>Stability Classification:</strong> ${c.stability_class || 'Class III'}</td>
  </tr>
</table>

<div class="section">
  <div class="section-title">1. Site Identification &amp; Geometrical Parameters</div>
  <table class="data-table">
    <tr><td class="label-col">Slope Unit Identifier</td><td>Cell #${c.cell_id} (Administrative Zone: ${region})</td></tr>
    <tr><td class="label-col">Geographical Coordinates</td><td>${(c.center_lat || 0).toFixed(5)}° Latitude, ${(c.center_lon || 0).toFixed(5)}° Longitude</td></tr>
    <tr><td class="label-col">Mean Slope Gradient</td><td>${c.slope_mean || 0}° (Critically Steep Threshold: &gt; 35°)</td></tr>
    <tr><td class="label-col">Composite Risk Index</td><td>${(c.risk_score || 0).toFixed(3)} [Standardized Scale 0.000 – 1.000]</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">2. Geotechnical Strata &amp; Soil Mechanics Parameters</div>
  <table class="data-table">
    <tr><td class="label-col">Soil Stratum Classification</td><td>${(c.soil_type || 'Unknown').replace(/_/g,' ').toUpperCase()}</td></tr>
    <tr><td class="label-col">Effective Soil Cohesion (c')</td><td>${c.cohesion_kpa || 0} kPa</td></tr>
    <tr><td class="label-col">Angle of Internal Friction (φ')</td><td>${c.friction_angle_deg || 0}°</td></tr>
    <tr><td class="label-col">Estimated Overburden Depth (z)</td><td>${c.soil_depth_m || 0} meters</td></tr>
    <tr><td class="label-col">Soil Hydraulic Permeability</td><td>${(c.permeability || 'Moderate').toUpperCase()}</td></tr>
    <tr><td class="label-col">Consolidation State</td><td>${(c.consolidation_state || 'Normally Consolidated').replace(/_/g,' ').toUpperCase()}</td></tr>
    <tr><td class="label-col">Plasticity Index (PI)</td><td>${c.plasticity_index || 0}</td></tr>
    <tr><td class="label-col">Liquefaction Susceptibility</td><td>${c.liquefaction_risk ? '[YES — HIGH VULNERABILITY]' : 'Low'}</td></tr>
    <tr><td class="label-col">Subsurface Saturation Ratio</td><td>${((c.saturation_ratio || 0) * 100).toFixed(1)}%</td></tr>
    <tr><td class="label-col">Regional Drainage Density</td><td>${(c.drainage_density || 0).toFixed(2)} km/km²</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">3. Factor of Safety (FoS) Equilibrium Analysis — IS 14458</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:30%;">Loading Condition</th>
        <th style="width:25%;">Computed FoS</th>
        <th style="width:20%;">Mandated Min (IRC)</th>
        <th style="width:25%;">Equilibrium Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Static Gravity Load</strong></td>
        <td><strong>${fosStatic}</strong></td>
        <td>1.50</td>
        <td>${parseFloat(fosStatic) >= 1.5 ? '[SATISFACTORY]' : '[DEFICIENT]'}</td>
      </tr>
      <tr>
        <td><strong>Seismic Pseudostatic (Zone V, IS 1893)</strong></td>
        <td><strong>${fosSeismic}</strong></td>
        <td>1.00</td>
        <td>${fosStatus}</td>
      </tr>
    </tbody>
  </table>
  <table class="data-table">
    <thead><tr><th>Classification</th><th>FoS Range (Seismic)</th><th>Statutory Action (MoRTH)</th></tr></thead>
    <tbody>
      <tr><td>Class I</td><td>&gt; 2.00</td><td>Standard routine visual observation.</td></tr>
      <tr><td>Class II</td><td>1.50 – 2.00</td><td>Periodic drainage inspection; logging schedule quarterly.</td></tr>
      <tr><td>Class III</td><td>1.00 – 1.49</td><td>Structural retaining intervention required; sensor deployment recommended.</td></tr>
      <tr><td>Class IV</td><td>&lt; 1.00</td><td>Urgent remediation; traffic restriction &amp; immediate toe protection.</td></tr>
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">4. Precipitation Trigger Thresholds &amp; Operational Matrix (TARP)</div>
  <table class="data-table">
    <thead><tr><th>Trigger Level</th><th>Rainfall Accumulation (72h)</th><th>Field Operational Directive</th></tr></thead>
    <tbody>
      <tr><td><strong>Trigger Level 1 (Vigilance)</strong></td><td>${((c.rain_thresh_72h || 0) * 0.6).toFixed(0)} mm</td><td>Assistant Engineer logs surface runoff and clears catchwater drains.</td></tr>
      <tr><td><strong>Trigger Level 2 (Warning)</strong></td><td>${((c.rain_thresh_72h || 0) * 0.8).toFixed(0)} mm</td><td>Pre-stage excavators; restrict highway traffic to single-lane 20 km/h.</td></tr>
      <tr><td><strong>Trigger Level 3 (Critical Action)</strong></td><td>${((c.rain_thresh_72h || 0) * 1.0).toFixed(0)} mm</td><td>Immediate roadway closure; sound sirens; evacuate toe impact zone.</td></tr>
    </tbody>
  </table>
  <table class="data-table">
    <tr><td class="label-col">Statutory 72-Hour Threshold</td><td>${c.rain_thresh_72h || 0} mm</td></tr>
    <tr><td class="label-col">Current Recorded 72-Hour Rainfall</td><td>${(c.rainfall_72h || 0).toFixed(1)} mm</td></tr>
    <tr><td class="label-col">Primary Risk Driver</td><td>${(c.top_risk_factor || 'Steep slope gradient combined with saturation').replace(/_/g,' ').toUpperCase()}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">5. Mandated Engineering Remediation Countermeasures</div>
  <table class="data-table">
    <tr><td class="label-col">Proposed Structural Intervention</td><td><strong>${treatment}</strong></td></tr>
    <tr><td class="label-col">Engineering Classification</td><td>${treatmentClass}</td></tr>
    <tr><td class="label-col">Governing Standard</td><td>IS 14458 (Parts 1–4) &amp; MoRTH Specifications Section 3100</td></tr>
    <tr><td class="label-col">Subsurface Drainage Mandate</td><td>Perforated horizontal drains (75mm dia PVC) drilled at 5° gradient into failure plane</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">6. Satellite SAR Interferometry &amp; Deformation Indices</div>
  <table class="data-table">
    <tr><td class="label-col">Sentinel-1 SAR Coherence</td><td>${(c.sar_coherence || 0.85).toFixed(3)} [Scale 0.00 – 1.00]</td></tr>
    <tr><td class="label-col">InSAR Deformation Proxy</td><td>${(c.deformation_proxy || 0.002).toFixed(3)} m (Cumulative Displacement)</td></tr>
    <tr><td class="label-col">Vegetation Index (NDVI)</td><td>${(c.ndvi || 0.62).toFixed(3)}</td></tr>
  </table>
</div>

<table class="sign-table">
  <tr>
    <td style="width:33%;">
      <strong>Inspecting Field Engineer:</strong><br/>
      Signature: __________________________<br/>
      Name: ______________________________<br/>
      Designation: Assistant Executive Engineer (Civil)
    </td>
    <td style="width:33%;">
      <strong>Reviewing Geotechnical Authority:</strong><br/>
      Signature: __________________________<br/>
      Name: ______________________________<br/>
      Designation: Executive Engineer, NHAI Division
    </td>
    <td style="width:34%;">
      <strong>Official Division Seal:</strong><br/>
      Date: ______________________________<br/>
      Station: ___________________________
    </td>
  </tr>
</table>

<div class="footer-note">
  <span>LITHOS Geotechnical Platform · Government of India · Ministry of Road Transport &amp; Highways</span>
  <span>Document Reference: MoRTH/NER/SLP-${c.cell_id} · Generated on ${ts}</span>
</div>`;

    openPrintPage(`LITHOS Official Technical Dossier — ${c.cell_id}`, html);
  };

  const downloadSiteChecklist = () => {
    if (!selectedCell) return;
    const c = selectedCell;
    const now = new Date();
    const ts = now.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
    const region = selectedRegion ? selectedRegion.name : (c.region || 'Unknown');
    const checkItem = (text) => `<div class="checklist-item"><span class="box"></span><span>${text}</span></div>`;

    const html = `
<div class="gov-header">
  <div class="gov-sup">GOVERNMENT OF INDIA · MINISTRY OF ROAD TRANSPORT &amp; HIGHWAYS</div>
  <div class="gov-dept">NATIONAL HIGHWAYS AUTHORITY OF INDIA — GEOTECHNICAL FIELD WING</div>
  <div class="gov-title-main">FIELD SLOPE INVESTIGATION &amp; AUDIT CHECKLIST</div>
  <div class="gov-sub">Proforma for On-Site Physical Inspection under IS 14458 (Parts 1–4) &amp; IRC:SP:48</div>
</div>

<table class="gov-meta-table">
  <tr>
    <td style="width:25%;"><strong>Slope Cell ID:</strong> #${c.cell_id}</td>
    <td style="width:25%;"><strong>Jurisdiction:</strong> ${region}</td>
    <td style="width:25%;"><strong>Date of Inspection:</strong> ${ts}</td>
    <td style="width:25%;"><strong>NHAI Highway Code:</strong> ${c.nhai_code || 'NH-CORRIDOR'}</td>
  </tr>
  <tr>
    <td><strong>Coordinates:</strong> ${(c.center_lat || 0).toFixed(5)}° N, ${(c.center_lon || 0).toFixed(5)}° E</td>
    <td><strong>LITHOS Risk Category:</strong> [${c.risk_level || 'N/A'}]</td>
    <td><strong>Seismic FoS:</strong> ${(c.fos_seismic || 0).toFixed(2)}</td>
    <td><strong>Strata:</strong> ${(c.soil_type || '').replace(/_/g,' ').toUpperCase()}</td>
  </tr>
</table>

<div class="section">
  <div class="section-title">Section A: Pre-Inspection Verification</div>
  ${checkItem('Verify latest LITHOS seismic factor of safety and 72-hr rainfall threshold prior to field departure.')}
  ${checkItem(`Check 72-hr regional rainfall accumulation (LITHOS Threshold: <strong>${c.rain_thresh_72h || '—'} mm</strong>).`)}
  ${checkItem('Verify that standard PPE (high-visibility vest, safety helmet, steel-toed boots) is equipped.')}
  ${checkItem('Equip calibrated clinometer, 30m survey tape, Geological hammer, and crack displacement gauges.')}
  ${checkItem('Confirm local emergency communication channel and police dispatch contact numbers.')}
</div>

<div class="section">
  <div class="section-title">Section B: Field Slope Geometry Verification</div>
  <div style="margin-bottom:4px;font-size:8.5pt;"><em>LITHOS Reference Gradient: <strong>${c.slope_mean || 0}°</strong> · Soil Depth: <strong>${c.soil_depth_m || 0} m</strong></em></div>
  ${checkItem('Measured slope angle at <strong>crest</strong>: ________°')}
  ${checkItem('Measured slope angle at <strong>mid-slope</strong>: ________°')}
  ${checkItem('Measured slope angle at <strong>toe</strong>: ________°')}
  ${checkItem('Estimated vertical slope height (H): ________ meters')}
  ${checkItem('Slope aspect / trajectory azimuth: ________° (Bearing)')}
  ${checkItem('Presence of tension cracks along scarp: [  ] YES &nbsp; [  ] NO &nbsp;— Measured Max Width: ________ mm')}
  ${checkItem('Scarp headwall displacement / drop: ________ mm')}
</div>

<div class="section">
  <div class="section-title">Section C: Geological &amp; Soil Stratigraphy Inspection</div>
  <div style="margin-bottom:4px;font-size:8.5pt;"><em>LITHOS Soil Type: <strong>${(c.soil_type || '').replace(/_/g,' ').toUpperCase()}</strong> · Liquefaction Flag: <strong>${c.liquefaction_risk ? 'HIGH RISK' : 'None'}</strong></em></div>
  ${checkItem('Verify surface soil strata: [  ] Residual Silt/Clay &nbsp; [  ] Colluvium/Debris &nbsp; [  ] Weathered Bedrock')}
  ${checkItem('Weathering Grade: [  ] Grade I (Fresh) &nbsp; [  ] Grade II (Slight) &nbsp; [  ] Grade III (Moderate) &nbsp; [  ] Grade IV (High)')}
  ${checkItem('Bedrock bedding / joint dip direction towards road: [  ] Adverse (Daylighting) &nbsp; [  ] Favorable')}
  ${checkItem('Water seepage / spring emergence visible on slope face: [  ] YES &nbsp; [  ] NO')}
  ${checkItem('Evidence of toe scouring / erosion by river or culvert discharge: [  ] YES &nbsp; [  ] NO')}
</div>

<div class="section">
  <div class="section-title">Section D: Drainage Subsystems Audit</div>
  ${checkItem('Catchwater drain along slope crest functional and free of silt: [  ] YES &nbsp; [  ] PARTIALLY &nbsp; [  ] BLOCKED')}
  ${checkItem('Chute drains / cascade drains clear of boulder debris: [  ] YES &nbsp; [  ] NO')}
  ${checkItem('Weep holes in existing retaining walls flowing freely (no calcification): [  ] YES &nbsp; [  ] CLOGGED &nbsp; [  ] N/A')}
  ${checkItem('Ponding / localized waterlogging observed behind wall or at toe: [  ] YES &nbsp; [  ] NO')}
</div>

<div class="section">
  <div class="section-title">Section E: Trigger Action Response Level (TARP) Verification</div>
  <table class="data-table" style="margin-bottom:4px;">
    <tr><th>Trigger Level 1 (Vigilance)</th><th>Trigger Level 2 (Warning)</th><th>Trigger Level 3 (Critical Action)</th></tr>
    <tr>
      <td>${((c.rain_thresh_72h || 0) * 0.6).toFixed(0)} mm (72h)</td>
      <td>${((c.rain_thresh_72h || 0) * 0.8).toFixed(0)} mm (72h)</td>
      <td>${((c.rain_thresh_72h || 0) * 1.0).toFixed(0)} mm (72h)</td>
    </tr>
  </table>
  ${checkItem('Observed on-site trigger state: [  ] Normal Baseline &nbsp; [  ] Level 1 (Vigilance) &nbsp; [  ] Level 2 (Warning) &nbsp; [  ] Level 3 (Critical)')}
  ${checkItem('If Trigger Level 2: Heavy earthmoving equipment pre-staged within 5km radius: [  ] YES &nbsp; [  ] PENDING')}
  ${checkItem('If Trigger Level 3: Total roadway closure and physical barricades erected: [  ] YES &nbsp; [  ] PENDING')}
</div>

<div class="section">
  <div class="section-title">Section F: Structural Intervention &amp; Maintenance Directives</div>
  <div style="margin-bottom:4px;font-size:8.5pt;"><em>LITHOS Recommended Countermeasure: <strong>${c.slope_mean > 45 ? 'RC Retaining Wall' : c.slope_mean > 30 ? 'Gabion Wall with Weep Holes' : 'Bio-Engineering & Toe Drain'}</strong></em></div>
  ${checkItem('Immediate emergency maintenance work order required: [  ] YES &nbsp; [  ] NO')}
  ${checkItem('Description of immediate work: ____________________________________________________________________')}
  ${checkItem('Target completion date for interim measures: ____________________')}
  ${checkItem('Mandated follow-up geotechnical re-inspection date: ____________________')}
</div>

<table class="sign-table">
  <tr>
    <td style="width:33%;">
      <strong>Inspecting Engineer:</strong><br/>
      Signature: __________________________<br/>
      Name: ______________________________<br/>
      Designation: Assistant Executive Engineer
    </td>
    <td style="width:33%;">
      <strong>Field Division:</strong><br/>
      Division Office: ____________________<br/>
      Sub-Division: ______________________<br/>
      Station Seal:
    </td>
    <td style="width:34%;">
      <strong>Countersigned (Executive Engineer):</strong><br/>
      Signature: __________________________<br/>
      Name: ______________________________<br/>
      Date: ______________________________
    </td>
  </tr>
</table>

<div class="footer-note">
  <span>LITHOS Geotechnical Framework · Ministry of Road Transport &amp; Highways · Government of India</span>
  <span>Checklist Ref: MoRTH/INSP/SLP-${c.cell_id} · Generated ${ts}</span>
</div>`;

    openPrintPage(`LITHOS Field Inspection Checklist — ${c.cell_id}`, html);
  };



  const getOverlayStyle = useCallback((feature) => {
    const props = feature.properties || {};
    let color = '#3B82F6';
    let opacity = 0.62;

    if (overlayMode === 'stability_class') {
      const cls = props.stability_class;
      color = cls === 'Class I' ? '#10B981' : 
              cls === 'Class II' ? '#06B6D4' : 
              cls === 'Class III' ? '#F59E0B' : 
              '#EF4444';
    } else if (overlayMode === 'fos_seismic') {
      const fos = props.fos_seismic != null ? props.fos_seismic : 1.0;
      color = fos >= 1.5 ? '#10B981' : 
              fos >= 1.25 ? '#06B6D4' : 
              fos >= 1.0 ? '#F59E0B' : 
              fos >= 0.85 ? '#F97316' : 
              '#EF4444';
    } else if (overlayMode === 'soil_type') {
      const type = (props.soil_type || '').toLowerCase();
      if (type.includes('moraine') || type.includes('colluvium') || type.includes('glacial')) {
        color = '#D946EF'; // Fuchsia for Alpine Moraine
      } else if (type.includes('regolith') || type.includes('crystalline')) {
        color = '#06B6D4'; // Electric Cyan for Himalayan Regolith
      } else if (type.includes('gneiss') || type.includes('granite') || type.includes('charnockite') || type.includes('bomdila')) {
        color = '#3B82F6'; // Royal Cobalt for Gneiss
      } else if (type.includes('sandstone') || type.includes('siwalik') || type.includes('flysch')) {
        color = '#F59E0B'; // Sandstone Amber
      } else if (type.includes('alluvial') || type.includes('loam')) {
        color = '#10B981'; // Emerald Green
      } else if (type.includes('phyllite') || type.includes('schist')) {
        color = '#8B5CF6'; // Purple Schist
      } else if (type.includes('laterite')) {
        color = '#EC4899'; // Bright Terracotta
      } else {
        color = '#38BDF8'; // Sky Blue
      }
      opacity = 0.65;
    } else if (overlayMode === 'drainage') {
      const d = props.drainage_density || 0;
      color = d > 4 ? '#2563EB' : 
              d > 2.5 ? '#06B6D4' : 
              d > 1.2 ? '#38BDF8' : 
              '#94A3B8';
      opacity = d > 2.5 ? 0.70 : 0.45;
    }

    if (selectedCell && selectedCell.cell_id === props.cell_id) {
      return { 
        fillColor: '#00F0FF', 
        fillOpacity: 0.92, 
        weight: 2.5, 
        color: '#FFFFFF' 
      };
    }

    const isCritical = props.risk_level === 'RED' || (props.fos_seismic != null && props.fos_seismic < 1.0);

    return { 
      fillColor: color, 
      fillOpacity: isCritical ? 0.65 : opacity, 
      weight: isCritical ? 1.0 : 0.25, 
      color: isCritical ? '#FF3B30' : 'rgba(255,255,255,0.15)' 
    };
  }, [overlayMode, selectedCell]);

  const onEachFeature = useCallback((feature, layer) => {
    const props = feature.properties || {};

    layer.bindTooltip(
      `<div style="font-family: monospace; font-size: 11px; line-height: 1.4;">
        <strong style="color: #00F0FF;">${props.cell_id || 'Slope Unit'}</strong><br/>
        <span>FoS (Seis): <strong>${props.fos_seismic != null ? props.fos_seismic : 'N/A'}</strong></span><br/>
        <span>Class: <strong style="color: ${props.stability_class === 'Class IV' ? '#EF4444' : '#F59E0B'}">${props.stability_class || 'N/A'}</strong></span><br/>
        <span>Geology: ${props.soil_type || 'Unknown'}</span><br/>
        <span>Slope: ${props.slope_mean ? props.slope_mean.toFixed(1) + '°' : 'N/A'}</span>
      </div>`,
      { sticky: true, className: 'lithos-tooltip' }
    );

    layer.on({
      click: () => {
        let p = { ...props };
        if (!p.soil_type) {
          p = {
            ...p,
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
        setSelectedCell(p);
      }
    });
  }, []);

  // Performance-optimized GeoJSON: only decimate if > 15000 units (i.e. Arunachal ~21k)
  // Render 100% of slope units without decimation
  const displayRiskGrid = useMemo(() => {
    return riskGrid;
  }, [riskGrid]);

  const MapUpdater = () => {
    const map = useMap();
    useEffect(() => {
      if (searchResult) {
        map.flyTo([searchResult.lat, searchResult.lon], 14, { animate: true, duration: 1.5 });
      } else if (selectedRegion) {
        if (selectedRegion.bbox && selectedRegion.bbox.length === 4) {
          const [minX, minY, maxX, maxY] = selectedRegion.bbox;
          map.fitBounds([[minY, minX], [maxY, maxX]], {
            padding: [20, 20],
            animate: true,
            duration: 1.0
          });
        } else if (selectedRegion.center) {
          map.flyTo(selectedRegion.center, 11, { animate: true, duration: 1.0 });
        }
      }
    }, [map, selectedRegion?.key, searchResult]);
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
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-[#00C2FF]" /> : <Search className="w-4 h-4" />}
              </button>
            </form>
          </div>

          {/* Floating Map Legend */}
          {mapStyle !== '3d' && (
            <div className="absolute bottom-6 left-4 z-[1000] glass px-3 py-2.5 rounded-xl text-[10px] flex flex-col gap-1.5 backdrop-blur-md border border-white/10 shadow-lg pointer-events-auto max-w-[240px]">
              <div className="text-[9px] uppercase font-black text-white/50 tracking-wider">
                {overlayMode === 'fos_seismic' && 'FoS (Seismic) Scale'}
                {overlayMode === 'stability_class' && 'Stability Classification'}
                {overlayMode === 'soil_type' && 'Regional Lithology'}
                {overlayMode === 'drainage' && 'Drainage Density'}
              </div>
              
              {overlayMode === 'fos_seismic' && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#10B981] inline-block"/><span>≥ 1.5 Safe</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#06B6D4] inline-block"/><span>1.25–1.5 OK</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B] inline-block"/><span>1.0–1.25 Watch</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#F97316] inline-block"/><span>0.85–1.0 Warn</span></div>
                  <div className="flex items-center gap-1.5 col-span-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444] inline-block"/><span>&lt; 0.85 Critical</span></div>
                </div>
              )}

              {overlayMode === 'stability_class' && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#10B981] inline-block"/><span>Class I (Stable)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#06B6D4] inline-block"/><span>Class II (Low)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B] inline-block"/><span>Class III (Mod)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444] inline-block"/><span>Class IV (Crit)</span></div>
                </div>
              )}

              {overlayMode === 'soil_type' && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#D946EF] inline-block"/><span>Moraine</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#06B6D4] inline-block"/><span>Regolith</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#3B82F6] inline-block"/><span>Gneiss</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B] inline-block"/><span>Sandstone</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#10B981] inline-block"/><span>Alluvium</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6] inline-block"/><span>Schist</span></div>
                </div>
              )}

              {overlayMode === 'drainage' && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB] inline-block"/><span>&gt; 4 km/km² (High)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#06B6D4] inline-block"/><span>2.5–4 (Moderate)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#94A3B8] inline-block"/><span>&lt; 2.5 (Low)</span></div>
                </div>
              )}
            </div>
          )}

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
              center={selectedRegion?.center || [25.57, 91.31]}
              zoom={11}
              preferCanvas={true}
              className="w-full h-full"
              zoomControl={false}
            >
              {mapStyle === 'dark' ? (
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
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
              {displayRiskGrid && (
                <GeoJSON
                  key={`${displayRiskGrid.region}_${overlayMode}_${selectedCell?.cell_id || 'none'}`}
                  data={displayRiskGrid}
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
                      <div className="text-risk-red font-black text-[10px] uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-risk-red animate-ping" />
                        <span>SENSOR TRIGGERED</span>
                      </div>
                      <div className="text-xs font-bold text-white mb-1">{alert.sensor_type.toUpperCase()} node: {alert.sensor_id}</div>
                      <div className="text-[10px] text-white/50">{alert.message}</div>
                    </div>
                  </Popup>
                </Circle>
              ))}
              {/* Crisp, glowing state boundary outline */}
              {selectedRegion && NE_STATE_BOUNDARIES[selectedRegion.key] && (() => {
                const coords = NE_STATE_BOUNDARIES[selectedRegion.key].map(([lon, lat]) => [lat, lon]);
                const borderColor = (STATE_BORDER_COLORS && STATE_BORDER_COLORS[selectedRegion.key]) || '#00C2FF';
                return (
                  <>
                    {/* Subtle outer glow */}
                    <Polygon
                      key={`boundary-glow-${selectedRegion.key}`}
                      positions={coords}
                      pathOptions={{ color: borderColor, weight: 4, opacity: 0.22, fill: false, interactive: false }}
                    />
                    {/* Sharp high-contrast boundary contour */}
                    <Polygon
                      key={`boundary-line-${selectedRegion.key}`}
                      positions={coords}
                      pathOptions={{ color: borderColor, weight: 2, opacity: 0.90, fill: false, interactive: false, dashArray: '6, 4' }}
                    />
                  </>
                );
              })()}
              {/* Predicted Debris Runout Cone for Selected Cell */}
              {activeRunoutData?.fan_polygon?.coordinates?.[0] && (() => {
                const fanCoords = activeRunoutData.fan_polygon.coordinates[0].map(c => [c[1], c[0]]);
                return (
                  <Polygon
                    key={`runout-fan-${selectedCell?.cell_id}`}
                    positions={fanCoords}
                    pathOptions={{
                      fillColor: '#FF9500',
                      fillOpacity: 0.35,
                      color: '#FF3B30',
                      weight: 2,
                      dashArray: '6, 4',
                    }}
                  >
                    <Popup className="glass-popup">
                      <div className="p-2 text-white min-w-[200px]">
                        <div className="text-[10px] font-black uppercase text-[#FF9500] tracking-wider mb-1 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#FF9500]" />
                          <span>DEBRIS RUNOUT IMPACT CONE</span>
                        </div>
                        <div className="text-xs space-y-1">
                          <p><strong>Reach:</strong> {activeRunoutData.runout_distance_m} m</p>
                          <p><strong>Failed Mass:</strong> {activeRunoutData.debris_volume_m3?.toLocaleString()} m³</p>
                          <p className="text-[10px] text-white/70 mt-1 leading-snug">{activeRunoutData.recommended_action}</p>
                        </div>
                      </div>
                    </Popup>
                  </Polygon>
                );
              })()}
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

              <DebrisFlowPanel 
                selectedCell={selectedCell} 
                onRunoutDataLoaded={setActiveRunoutData} 
              />

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
                <div className="glass p-4 rounded-xl border border-white/10 bg-black/30">
                  <h3 className="text-xs font-black uppercase text-white/70 mb-3">Recommendation Engine</h3>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/10">
                    <div className="text-[10px] text-white/50 uppercase mb-1">Proposed Treatment</div>
                    <div className="font-bold text-base mb-2 text-white">
                      {selectedCell.slope_mean > 45 ? 'RC Retaining Wall' : selectedCell.slope_mean > 30 ? 'Gabion Wall + Weep Holes' : 'Vegetation + Toe Drain'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-white/50 block text-[10px] uppercase">Intervention Class</span>
                        <span className="font-mono text-white text-xs">
                          {selectedCell.slope_mean > 45 ? 'Structural Heavy' : selectedCell.slope_mean > 30 ? 'Gravity Retaining' : 'Bio-Engineering'}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/50 block text-[10px] uppercase">IS 14458 Status</span>
                        <span className="text-risk-green flex items-center gap-1 font-mono">Compliant</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <RoadCutCalculator selectedCell={selectedCell} />

              {/* Slope Monitoring Recommendations with Touch-to-Open Phone Guide */}
              {selectedCell.fos_seismic < 1.5 && (
                <div 
                  onClick={() => setShowSensorGuide(true)}
                  className="glass p-4 rounded-xl border border-[#00C2FF]/30 bg-[#00C2FF]/5 cursor-pointer hover:border-[#00C2FF] hover:bg-[#00C2FF]/10 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-black uppercase text-[#00C2FF] tracking-wide">
                      IoT Sensor Subsystem
                    </h3>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/40">
                      Touch for Phone Guide
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
                      <div className="font-bold flex justify-between text-xs">
                        <span className="text-white">1. Vibrating Wire Piezometer</span>
                        <span className="text-white/40 font-mono text-[10px]">3–5m Borehole</span>
                      </div>
                      <div className="text-[10px] text-white/60 mt-0.5">Monitors interstitial pore water pressure rise during monsoons.</div>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
                      <div className="font-bold flex justify-between text-xs">
                        <span className="text-white">2. In-Place Inclinometer (IPI)</span>
                        <span className="text-white/40 font-mono text-[10px]">ABS Grooved Casing</span>
                      </div>
                      <div className="text-[10px] text-white/60 mt-0.5">Detects subsurface lateral movement across the anticipated slip plane.</div>
                    </div>
                    <div className="text-[10px] text-[#00C2FF]/80 text-center mt-2 border-t border-white/10 pt-2 font-mono">
                      Tap anywhere on this box to see how to connect a phone sensor →
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

      {/* Clean, Non-Flashing Phone Sensor Guide Modal */}
      {showSensorGuide && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-white/20 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-white/10 pb-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  In-Situ Mobile Sensor — Field Setup Guide
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  How to deploy any smartphone as a calibrated slope telemetry node
                </p>
              </div>
              <button 
                onClick={() => setShowSensorGuide(false)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-white/80 leading-relaxed">
              <div className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="w-6 h-6 rounded-full bg-[#00C2FF]/20 text-[#00C2FF] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <strong className="text-white block mb-0.5">Open on Smartphone</strong>
                  <span>Open your phone browser (Chrome or Safari) and go to <code className="bg-black/60 px-1.5 py-0.5 rounded text-[#00C2FF] font-mono">/sensor</code> or navigate from the top menu.</span>
                </div>
              </div>

              <div className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="w-6 h-6 rounded-full bg-[#00C2FF]/20 text-[#00C2FF] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <strong className="text-white block mb-0.5">One-Tap Authorization (No Manual Settings)</strong>
                  <span>Tap <em>"Authorize &amp; Start Monitoring"</em>. The browser directly binds the internal 3-axis motion sensors and GNSS GPS without digging into phone settings.</span>
                </div>
              </div>

              <div className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="w-6 h-6 rounded-full bg-[#00C2FF]/20 text-[#00C2FF] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <strong className="text-white block mb-0.5">Physical Slope Placement</strong>
                  <span>Place the phone inside an IP67 waterproof transparent pouch. Fasten it firmly flush against a stable rock bench or pre-driven anchor peg along the slope scarp.</span>
                </div>
              </div>

              <div className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="w-6 h-6 rounded-full bg-[#00C2FF]/20 text-[#00C2FF] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <strong className="text-white block mb-0.5">Real-Time Telemetry &amp; Alert Dispatch</strong>
                  <span>The device samples pitch and roll at 10 Hz. Any angular deflection greater than <strong>3.0°</strong> automatically dispatches a real-time warning over cellular/WiFi directly to this Engineering Portal map.</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowSensorGuide(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
              >
                Close Guide
              </button>
              <a
                href="/sensor"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#00C2FF] text-black hover:bg-[#009ACC] transition-colors flex items-center gap-1.5"
              >
                <span>Launch Phone Sensor Interface</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EngineerPortal;
