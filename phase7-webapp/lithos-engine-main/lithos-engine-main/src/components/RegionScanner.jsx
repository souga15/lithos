import React, { useEffect, useRef, useState } from 'react';

/**
 * RegionScanner
 * Plays a cinematic scan/radar animation over the map after region selection.
 * 
 * Phases:
 *   0 → 600ms  : Black screen slides away (wipe reveal)
 *   600 → 1800ms: Horizontal scan line sweeps top→bottom (green laser line)
 *   1200→ 2400ms: Grid lines materialise on the canvas (cross-hatch)
 *   2000→ 3200ms: Radar sweep arc rotates from centre
 *   2800→ 3600ms: Text readouts appear (lat/lon, status)
 *   3600ms       : Everything fades out → cells revealed
 */

const SCAN_DURATION = 3800; // total ms before onDone fires

const RegionScanner = ({ region, onDone }) => {
  const canvasRef  = useRef(null);
  const rafRef     = useRef(null);
  const startRef   = useRef(null);
  const [phase, setPhase]   = useState(0); // 0=active 1=fading 2=done
  const [readouts, setReadouts] = useState([]);

  // ── Canvas animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    startRef.current = performance.now();

    // Colours
    const CYAN   = '#00C2FF';
    const GREEN  = '#30D158';
    const RED    = '#FF3B30';
    const WHITE  = 'rgba(255,255,255,0.9)';
    const DIM    = 'rgba(0,194,255,0.25)';

    // Precomputed grid lines
    const GRID_COLS = 14;
    const GRID_ROWS = 10;

    function drawFrame(now) {
      const t  = (now - startRef.current) / SCAN_DURATION; // 0→1
      const ms = now - startRef.current;

      ctx.clearRect(0, 0, W(), H());

      // ── Phase A: dark wipe reveal (0→600ms) ────────────────────────────────
      if (ms < 700) {
        const revealY = Math.min(1, ms / 600);
        // Black curtain that slides UP
        ctx.fillStyle = '#000';
        ctx.fillRect(0, H() * revealY, W(), H() * (1 - revealY));
        // Glowing edge of wipe
        const grad = ctx.createLinearGradient(0, H() * revealY - 6, 0, H() * revealY + 2);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, CYAN);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, H() * revealY - 6, W(), 8);
      }

      // ── Phase B: full-screen grid overlay ──────────────────────────────────
      if (ms > 300) {
        const gridAlpha = Math.min(1, (ms - 300) / 500) * 0.18;
        ctx.strokeStyle = `rgba(0,194,255,${gridAlpha})`;
        ctx.lineWidth = 0.5;
        for (let c = 0; c <= GRID_COLS; c++) {
          const x = (W() / GRID_COLS) * c;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H()); ctx.stroke();
        }
        for (let r = 0; r <= GRID_ROWS; r++) {
          const y = (H() / GRID_ROWS) * r;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W(), y); ctx.stroke();
        }
      }

      // (Horizontal scan line removed as requested)

      // ── Phase D: radar sweep arc from centre (1000→3000ms) ────────────────
      if (ms > 1000 && ms < 3200) {
        const radarT  = (ms - 1000) / 2000;       // 0→1
        const angle   = radarT * Math.PI * 3.5;   // 1.75 full rotations
        const cx      = W() / 2;
        const cy      = H() / 2;
        const radius  = Math.sqrt(cx * cx + cy * cy) * 1.1;

        // Sweep gradient sector
        const sweepAlpha = Math.min(1, (ms - 1000) / 400) * 0.45;
        const sweep = ctx.createConicalGradient
          ? null   // standard API not widely available
          : null;

        // Fallback: draw a thin arc + glowing spoke
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Trailing arc (wide sector simulation with multiple thin lines)
        for (let i = 0; i < 24; i++) {
          const a   = -i * 0.05;
          const alp = ((24 - i) / 24) * sweepAlpha * 0.7;
          ctx.strokeStyle = `rgba(48,209,88,${alp})`;
          ctx.lineWidth   = radius / 12;
          ctx.beginPath();
          ctx.arc(0, 0, radius / 2, a - 0.025, a + 0.025);
          ctx.stroke();
        }

        // Bright spoke line
        ctx.shadowColor = GREEN;
        ctx.shadowBlur  = 14;
        ctx.strokeStyle = `rgba(48,209,88,${0.85 * Math.min(1, (ms - 1000) / 400)})`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(radius, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Centre dot
        ctx.fillStyle = GREEN;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Concentric range rings
        ctx.restore();
        [0.25, 0.5, 0.75, 1.0].forEach(frac => {
          const ringA = Math.min(sweepAlpha * 0.6, 0.25);
          ctx.strokeStyle = `rgba(48,209,88,${ringA})`;
          ctx.lineWidth   = 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, radius * frac, 0, Math.PI * 2);
          ctx.stroke();
        });
      }

      // ── Phase E: cell scan flashes (scattered red/orange dots, 1500→3000ms)
      if (ms > 1500 && ms < 3000) {
        const flashT = (ms - 1500) / 1500;
        const flashCount = Math.floor(flashT * 22);
        // Deterministic pseudo-random positions (seeded by index)
        for (let i = 0; i < flashCount; i++) {
          const px  = W() * ((i * 137.508 + 23) % W()) / W();
          const py  = H() * ((i * 79.37 + 47)  % H()) / H();
          const col = i % 5 === 0 ? RED : (i % 3 === 0 ? '#FF9500' : CYAN);
          const sz  = 3 + (i % 4);
          const alp = 0.4 + 0.5 * Math.sin(ms * 0.01 + i);
          ctx.fillStyle   = col;
          ctx.globalAlpha = Math.max(0, alp);
          ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);

          // scan corner markers on some cells
          if (i % 4 === 0) {
            ctx.globalAlpha = alp * 0.7;
            ctx.strokeStyle = col;
            ctx.lineWidth   = 1;
            const m = sz + 3;
            ctx.beginPath();
            ctx.moveTo(px - m, py - m + 4); ctx.lineTo(px - m, py - m); ctx.lineTo(px - m + 4, py - m);
            ctx.moveTo(px + m - 4, py - m); ctx.lineTo(px + m, py - m); ctx.lineTo(px + m, py - m + 4);
            ctx.moveTo(px + m, py + m - 4); ctx.lineTo(px + m, py + m); ctx.lineTo(px + m - 4, py + m);
            ctx.moveTo(px - m + 4, py + m); ctx.lineTo(px - m, py + m); ctx.lineTo(px - m, py + m - 4);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Phase F: HUD text readouts (2000→fade) ────────────────────────────
      if (ms > 2000) {
        const hudA = Math.min(1, (ms - 2000) / 400);
        ctx.globalAlpha = hudA;
        ctx.font        = 'bold 10px "Inter", monospace';

        const lines = [
          `REGION: ${region?.name?.toUpperCase() || 'UNKNOWN'}`,
          `LAT:  ${region?.center?.[0]?.toFixed(4) ?? '---'}°N`,
          `LON:  ${region?.center?.[1]?.toFixed(4) ?? '---'}°E`,
          `HAZARD CELLS: SCANNING...`,
          `LITHOS CORE v2.1 — ACTIVE`,
        ];

        lines.forEach((line, i) => {
          ctx.fillStyle   = i === 3 ? RED : CYAN;
          ctx.shadowColor = i === 3 ? RED : CYAN;
          ctx.shadowBlur  = 6;
          ctx.fillText(line, 18, 28 + i * 17);
        });

        // Bottom-right status
        ctx.textAlign = 'right';
        ctx.fillStyle = WHITE;
        ctx.shadowColor = WHITE; ctx.shadowBlur = 4;
        ctx.fillText('◉ REAL-TIME SCAN ACTIVE', W() - 18, H() - 16);
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // ── Phase G: fade-out veil (3200→3800ms) ──────────────────────────────
      if (ms > 3200) {
        const fadeAlpha = Math.min(1, (ms - 3200) / 600);
        ctx.fillStyle   = `rgba(0,0,0,${fadeAlpha})`;
        ctx.fillRect(0, 0, W(), H());
      }

      if (ms < SCAN_DURATION) {
        rafRef.current = requestAnimationFrame(drawFrame);
      } else {
        setPhase(2);
      }
    }

    rafRef.current = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [region]);

  // Phase transitions
  useEffect(() => {
    if (phase === 2) {
      // Small extra delay so black fade fully lands
      const t = setTimeout(() => onDone(), 120);
      return () => clearTimeout(t);
    }
  }, [phase, onDone]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Region name big typography — centred, fades in mid-scan */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        animation: 'scanner-region-name 3.8s ease-out forwards',
      }}>
        <style>{`
          @keyframes scanner-region-name {
            0%   { opacity: 0; transform: translate(-50%,-50%) scale(1.15); }
            20%  { opacity: 1; transform: translate(-50%,-50%) scale(1); }
            75%  { opacity: 1; }
            100% { opacity: 0; transform: translate(-50%,-50%) scale(0.92); }
          }
          @keyframes scanner-sub-blink {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.3; }
          }
        `}</style>

        <p style={{
          fontFamily: '"Inter", monospace',
          fontSize: 'clamp(0.6rem, 1.5vw, 0.75rem)',
          letterSpacing: '0.35em',
          color: '#00C2FF',
          fontWeight: 700,
          textTransform: 'uppercase',
          marginBottom: 10,
          textShadow: '0 0 12px #00C2FF',
        }}>Initialising region scan</p>

        <h2 style={{
          fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
          fontSize: 'clamp(1.6rem, 4vw, 3rem)',
          fontWeight: 900,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#fff',
          textShadow: '0 0 30px rgba(0,194,255,0.7), 0 0 60px rgba(0,194,255,0.3)',
          margin: 0,
          lineHeight: 1.1,
        }}>
          {region?.name || ''}
        </h2>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, marginTop: 14,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#30D158',
            boxShadow: '0 0 8px #30D158',
            animation: 'scanner-sub-blink 0.8s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: 'monospace',
            fontSize: '0.68rem',
            letterSpacing: '0.2em',
            color: '#30D158',
            fontWeight: 700,
            textTransform: 'uppercase',
            textShadow: '0 0 8px #30D158',
            animation: 'scanner-sub-blink 0.8s ease-in-out infinite',
          }}>
            Scanning terrain...
          </span>
        </div>
      </div>
    </div>
  );
};

export default RegionScanner;
