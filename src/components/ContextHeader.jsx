import React, { useState } from 'react';

export function ContextHeader({
  context,
  channelConfigured,
  rejectionBadges = [],
  viewedChanges = 0,
  totalChanges = 0,
  allViewed = false,
  onNavigateToRejection,
}) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  if (!channelConfigured) {
    return (
      <div style={styles.shell}>
        <div style={styles.row(40)}>
          <div style={styles.gutter('warning')} />
          <span style={styles.channelLabel('warning')}>
            <span style={styles.arrow}>⚠</span>
            <span>channel</span>
          </span>
          <div style={styles.warningText}>
            <div style={styles.warningHeadline}>
              no context channel configured
              <span style={styles.warningSub}> · review output will not be captured</span>
            </div>
            <div style={styles.warningHint}>
              pass <code style={styles.warningCode}>--context &lt;path&gt;</code>
              {' '}or set{' '}
              <code style={styles.warningCode}>MOOR_CONTEXT</code>{' '}
              to capture review feedback
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasInput = !!(context && context.title);
  const details = (context && Array.isArray(context.details)) ? context.details : [];
  const hasDetails = details.length > 0;

  const progress = totalChanges > 0 ? viewedChanges / totalChanges : 0;

  return (
    <div style={styles.shell}>
      {hasInput && (
        <div
          style={{
            ...styles.row(28),
            borderBottom: '1px solid var(--border)',
            ...(detailsExpanded && hasDetails ? { paddingTop: '8px', paddingBottom: '10px', alignItems: 'start' } : null),
          }}
        >
          <div style={styles.gutter('left')} />
          <span style={styles.channelLabel('left')}>
            <span style={styles.arrow}>→</span>
            <span>inputs</span>
          </span>
          <div style={styles.inputTitle}>{context.title}</div>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setDetailsExpanded(v => !v)}
              style={styles.expandButton(detailsExpanded)}
              aria-expanded={detailsExpanded}
              aria-label={detailsExpanded ? 'Hide details' : 'Show details'}
            >
              <span>details</span>
              <span style={styles.expandChevron(detailsExpanded)}>▾</span>
            </button>
          )}
          {detailsExpanded && hasDetails && (
            <dl style={styles.detailsList}>
              {details.map(({ label, value }, i) => (
                <div key={`${label}-${i}`} style={styles.detailsItem}>
                  <dt style={styles.detailsLabel}>{label}</dt>
                  <dd style={styles.detailsValue}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <div style={styles.row(28)}>
        <div style={styles.gutter('right')} />
        <span style={styles.channelLabel('right')}>
          <span style={styles.arrow}>←</span>
          <span>outputs</span>
        </span>

        <div style={styles.badges}>
          {rejectionBadges.map(({ fileIndex, count, name }) => (
            <button
              key={fileIndex}
              type="button"
              onClick={() => onNavigateToRejection?.(fileIndex)}
              style={styles.badge}
              title={`Jump to ${name}`}
            >
              <span style={styles.badgeCount}>{count}</span>
              <span style={styles.badgeSep}>·</span>
              <span style={styles.badgeName}>{name}</span>
            </button>
          ))}
        </div>

        <div style={styles.progressGroup}>
          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${progress * 100}%`,
                background: allViewed ? 'var(--color-equal)' : 'var(--color-right)',
              }}
            />
          </div>
          <span style={styles.progressText}>
            {allViewed ? (
              <span style={{ color: 'var(--color-equal)' }}>all changes viewed · q to close</span>
            ) : totalChanges > 0 ? (
              <>
                {viewedChanges}
                <span style={styles.progressTextDim}> of {totalChanges} changes</span>
              </>
            ) : (
              <span style={styles.progressTextDim}>no changes</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

const channelColor = (side) =>
  side === 'left' ? 'var(--color-left)'
  : side === 'right' ? 'var(--color-right)'
  : 'var(--color-conflict)';

const styles = {
  shell: {
    background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-mono)',
    flexShrink: 0,
  },

  row: (minHeight) => ({
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'auto auto 1fr auto',
    alignItems: 'center',
    columnGap: '12px',
    paddingLeft: '14px',
    paddingRight: '12px',
    minHeight: `${minHeight}px`,
  }),

  gutter: (side) => ({
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '3px',
    background: channelColor(side),
    opacity: 0.8,
  }),

  channelLabel: (side) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: channelColor(side),
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    flexShrink: 0,
    userSelect: 'none',
    paddingTop: '1px',
  }),

  arrow: {
    fontSize: '13px',
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: 0,
  },

  inputTitle: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    lineHeight: 1.4,
  },

  expandButton: (expanded) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    border: '1px solid var(--border)',
    background: expanded ? 'var(--bg-hover)' : 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: '3px',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  }),

  expandChevron: (expanded) => ({
    display: 'inline-block',
    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.18s ease',
    fontSize: '10px',
    lineHeight: 1,
  }),

  detailsList: {
    gridColumn: '2 / -1',
    margin: '4px 0 0 0',
    padding: '10px 14px',
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    animation: 'details-reveal 0.18s ease',
  },

  detailsItem: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr',
    columnGap: '14px',
    fontSize: '12px',
    lineHeight: 1.5,
  },

  detailsLabel: {
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    paddingTop: '2px',
    margin: 0,
  },

  detailsValue: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  badges: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
    overflow: 'hidden',
    flexWrap: 'nowrap',
  },

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '2px 8px',
    background: 'var(--color-conflict-bg)',
    border: '1px solid var(--color-conflict)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    cursor: 'pointer',
    borderRadius: '2px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  badgeCount: {
    color: 'var(--color-conflict)',
    fontWeight: 700,
  },

  badgeSep: {
    color: 'var(--text-muted)',
  },

  badgeName: {
    color: 'var(--text-primary)',
  },

  progressGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },

  progressTrack: {
    width: '128px',
    height: '3px',
    background: 'var(--border)',
    borderRadius: '1.5px',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: '1.5px',
    transition: 'width 0.2s ease, background 0.2s ease',
  },

  progressText: {
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
  },

  progressTextDim: {
    color: 'var(--text-muted)',
  },

  warningText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    gridColumn: '3 / -1',
  },

  warningHeadline: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.01em',
  },

  warningSub: {
    color: 'var(--text-secondary)',
    fontWeight: 400,
  },

  warningHint: {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
  },

  warningCode: {
    background: 'var(--bg-deep)',
    color: 'var(--color-accent)',
    padding: '1px 5px',
    borderRadius: '2px',
    fontFamily: 'var(--font-mono)',
    fontSize: '10.5px',
    border: '1px solid var(--border)',
  },
};

export default ContextHeader;
