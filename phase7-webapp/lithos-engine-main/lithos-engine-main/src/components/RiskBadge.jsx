import React from 'react';

const levelMap = {
  RED:    { bg: 'rgba(230,57,70,0.1)',  color: '#E63946', border: 'rgba(230,57,70,0.25)'  },
  ORANGE: { bg: 'rgba(244,162,97,0.1)', color: '#F4A261', border: 'rgba(244,162,97,0.25)' },
  GREEN:  { bg: 'rgba(45,199,122,0.1)', color: '#2DC77A', border: 'rgba(45,199,122,0.25)' },
};

const RiskBadge = ({ level, score }) => {
  const style = levelMap[level] || { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 data-mono font-bold uppercase ${level === 'RED' ? 'shadow-glow-red' : 'shadow-glow-sm'}`}
      style={{
        background:   style.bg,
        color:        style.color,
        border:       `1px solid ${style.border}`,
        boxShadow:    `0 0 16px ${style.border}`,
        padding:      '2px 8px',
        borderRadius: '3px',
        fontSize:     '9px',
        letterSpacing:'0.06em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span>{level}</span>
      {score !== undefined && (
        <span style={{ opacity: 0.6, fontWeight: 400 }}>{(+score).toFixed(2)}</span>
      )}
    </span>
  );
};

export default RiskBadge;
