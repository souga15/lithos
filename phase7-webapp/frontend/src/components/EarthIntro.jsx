import React, { useEffect, useRef, useState } from 'react';
import { Compass, HardHat } from 'lucide-react';
import ImageSequencePlayer from './ImageSequencePlayer';

// ─── CSS injected once ─────────────────────────────────────────────────────────
const STYLE = `
@keyframes lithos-glow-pulse {
  0%, 100% { text-shadow: 0 0 20px #00C2FF88, 0 0 60px #00C2FF33; }
  50%       { text-shadow: 0 0 40px #00C2FFcc, 0 0 120px #00C2FF66; }
}
@keyframes subtitle-fade {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes card-rise {
  from { opacity: 0; transform: translateY(24px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes intro-exit {
  from { opacity: 1; transform: scale(1); filter: blur(0px); }
  to   { opacity: 0; transform: scale(1.06); filter: blur(4px); }
}
@keyframes scan-h {
  0%   { transform: translateY(-5%); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(105vh); opacity: 0; }
}
@keyframes aurora-drift {
  0%   { opacity: 0; transform: translateX(-30%) scaleX(0.8); }
  25%  { opacity: 0.5; }
  75%  { opacity: 0.3; }
  100% { opacity: 0; transform: translateX(30%) scaleX(1.2); }
}
@keyframes earth-canvas-enter {
  from { opacity: 0; transform: scale(0.75); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes slide-word {
  0%   { opacity: 0; transform: translateY(10px); }
  10%  { opacity: 1; transform: translateY(0); }
  90%  { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-10px); }
}
`;

// ─── Animated Space Background ────────────────────────────────────────────────────────
function startSpaceAnimation(canvas) {
  let w = window.innerWidth;
  let h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  
  let animId;
  let mouse = { x: null, y: null, radius: 180, isExploding: false, explosionRadius: 0 };

  const handleMouseMove = (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  };
  const handleMouseOut = () => {
    mouse.x = null;
    mouse.y = null;
  };

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseout', handleMouseOut);

  const stars = Array.from({ length: 450 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0,
    vy: 0,
    r: Math.random() * 1.5 + 0.2,
    baseA: Math.random() * 0.5 + 0.1,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.03 + 0.01,
  }));

  function setDim() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
  }
  window.addEventListener('resize', setDim);

  function loop() {
    ctx.clearRect(0, 0, w, h);

    let starsNearCursor = 0;

    // 1. Stars (Blinking & Physics)
    stars.forEach(s => {
      s.phase += s.speed;
      const alpha = s.baseA + Math.sin(s.phase) * 0.5;

      // Apply velocity and friction
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.92;
      s.vy *= 0.92;

      // Screen wrap
      if (s.x < 0) s.x = w;
      if (s.x > w) s.x = 0;
      if (s.y < 0) s.y = h;
      if (s.y > h) s.y = 0;

      if (alpha > 0) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
        ctx.fill();
      }

      // 2. Interactive Constellation (WorldQuant Foundry style)
      if (mouse.x !== null) {
        let dx = mouse.x - s.x;
        let dy = mouse.y - s.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < mouse.radius) {
          if (dist < 30) starsNearCursor++;

          if (!mouse.isExploding) {
            // Subtle magnetic pull toward mouse
            s.vx += dx * 0.0005;
            s.vy += dy * 0.0005;

            ctx.beginPath();
            ctx.strokeStyle = `rgba(43, 158, 255, ${0.4 * (1 - dist / mouse.radius)})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();

            // Connect nearby stars only near the cursor area for performance
            stars.forEach(other => {
              if (s === other) return;
              let dx2 = s.x - other.x;
              let dy2 = s.y - other.y;
              let dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              if (dist2 < 45) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(110, 64, 201, ${0.3 * (1 - dist2 / 45)})`;
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(other.x, other.y);
                ctx.stroke();
              }
            });
          }
        }
      }
    });

    // 3. Explosion triggers & drawing
    if (starsNearCursor > 45 && !mouse.isExploding) {
      mouse.isExploding = true;
      mouse.explosionRadius = 10;
      // Explode outwards!
      stars.forEach(s => {
        let dx = s.x - mouse.x;
        let dy = s.y - mouse.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius * 1.8) {
          let force = (mouse.radius * 1.8 - dist) * 0.12;
          let angle = Math.atan2(dy, dx);
          s.vx = Math.cos(angle) * force;
          s.vy = Math.sin(angle) * force;
        }
      });
    }

    if (mouse.isExploding) {
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, mouse.explosionRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 194, 255, ${1 - mouse.explosionRadius / 400})`;
      ctx.lineWidth = 4;
      ctx.stroke();
      mouse.explosionRadius += 12;

      // Reset explosion state when radius is large enough
      if (mouse.explosionRadius > 400) {
        mouse.isExploding = false;
      }
    }

    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', setDim);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseout', handleMouseOut);
  };
}

// ─── Three.js Earth Scene Removed ────────────────────────────────────────────────
// Replaced with Cinematic Image Sequence

// ─── Main Component ────────────────────────────────────────────────────────────
const ROTATING_WORDS = ["INTELLIGENCE", "RESILIENCE", "SAFETY", "PRECISION"];

// Pre-compute frame paths outside component
const conv1Frames = Array.from({ length: 184 }, (_, i) => 
  `/animated_pic_generation/converson_01/ezgif-frame-${String(i + 1).padStart(3, '0')}.jpg`
);
const conv2Frames = Array.from({ length: 168 }, (_, i) => 
  `/animated_pic_generation/converson_02/ezgif-frame-${String(i + 1).padStart(3, '0')}.jpg`
);
const ALL_FRAMES = [...conv1Frames, ...conv2Frames];

const EarthIntro = ({ regions, onSelect }) => {
  const starsRef     = useRef(null);
  const [exiting, setExiting]       = useState(false);
  const [hovered, setHovered]       = useState(null);
  const [wordIdx, setWordIdx]       = useState(0);

  // Interval for changing word (WAM.global style)
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIdx((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Inject CSS
  useEffect(() => {
    if (!document.getElementById('earth-intro-styles')) {
      const el = document.createElement('style');
      el.id = 'earth-intro-styles';
      el.textContent = STYLE;
      document.head.appendChild(el);
    }
  }, []);

  // Animate space background
  useEffect(() => {
    let cleanup;
    if (starsRef.current) {
      cleanup = startSpaceAnimation(starsRef.current);
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const handleSelect = (region) => {
    setExiting(true);
    setTimeout(() => onSelect(region), 700);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        overflow: 'hidden',
        animation: exiting ? 'intro-exit 0.7s ease-in forwards' : 'none',
      }}
    >
      {/* ── Full-screen Background Video Frame Sequence ── */}
      <ImageSequencePlayer framePaths={ALL_FRAMES} fps={24} />

      {/* Stars canvas on top of images */}
      <canvas ref={starsRef} style={{ position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none', opacity: 0.5 }} />

      {/* Aurora bands */}
      {[0, 1].map(i => (
        <div key={i} style={{
          position: 'absolute', zIndex: 7,
          top: `${8 + i * 7}%`, left: '-60%', right: '-60%',
          height: `${50 + i * 30}px`,
          background: i === 0
            ? 'linear-gradient(90deg, transparent, #00C2FF15, #6E40C922, transparent)'
            : 'linear-gradient(90deg, transparent, #6E40C912, #00C2FF18, transparent)',
          filter: 'blur(14px)',
          animation: `aurora-drift ${16 + i * 6}s ease-in-out infinite ${i * 4}s`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Scan line */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 7, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, #00C2FF55 35%, #00C2FFaa 50%, #00C2FF55 65%, transparent 100%)',
          animation: 'scan-h 8s ease-in-out infinite',
        }} />
      </div>

      {/* ── Bottom gradient scrim for text readability ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '65%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.3) 65%, transparent 100%)',
        zIndex: 8,
        pointerEvents: 'none',
      }} />

      {/* ── Content Overlay (text + buttons) ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 'max(24px, 3vh)',
        overflowY: 'auto',
      }}>
        {/* ── Title ── */}
        <div style={{ textAlign: 'center', marginBottom: 10, animation: 'subtitle-fade 1s ease-out 0.5s both' }}>
          <h1 style={{
            fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
            fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
            fontWeight: 900,
            letterSpacing: '0.36em',
            color: '#fff',
            margin: 0,
            animation: 'lithos-glow-pulse 3s ease-in-out infinite',
            textShadow: '0 2px 30px rgba(0,0,0,0.8)',
          }}>LITHOS</h1>
          <div style={{
            fontSize: 'clamp(0.6rem, 1.6vw, 0.82rem)',
            letterSpacing: '0.26em',
            color: '#00C2FF',
            opacity: 0.9, marginTop: 8,
            fontWeight: 600, textTransform: 'uppercase',
            animation: 'subtitle-fade 1s ease-out 0.8s both',
            display: 'flex', justifyContent: 'center', gap: '6px',
            textShadow: '0 1px 10px rgba(0,0,0,0.6)',
          }}>
            <span>Landslide</span>
            <span key={wordIdx} style={{ color: '#fff', animation: 'slide-word 3s ease-in-out infinite' }}>
              {ROTATING_WORDS[wordIdx]}
            </span>
            <span>System</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          width: '70%', maxWidth: 280, height: 1,
          background: 'linear-gradient(90deg, transparent, #00C2FF55, #6E40C944, transparent)',
          marginBottom: 18,
          animation: 'subtitle-fade 0.8s ease-out 1s both',
        }} />

        {/* ── Region Buttons ── */}
        <div style={{ textAlign: 'center', animation: 'card-rise 0.7s ease-out 1.1s both' }}>
          <p style={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 14,
          }}>Select Monitoring Region</p>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 9,
            justifyContent: 'center', maxWidth: 600, padding: '0 16px',
          }}>
            {regions.map((region, idx) => (
              <button
                key={region.key}
                onClick={() => handleSelect(region)}
                onMouseEnter={() => setHovered(region.key)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  padding: '9px 18px', borderRadius: 12,
                  border: `1px solid ${hovered === region.key ? 'rgba(0,194,255,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  background: hovered === region.key
                    ? 'linear-gradient(135deg, rgba(0,194,255,0.22), rgba(110,64,201,0.18))'
                    : 'rgba(255,255,255,0.06)',
                  color: hovered === region.key ? '#fff' : 'rgba(255,255,255,0.75)',
                  fontSize: '0.73rem', fontWeight: 700,
                  fontFamily: '"Inter", system-ui, sans-serif',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer', backdropFilter: 'blur(12px)',
                  transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                  transform: hovered === region.key ? 'translateY(-2px) scale(1.04)' : 'none',
                  boxShadow: hovered === region.key
                    ? '0 6px 22px rgba(0,194,255,0.25), 0 0 0 1px rgba(0,194,255,0.28)'
                    : 'none',
                  animation: `card-rise 0.55s ease-out ${1.2 + idx * 0.07}s both`,
                }}
              >
                {region.name}
              </button>
            ))}
          </div>

          {/* ── Quick Links ── */}
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24,
            animation: 'card-rise 0.6s ease-out 1.8s both',
          }}>
            <button
              onClick={() => window.location.href = '/route'}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(48,209,88,0.12)', color: '#30D158',
                border: '1px solid rgba(48,209,88,0.35)',
                fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.2s', backdropFilter: 'blur(12px)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(48,209,88,0.25)'; e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(48,209,88,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(48,209,88,0.12)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Compass size={14} /> Safe Route Finder
            </button>
            
            <button
              onClick={() => window.location.href = '/engineer'}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(255,149,0,0.12)', color: '#FF9500',
                border: '1px solid rgba(255,149,0,0.35)',
                fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.2s', backdropFilter: 'blur(12px)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,149,0,0.25)'; e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(255,149,0,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,149,0,0.12)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <HardHat size={14} /> Engineer Portal
            </button>
          </div>

          <p style={{
            marginTop: 22, fontSize: '0.6rem', letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.2)', fontWeight: 600, textTransform: 'uppercase',
            animation: 'card-rise 0.5s ease-out 2.2s both',
          }}>
            ◉ Real-time geohazard monitoring active
          </p>
        </div>
      </div>
    </div>
  );
};

export default EarthIntro;
