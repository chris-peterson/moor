import React from 'react';

const accentColors = {
  amber: 'var(--color-left)',
  teal: 'var(--color-right)',
  coral: 'var(--color-conflict)',
  green: 'var(--color-equal)',
};

export function Toolbar({ children }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

export function ToolbarButton({ children, onClick, accent, disabled }) {
  const accentColor = accent ? accentColors[accent] : null;

  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    fontWeight: 500,
    color: hover ? (accentColor || 'var(--text-primary)') : (accentColor || 'var(--text-secondary)'),
    background: hover ? 'var(--bg-hover)' : 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background 0.1s, color 0.1s',
    transform: active ? 'scale(0.98)' : 'none',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <button
      style={style}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
    >
      {children}
    </button>
  );
}

export function ToolbarBadge({ children, accent }) {
  const bgColor = accent ? accentColors[accent] : 'var(--color-accent)';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '20px',
      padding: '2px 6px',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      fontWeight: 500,
      color: '#fff',
      background: bgColor,
      borderRadius: '10px',
    }}>
      {children}
    </span>
  );
}

export function ToolbarSeparator() {
  return (
    <div style={{
      width: '1px',
      height: '20px',
      background: 'var(--border)',
      flexShrink: 0,
    }} />
  );
}

export default Toolbar;
