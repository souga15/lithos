/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // terrain dark palette (sanrita inspired)
        bg:      '#1a1e14',
        surface: '#222618',
        nav:     '#1c2014',
        panel:   '#282c1e',
        // Accent palette (neon lime)
        accent:  '#c8f57a',
        'accent-dim': '#8ab84a',
        secondary: '#4A5240', 
        // Semantic risk
        risk: {
          red:    '#ff4d4f',
          orange: '#f97316',
          green:  '#c8f57a',
          yellow: '#fbbf24',
        },
        // Neutral data tones
        silver: '#84907f',
        muted:  '#4a5240',
      },
      fontFamily: {
        sans:  ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }], // 10px
        '3xs': ['0.5rem',   { lineHeight: '0.75rem'  }], // 8px
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        card:  '12px',
        heavy: '24px',
        panel: '8px',
      },
      boxShadow: {
        card:     '0 1px 3px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.4)',
        panel:    '0 0 0 1px rgba(200,245,122,0.08) inset',
        glow:     '0 0 16px rgba(200,245,122,0.25)',
        'glow-sm':'0 0 8px rgba(200,245,122,0.15)',
        'glow-red':'0 0 16px rgba(255,77,79,0.3)',
        'glow-lg': '0 0 40px rgba(200,245,122,0.2)',
        none:     'none',
      },
    },
  },
  plugins: [],
}
