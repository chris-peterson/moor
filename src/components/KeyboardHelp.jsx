import React from 'react';

// NV-18: an in-app cheatsheet so the shortcuts are reachable without leaving
// the viewer. Mirrors docs/keyboard.md; keep the two in sync when bindings move.
const GROUPS = [
  {
    title: 'Review',
    rows: [
      [['j', 'k'], 'Next / previous change'],
      [['⇧J'], 'Mark file reviewed, next file'],
      [['⇧K'], 'Previous file'],
      [['u'], 'Mark current change unreviewed'],
      [['p'], 'Preview current file in its registered app'],
    ],
  },
  {
    title: 'Comment',
    rows: [
      [['Space', '⏎'], 'Comment on current change'],
      [['drag'], 'Drag the line gutter to comment on a range'],
      [['Tab', '⇧Tab'], 'Cycle action while composing (fix now → fix later → consider)'],
      [['c'], 'Comment on the whole changeset'],
      [['m'], 'Comment on the commit message'],
      [['n'], 'Manage comments (edit / set action / delete)'],
    ],
  },
  {
    title: 'Move',
    rows: [
      [['↑', '↓'], 'Scroll vertically'],
      [['←', '→'], 'Scroll horizontally'],
    ],
  },
  {
    title: 'View',
    rows: [
      [['d'], 'Toggle details'],
      [['f'], 'Toggle file sidebar'],
      [['r'], 'Toggle source / rendered (Markdown, SVG)'],
      [['t'], 'Compare a binary-detected file as text'],
      [['=', '-'], 'Zoom in / out (0 resets)'],
      [['?'], 'Toggle this help'],
    ],
  },
  {
    title: 'Close',
    rows: [
      [['q', 'Esc'], 'Close (prompts if changes remain)'],
    ],
  },
];

export function KeyboardHelp({ onClose }) {
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div style={styles.header}>
          <span style={styles.title}>Keyboard shortcuts</span>
          <span style={styles.dismiss}>Esc or ? to close</span>
        </div>
        <div style={styles.grid}>
          {GROUPS.map((group) => (
            <div key={group.title} style={styles.group}>
              <div style={styles.groupTitle}>{group.title}</div>
              {group.rows.map(([keys, label]) => (
                <div key={label} style={styles.row}>
                  <span style={styles.keys}>
                    {keys.map((k) => (
                      <kbd key={k} style={styles.kbd}>{k}</kbd>
                    ))}
                  </span>
                  <span style={styles.label}>{label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    animation: 'details-reveal 0.15s ease',
  },

  panel: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
    padding: '20px 24px',
    maxWidth: '720px',
    width: 'calc(100vw - 80px)',
  },

  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border)',
  },

  title: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    fontSize: '15px',
    fontWeight: 700,
  },

  dismiss: {
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    columnGap: '40px',
    rowGap: '18px',
  },

  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  groupTitle: {
    color: 'var(--color-left)',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '2px',
  },

  row: {
    display: 'grid',
    gridTemplateColumns: '92px 1fr',
    columnGap: '12px',
    alignItems: 'center',
  },

  keys: {
    display: 'inline-flex',
    gap: '4px',
  },

  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    padding: '2px 6px',
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: 600,
  },

  label: {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
    fontSize: '12.5px',
  },
};

export default KeyboardHelp;
