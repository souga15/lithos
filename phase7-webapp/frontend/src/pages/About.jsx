import React from 'react';
import { 
  BrainCircuit, 
  Route, 
  Mountain, 
  ShieldCheck, 
  Zap, 
  Globe, 
  Cpu, 
  Radio, 
  FileText, 
  Layers, 
  Compass, 
  HardHat, 
  Activity, 
  CheckCircle2, 
  ArrowUpRight, 
  Satellite,
  Truck
} from 'lucide-react';
import { Link } from 'react-router-dom';

const About = () => {
  const corePillars = [
    {
      title: 'Physics-Informed Neural Networks (PINN)',
      code: 'IS 14458 & IS 1893 COMPLIANT',
      desc: 'Combines classical geotechnical limit-equilibrium mechanics (Infinite Slope & Bishop methods) with a 9-feature ResNet backbone and Platt scaling calibration. Eliminates black-box ML hallucinations by enforcing Mohr-Coulomb shear physics and dynamic seismic coefficients (kh).',
      icon: <BrainCircuit className="w-5 h-5 text-[#00C2FF]" />,
      stats: 'AUC 0.897 · Val Loss 0.041'
    },
    {
      title: 'Satellite Earth Observation & InSAR',
      code: 'SENTINEL-1 / 2 & NASA GPM',
      desc: 'Fuses multi-temporal Sentinel-1 C-band synthetic aperture radar (InSAR ground deformation proxy) with Sentinel-2 optical multispectral vegetation indices (NDVI/NDWI) and live NASA GPM 72-hour precipitation accumulations at sub-hourly latency.',
      icon: <Satellite className="w-5 h-5 text-[#10B981]" />,
      stats: '12-Day Interferometry · Live Radar'
    },
    {
      title: 'High-Fidelity DEM Slope Catchments',
      code: '45,137 TOPOGRAPHIC UNITS',
      desc: 'Replaces coarse, arbitrary rectangular grid boxes with genuine hydrologically conditioned slope units derived from 30m SRTM DEM. Features 100% contiguous zero-gap coverage across all 8 Northeast Indian states, strictly clipped to official Survey of India boundaries.',
      icon: <Layers className="w-5 h-5 text-[#FF9500]" />,
      stats: '100% Contiguous · Zero-Spill'
    },
    {
      title: 'Debris Runout & Impact Mechanics',
      code: 'FAHRBÖSCHUNG MODEL',
      desc: 'Simulates the kinematic runout trajectory, dynamic impact pressures (kPa), and downslope reach of failing colluvial masses. Computes practical, field-calibrated disposal logistics for NHAI and Border Roads Organisation (BRO) using standard 10-wheeler tipper truck fleets.',
      icon: <Truck className="w-5 h-5 text-[#EF4444]" />,
      stats: 'Hungr Velocity · MoRTH Staging'
    },
    {
      title: 'Geotechnical SafeRoute Navigation',
      code: 'A* RISK-PENALTY ROUTING',
      desc: 'Calculates emergency response and public transit corridors by assigning exponential cost penalties to road segments traversing unstable slope units (FoS < 1.0) or active debris trajectory corridors. Keeps vital lifeline highways open during severe monsoons.',
      icon: <Route className="w-5 h-5 text-[#38BDF8]" />,
      stats: 'Dynamic Reroute · NH-2 / NH-10'
    },
    {
      title: 'Citizen & Field Edge Seismograph',
      code: 'IOT HARDWARE TELEMETRY',
      desc: 'Harnesses client-side device motion APIs (accelerometer, gyroscope, orientation) to convert standard field smartphones and tablets into localized high-frequency edge seismographs without requiring manual settings or external hardware dongles.',
      icon: <Activity className="w-5 h-5 text-[#A855F7]" />,
      stats: '100 Hz Sampling · Zero-Install'
    }
  ];

  const stateCoverage = [
    { state: 'Meghalaya', units: '4,542 units', desc: 'World’s wettest plateau, extreme pore-water pressure & gorge failure monitoring' },
    { state: 'Sikkim', units: '1,915 units', desc: 'Teesta basin corridor, high-altitude moraine & steep granite hillslope risk' },
    { state: 'Manipur', units: '4,487 units', desc: 'Critical NH-2 / NH-37 lifeline highway corridor, active faulting & shearing' },
    { state: 'Arunachal Pradesh', units: '12,637 units', desc: 'Eastern Himalayan ranges, deep gorges, rainwash & road-cut stability' },
    { state: 'Nagaland', units: '3,403 units', desc: 'Fold belt tectonic fracturing, deep regolith saturation & town subsiding' },
    { state: 'Assam', units: '7,749 units', desc: 'Dima Hasao & Karbi Anglong hill sections, Barak railway cut-slopes' },
    { state: 'Mizoram', units: '4,513 units', desc: 'Steep Barail ridge slopes, high regolith depth & urban slope vulnerability' },
    { state: 'Tripura', units: '2,348 units', desc: 'Folded anticlinal ridge terrain, riverbank scouring & highway connectivity' }
  ];

  const techStack = [
    { cat: 'Geotechnical & AI', list: ['PyTorch (PINN)', 'ResNet Backbone', 'Limit Equilibrium (IS 14458)', 'Platt Scaling', 'GeoPandas', 'Shapely'] },
    { cat: 'Earth Observation', list: ['Sentinel-1 SAR (InSAR)', 'Sentinel-2 Multispectral', 'NASA GPM Precipitation', 'SRTM 30m DEM', 'Earth Engine'] },
    { cat: 'System Architecture', list: ['FastAPI (Python)', 'React 18 + Vite', 'CesiumJS (3D Terrain)', 'Leaflet Engine', 'WebSockets', 'PWA Offline Sync'] },
    { cat: 'Engineering Standards', list: ['IS 14458 (Hill Slopes)', 'IS 1893 (Seismic Criteria)', 'IRC:SP:48 (Hill Roads)', 'MoRTH Schedule of Rates', 'NHAI Guidelines'] }
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white relative overflow-x-hidden pb-24">
      {/* Background ambient lighting */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          width: 1100, height: 600,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(0, 194, 255, 0.08) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-6xl mx-auto px-5 space-y-20 relative z-10">

        {/* ─── Hero ─────────────────────────────────────────── */}
        <header className="pt-20 text-center flex flex-col items-center gap-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#00C2FF] animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#00C2FF]">
              National Geotechnical Early Warning Infrastructure
            </span>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-none">
              LITHOS
            </h1>
            <p className="text-xs sm:text-sm font-mono text-[#00C2FF] tracking-[0.25em] uppercase">
              Landslide Intelligence using Temporal &amp; Hyperlocal Observation System
            </p>
            <p className="text-sm sm:text-base text-white/60 leading-relaxed max-w-2xl mx-auto font-normal">
              A real-time, physics-informed geotechnical intelligence platform designed to safeguard lives, 
              strategic highway lifelines, and critical infrastructure across the 8 states of Northeast India.
            </p>
          </div>

          {/* Core Numerical KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl pt-2">
            {[
              { label: 'Active Slope Units', val: '45,137', sub: '30m DEM Catchments' },
              { label: 'Northeast States', val: '8 / 8', sub: '100% Contiguous Coverage' },
              { label: 'Model Validation', val: '0.897 AUC', sub: 'Platt-Calibrated PINN' },
              { label: 'Standard Compliance', val: 'IS 14458', sub: 'MoRTH / NHAI Aligned' }
            ].map((kpi, idx) => (
              <div key={idx} className="glass p-3.5 rounded-xl border border-white/10 text-center flex flex-col justify-center">
                <span className="text-xl sm:text-2xl font-black text-white font-mono">{kpi.val}</span>
                <span className="text-[10px] uppercase font-bold text-[#00C2FF] tracking-wider mt-0.5">{kpi.label}</span>
                <span className="text-[9px] text-white/40">{kpi.sub}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ─── Operational Philosophy ───────────────────────── */}
        <section className="glass rounded-2xl border border-white/10 p-8 sm:p-12 overflow-hidden relative">
          <div className="grid md:grid-cols-5 gap-8 items-center">
            <div className="md:col-span-3 space-y-4">
              <div className="text-[10px] uppercase font-bold tracking-widest text-[#00C2FF] flex items-center gap-2">
                <Mountain className="w-4 h-4" /> Operational Paradigm
              </div>
              <h2 className="text-xl sm:text-3xl font-black text-white leading-tight">
                Bridging Satellite Radar and Geotechnical Physics for Field-Actionable Safety.
              </h2>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                Conventional landslide warnings rely on coarse district-level rain gauges or statistical empirical thresholds that trigger false alarms or fail to pinpoint active slope detachment.
              </p>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                <strong>LITHOS fundamentally redesigns this approach</strong> by coupling live Sentinel-1 SAR interferometric ground displacement with Physics-Informed Neural Networks (PINN). Every slope unit is evaluated under <em>IS 14458 (Guidelines for Retaining Walls for Hill Slopes)</em> and <em>IS 1893 (Criteria for Earthquake Resistant Design)</em>, delivering deterministic factors of safety, dynamic debris runout cones, and automated engineering mitigation directives.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link to="/engineer" className="px-4 py-2 rounded-lg bg-[#00C2FF] text-black font-black text-xs hover:bg-[#00C2FF]/90 transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,194,255,0.3)]">
                  <HardHat className="w-4 h-4" /> Launch Engineer Portal
                </Link>
                <Link to="/safe-route" className="px-4 py-2 rounded-lg bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all flex items-center gap-1.5 border border-white/10">
                  <Route className="w-4 h-4" /> Test Geotechnical Routing
                </Link>
              </div>
            </div>

            <div className="md:col-span-2 bg-black/40 p-6 rounded-xl border border-white/10 space-y-3.5 text-xs">
              <div className="text-[10px] uppercase font-bold text-white/40 tracking-wider pb-2 border-b border-white/10">
                Key Platform Capabilities
              </div>
              {[
                { title: 'Sub-30 Minute Threat Detection', desc: 'Autonomous pipeline ingesting live radar, rainfall, and ground IoT feeds.' },
                { title: 'Exact Survey of India Boundary Fitting', desc: 'Slope units strictly conform to official state borders with zero spill.' },
                { title: 'Realistic Tipper Truck Logistics', desc: 'Calculates active detachment volume (600–3,500 m³) and MoRTH truck fleets.' },
                { title: 'Zero-Install Edge Seismograph', desc: 'Instantly taps smartphone IMU sensors for real-time vibration alerts.' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold block">{item.title}</strong>
                    <span className="text-white/50 text-[11px] leading-tight block">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Technical Pillars Grid ────────────────────────── */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-[#00C2FF] mb-1">
                System Pillars
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Six Architectural Innovations
              </h2>
            </div>
            <p className="text-xs text-white/50 max-w-md">
              Engineered end-to-end for zero-tolerance disaster prevention along strategic mountain transit corridors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {corePillars.map((pillar, idx) => (
              <div 
                key={idx} 
                className="glass p-5 rounded-xl border border-white/10 flex flex-col justify-between hover:border-[#00C2FF]/40 transition-all duration-200 group bg-black/20"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5 group-hover:scale-105 transition-transform">
                      {pillar.icon}
                    </div>
                    <span className="text-[9px] font-mono font-bold tracking-wider text-white/40 bg-white/5 px-2 py-0.5 rounded">
                      {pillar.code}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-[#00C2FF] transition-colors">
                      {pillar.title}
                    </h3>
                    <p className="text-xs text-white/60 leading-relaxed mt-1.5">
                      {pillar.desc}
                    </p>
                  </div>
                </div>
                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/40">
                  <span>SPECIFICATION</span>
                  <span className="text-[#00C2FF] font-bold">{pillar.stats}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 8 Northeast States Complete Coverage ──────────── */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] mb-1">
                Geographical Deployment
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                100% Contiguous Coverage: All 8 Northeast States
              </h2>
            </div>
            <span className="text-xs font-mono text-[#10B981] font-bold bg-[#10B981]/10 px-3 py-1 rounded-full border border-[#10B981]/20">
              Zero Outer Spillage · Precision Boundary Trimmed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stateCoverage.map((item, idx) => (
              <div key={idx} className="glass p-4 rounded-xl border border-white/10 bg-black/30 space-y-2 hover:border-white/20 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">{item.state}</span>
                  <span className="text-[10px] font-mono font-bold text-[#00C2FF] bg-[#00C2FF]/10 px-2 py-0.5 rounded border border-[#00C2FF]/20">
                    {item.units}
                  </span>
                </div>
                <p className="text-[11px] text-white/60 leading-snug">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Technology Stack ─────────────────────────────── */}
        <section className="glass rounded-2xl border border-white/10 p-6 sm:p-8 space-y-6 bg-black/40">
          <div className="text-center space-y-1">
            <div className="text-[10px] uppercase font-bold tracking-widest text-white/40">
              Full Stack Technical Architecture
            </div>
            <h3 className="text-lg font-bold text-white">
              Open Standards &amp; Certified Geotechnical Frameworks
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {techStack.map((stack, idx) => (
              <div key={idx} className="space-y-2.5">
                <span className="text-[11px] font-black uppercase text-[#00C2FF] tracking-wider block border-b border-white/10 pb-1">
                  {stack.cat}
                </span>
                <ul className="space-y-1.5 text-xs text-white/70">
                  {stack.list.map((tech, tIdx) => (
                    <li key={tIdx} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      <span>{tech}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Citation & Institutional Attribution ─────────── */}
        <section className="p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="space-y-1 text-center sm:text-left">
            <div className="font-bold text-white text-sm">
              LITHOS Geotechnical Resilience Framework
            </div>
            <div className="text-white/50 text-[11px]">
              Aliged with Ministry of Road Transport &amp; Highways (MoRTH), National Highways Authority of India (NHAI), and Geological Survey of India (GSI) hazard mapping guidelines.
            </div>
          </div>
          <div className="shrink-0 font-mono text-[11px] text-white/40 text-center sm:text-right">
            <div>Version 11.0.0-PROD</div>
            <div className="text-[#00C2FF]">Active Deployment · 2026</div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default About;
