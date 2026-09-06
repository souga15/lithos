import React from 'react';
import { Pickaxe, BrainCircuit, Route, Mountain, ShieldCheck, Zap, Globe, Cpu } from 'lucide-react';

const About = () => {
  const roadmap = [
    { year: 'PHASE 1–2', title: 'Foundations',    body: 'Regional grid setup, terrain processing, and XGBoost baseline development.', status: 'COMPLETED', icon: <Pickaxe className="w-5 h-5" /> },
    { year: 'PHASE 3–4', title: 'Deep Learning',  body: 'CNN + LSTM fusion with Sentinel-2 NDVI/NDWI and InSAR deformation integration.', status: 'COMPLETED', icon: <BrainCircuit className="w-5 h-5" /> },
    { year: 'PHASE 5–6', title: 'Intelligence',   body: 'Real-time alert engine and A* safe routing logic for multi-risk environments.', status: 'COMPLETED', icon: <Route className="w-5 h-5" /> },
    { year: 'PHASE 7',   title: 'LITHOS WebApp',  body: 'Deployment of full-stack PWA with community hazard reporting and live API pipes.', status: 'ACTIVE',    icon: <Mountain className="w-5 h-5" /> }
  ];

  const features = [
    { title: 'Synthetic Aperture Radar',  desc: 'InSAR displacement mapping detects millimeter-level pre-failure terrain movement through cloud cover.', icon: <Globe className="w-5 h-5" /> },
    { title: 'Deep Neural Networks',      desc: 'Dual CNN-LSTM architecture predicts multi-stage slope failure probabilities with 94.2% accuracy.',     icon: <Cpu className="w-5 h-5" /> },
    { title: 'Live Navigation API',       desc: 'A* dynamic routing calculates transit lines avoiding areas with seismic factors of safety < 1.0.',       icon: <Route className="w-5 h-5" /> }
  ];

  const techStack = ['Sentinel-1', 'Sentinel-2', 'NASA GPM', 'React.js', 'FastAPI', 'XGBoost', 'CesiumJS', 'Leaflet'];

  return (
    <div className="min-h-screen bg-bg text-white relative overflow-x-hidden pb-24">

      {/* Subtle static background radial — no bouncy animation */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          width: 900, height: 500,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(43,158,255,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-5xl mx-auto px-5 space-y-20 relative z-10">

        {/* ─── Hero ─────────────────────────────────────────── */}
        <header className="pt-20 text-center flex flex-col items-center gap-6 animate-fade-in">
          {/* Logo block */}
          <div className="relative group">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(43,158,255,0.06)', border: '1px solid rgba(43,158,255,0.15)' }}
            >
              <img
                src="/logo.png"
                alt="LITHOS"
                onError={e => { e.target.style.display='none'; document.getElementById('about-fallback-logo').style.display='flex'; }}
                className="w-12 h-12 object-contain"
              />
              <div id="about-fallback-logo" className="hidden w-12 h-12 items-center justify-center">
                <Mountain className="w-10 h-10 text-accent" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1
              className="font-bold text-white tracking-tight"
              style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', lineHeight: 1, letterSpacing: '-0.03em' }}
            >
              LITHOS
            </h1>
            <p className="data-mono text-xs text-accent/80 uppercase tracking-[0.35em] max-w-lg mx-auto">
              Landslide Intelligence using Temporal &amp; Hyperlocal Observation System
            </p>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {[
              { label: 'Accuracy', val: '94.2%' },
              { label: 'Grid Resolution', val: '2km × 2km' },
              { label: 'Data Latency', val: '< 14 min' },
            ].map(s => (
              <div key={s.label} className="glass px-4 py-2 rounded flex items-center gap-2.5">
                <span className="data-mono text-sm font-bold text-white">{s.val}</span>
                <span className="label-micro">{s.label}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ─── Mission ──────────────────────────────────────── */}
        <section className="glass rounded-lg overflow-hidden">
          <div className="grid md:grid-cols-5">
            <div className="md:col-span-3 p-8 md:p-12 space-y-5">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: 'var(--accent)' }} />
                <span className="label-micro" style={{ color: 'var(--accent)' }}>The Mission</span>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold leading-snug text-white/90" style={{ letterSpacing: '-0.02em' }}>
                A paradigm shift in geotechnical engineering and predictive safety.
              </h2>
              <p className="text-sm text-white/45 leading-relaxed font-normal">
                LITHOS was engineered to secure the most volatile terrains across Northeast India and Kerala.
                By synthesizing raw multi-modal satellite streams with localized ground intelligence, we bridge
                the theoretical divide—transforming abstract meteorological data into actionable, life-saving
                predictive warnings.
              </p>
            </div>
            <div
              className="md:col-span-2 p-8 md:p-12 flex flex-col gap-6"
              style={{ background: 'rgba(255,255,255,0.01)', borderLeft: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div>
                <p className="label-micro mb-1">Lead Architect &amp; Researcher</p>
                <p className="text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>Sougata M.</p>
              </div>
              <div className="h-px w-8" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="space-y-3">
                {[
                  { icon: <ShieldCheck className="w-4 h-4" style={{ color: 'var(--risk-green)' }} />, text: 'Military-grade Precision' },
                  { icon: <Zap className="w-4 h-4" style={{ color: 'var(--risk-yellow)' }} />,       text: 'Sub-30 Min Latency' },
                  { icon: <Globe className="w-4 h-4" style={{ color: 'var(--accent)' }} />,          text: '2km × 2km Grid Cells' },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-2.5">
                    {item.icon}
                    <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Feature Grid ─────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feat, i) => (
            <div
              key={i}
              className="glass p-7 rounded flex flex-col gap-4 transition-all duration-150 cursor-default"
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(43,158,255,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
            >
              <div
                className="w-10 h-10 rounded flex items-center justify-center"
                style={{ background: 'rgba(43,158,255,0.07)', color: 'var(--accent)' }}
              >
                {feat.icon}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white/90" style={{ letterSpacing: '-0.01em' }}>{feat.title}</h3>
                <p className="text-xs text-white/35 leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ─── Roadmap ──────────────────────────────────────── */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="heading-accent">Evolution Timeline</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {roadmap.map((step, i) => (
              <div
                key={i}
                className="glass p-6 rounded flex flex-col h-full transition-all duration-150"
                style={{
                  borderLeft: step.status === 'ACTIVE' ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="text-white/20">{step.icon}</span>
                  <span
                    className="data-mono text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                    style={step.status === 'ACTIVE'
                      ? { background: 'rgba(43,158,255,0.1)', color: 'var(--accent)' }
                      : { background: 'rgba(45,199,122,0.08)', color: 'var(--risk-green)' }
                    }
                  >
                    {step.status}
                  </span>
                </div>
                <p className="label-micro mb-1" style={{ color: 'var(--accent)' }}>{step.year}</p>
                <h3 className="text-sm font-semibold text-white/80 mb-3" style={{ letterSpacing: '-0.01em' }}>{step.title}</h3>
                <p className="text-xs text-white/30 leading-relaxed flex-grow">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Tech Stack ───────────────────────────────────── */}
        <section className="py-12">
          <p className="label-micro text-center mb-8">System Architecture Foundation</p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
            {techStack.map(tech => (
              <span
                key={tech}
                className="text-sm font-semibold uppercase text-white/15 hover:text-white/50 transition-colors duration-200 cursor-default"
                style={{ letterSpacing: '0.08em' }}
              >
                {tech}
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer
        className="mt-8 py-6 text-center border-t"
        style={{ borderColor: 'rgba(255,255,255,0.04)' }}
      >
        <span className="data-mono text-[10px] text-white/15 uppercase tracking-[0.4em]">
          LITHOS v7.0.0 &copy; 2026 · Built for Resilience
        </span>
      </footer>
    </div>
  );
};

export default About;
