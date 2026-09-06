/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core background palette — ink-dark tactical
        bg:      '#050814',
        surface: '#090d1c',
        nav:     '#07091a',
        panel:   '#0b0f22',
        // Accent palette
        accent:  '#2B9EFF',        // electric blue (calmer, less neon)
        'accent-dim': '#1a6bc4',
        secondary: '#4E3F7A',      // deep purple
        // Semantic risk
        risk: {
          red:    '#E63946',
          orange: '#F4A261',
          green:  '#2DC77A',
          yellow: '#E9C46A',
        },
        // Neutral data tones
        silver: '#8A8FA8',
        muted:  '#3A3F55',
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
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
        panel:    '0 0 0 1px rgba(255,255,255,0.03) inset',
        glow:     '0 0 16px rgba(43,158,255,0.25)',
        'glow-sm':'0 0 8px rgba(43,158,255,0.15)',
        'glow-red':'0 0 16px rgba(230,57,70,0.3)',
        'glow-lg': '0 0 40px rgba(43,158,255,0.2)',
        none:     'none',
      },
      animation: {
        'pulse-dot':    'pulse-dot 2.4s ease-in-out infinite',
        'pulse-soft':   'pulse-soft 3s ease-in-out infinite',
        'shimmer':      'shimmer 2.5s linear infinite',
        'fade-in':      'fade-in 0.15s ease-out forwards',
        'slide-down':   'slide-down 0.2s ease-out forwards',
        'slide-up':     'slide-up 0.2s ease-out forwards',
        'loading-bar':  'loading-bar 2s ease-in-out infinite',
        'scan-ring':    'scan-ring 3s ease-out infinite',
        'scan-ring-2':  'scan-ring-2 3s ease-out infinite 1s',
        'scan-ring-3':  'scan-ring-3 3s ease-out infinite 2s',
        'sonar-sweep':  'sonar-sweep 4s linear infinite',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.85)' },
          '50%':      { opacity: '1',   transform: 'scale(1.1)'  },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1'   },
          '50%':      { opacity: '0.4' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0'  },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)'   },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)'    },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)'   },
        },
        'loading-bar': {
          '0%':   { transform: 'translateX(-100%) scaleX(0.5)' },
          '50%':  { transform: 'translateX(0%)    scaleX(1)'   },
          '100%': { transform: 'translateX(100%)  scaleX(0.5)' },
        },
        'scan-ring': {
          from: { transform: 'translate(-50%,-50%) scale(0.2)', opacity: '0.8' },
          to:   { transform: 'translate(-50%,-50%) scale(3.5)', opacity: '0'   },
        },
        'scan-ring-2': {
          from: { transform: 'translate(-50%,-50%) scale(0.2)', opacity: '0.6' },
          to:   { transform: 'translate(-50%,-50%) scale(5.0)', opacity: '0'   },
        },
        'scan-ring-3': {
          from: { transform: 'translate(-50%,-50%) scale(0.2)', opacity: '0.4' },
          to:   { transform: 'translate(-50%,-50%) scale(7.0)', opacity: '0'   },
        },
        'sonar-sweep': {
          from: { transform: 'translate(-50%,-50%) rotate(0deg)'   },
          to:   { transform: 'translate(-50%,-50%) rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
}
