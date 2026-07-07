import React from 'react';
import { actionChipStyle, actionLabel } from '../engine/comments.js';

// IM.IN-02: the change region reads as a changeset header, not a labeled data
// channel. Collapsed it answers where (the location eyebrow) and what (the
// commit-message headline); expanding reveals the rest of the story (commit /
// author / range / body) as an aligned property grid. Location and the beacon
// task are composed from conventionally-labeled `details` rows, so the caller
// contract stays the git-familiar {label, value} array and any missing row
// simply drops out.
const LOCATION_PROJECT_LABELS = ['project', 'repo', 'repository'];
const LOCATION_BRANCH_LABELS = ['branch'];
const TASK_LABELS = ['task', 'beacon task'];
const BODY_LABELS = ['body', 'message', 'description'];
const CONSUMED_LABELS = new Set([...LOCATION_PROJECT_LABELS, ...LOCATION_BRANCH_LABELS, ...TASK_LABELS, ...BODY_LABELS]);
// Low-signal rows suppressed from the provenance grid (e.g. the diff range,
// which restates what the surrounding git context already makes obvious).
const HIDDEN_LABELS = new Set(['range']);

function pickRow(details, labels) {
  const row = details.find(d => labels.includes(String(d.label).toLowerCase()));
  return row ? row.value : null;
}

// Whether expanding the header would reveal anything. A present change title is
// enough on its own: expanding always offers the commit-message annotation
// control (CO-09). Otherwise it's the commit body or any provenance row left
// after the consumed (location/task/body) and hidden (range) labels are removed.
// ReviewShell gates the `d`/`D` keys on this so the keyboard toggle and the
// on-screen expand affordance agree.
export function hasExpandableDetails(context) {
  if (context && context.title) return true;
  const details = (context && Array.isArray(context.details)) ? context.details : [];
  return details.some(d => {
    const l = String(d.label).toLowerCase();
    return BODY_LABELS.includes(l) || (!CONSUMED_LABELS.has(l) && !HIDDEN_LABELS.has(l));
  });
}

export function ContextHeader({
  context,
  channelConfigured,
  fixNowBadges = [],
  viewedChanges = 0,
  totalChanges = 0,
  allViewed = false,
  onNavigateToFixNow,
  detailsExpanded = false,
  onToggleDetails,
  lineStats = null,
  messageComments = [],
  onAddMessageComment,
  onAddChangesetComment,
  commentCount = 0,
  onOpenComments,
  onApprove,
  onReject,
  approveDisabled = false,
}) {
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

  const project = pickRow(details, LOCATION_PROJECT_LABELS);
  const branch = pickRow(details, LOCATION_BRANCH_LABELS);
  const task = pickRow(details, TASK_LABELS);
  const body = pickRow(details, BODY_LABELS);
  const secondary = details.filter(d => {
    const l = String(d.label).toLowerCase();
    return !CONSUMED_LABELS.has(l) && !HIDDEN_LABELS.has(l);
  });
  const hasLocation = !!(project || branch);
  const hasEyebrow = hasLocation || !!task;
  const hasLineStats = !!(lineStats && (lineStats.added > 0 || lineStats.removed > 0));
  const hasGrid = secondary.length > 0 || hasLineStats;
  // Expanding reveals the full message (subject headline + body), provenance, and
  // the commit-message annotation control (CO-09) — the last is available as long
  // as there is a message to annotate, so any input makes the header expandable.
  const hasExpandable = hasInput || !!body || hasGrid;

  const progress = totalChanges > 0 ? viewedChanges / totalChanges : 0;

  // A click anywhere in the change region toggles expand/collapse — a large hit
  // target beyond the small "details" chevron. Skip it when the click lands on an
  // interactive control (its own handler runs; the details button already
  // toggles, the add-comment controls open the composer) or while the user is
  // selecting text.
  const handleRegionClick = (e) => {
    if (e.target.closest('button, a, input, textarea')) return;
    if (window.getSelection && String(window.getSelection())) return;
    if (hasExpandable) onToggleDetails?.();
  };

  return (
    <div style={styles.shell}>
      {hasInput && (
        <div style={styles.changeRegion} onClick={handleRegionClick}>
          <div style={styles.gutter('left')} />
          <div style={styles.changeMain}>
            {hasEyebrow && (
              <div style={styles.eyebrow}>
                {project && <span style={styles.eyebrowProject}>{project}</span>}
                {project && branch && <span style={styles.eyebrowAt}>@</span>}
                {branch && <span style={styles.eyebrowBranch}>{branch}</span>}
                {task && hasLocation && <span style={styles.eyebrowSep}>·</span>}
                {task && <span style={styles.eyebrowTask}>{task}</span>}
              </div>
            )}
            <div style={styles.headline}>{context.title}</div>
            {detailsExpanded && body && (
              <div style={styles.bodyText}>{body}</div>
            )}
            {detailsExpanded && messageComments.length > 0 && (
              <div style={styles.messageComments}>
                {messageComments.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onAddMessageComment?.()}
                    style={styles.messageComment}
                    title="Manage in the comments panel"
                  >
                    <span style={actionChipStyle(c.action, { flexShrink: 0, fontSize: '9px', letterSpacing: '0.06em', padding: '1px 5px' })}>{actionLabel(c.action)}</span>
                    <span style={styles.messageCommentBody}>{(c.body || '').trim() || 'comment on the commit message…'}</span>
                  </button>
                ))}
              </div>
            )}
            <div style={styles.commentActions}>
              {onAddChangesetComment && (
                <button
                  type="button"
                  onClick={() => onAddChangesetComment?.()}
                  style={styles.addCommentChip}
                  title="Comment on the whole changeset (c)"
                >
                  + comment on changeset
                </button>
              )}
              {detailsExpanded && onAddMessageComment && (
                <button
                  type="button"
                  onClick={() => onAddMessageComment?.()}
                  style={styles.addCommentChip}
                  title="Comment on the commit message (m)"
                >
                  + comment on message
                </button>
              )}
            </div>
          </div>

          {hasExpandable && (
            <div style={styles.changeAside}>
              <button
                type="button"
                onClick={() => onToggleDetails?.()}
                style={styles.expandButton(detailsExpanded)}
                aria-expanded={detailsExpanded}
                aria-label={detailsExpanded ? 'Hide details' : 'Show details'}
                title={detailsExpanded ? 'Hide details (d)' : 'Show details (d)'}
              >
                <span>details</span>
                <span style={styles.expandChevron(detailsExpanded)}>▾</span>
              </button>
              {detailsExpanded && hasGrid && (
                <dl style={styles.grid}>
                  {secondary.map(({ label, value }, i) => (
                    <React.Fragment key={`${label}-${i}`}>
                      <dt style={styles.gridLabel}>{label}</dt>
                      <dd style={styles.gridValue}>{value}</dd>
                    </React.Fragment>
                  ))}
                  {hasLineStats && (
                    <>
                      <dt style={styles.gridLabel}>lines</dt>
                      <dd style={styles.gridValue}>
                        <span style={styles.statRemoved}>−{lineStats.removed}</span>
                        {' '}
                        <span style={styles.statAdded}>+{lineStats.added}</span>
                      </dd>
                    </>
                  )}
                </dl>
              )}
            </div>
          )}
        </div>
      )}

      <div style={styles.row(28)}>
        <div style={styles.gutter('right')} />
        <span style={styles.channelLabel('right')}>status</span>

        <div style={styles.badges}>
          {fixNowBadges.map(({ fileIndex, count, name }) => (
            <button
              key={fileIndex}
              type="button"
              onClick={() => onNavigateToFixNow?.(fileIndex)}
              style={styles.badge}
              title={`Jump to ${name}`}
            >
              <span style={styles.badgeCount}>{count}</span>
              <span style={styles.badgeSep}>·</span>
              <span style={styles.badgeName}>{name}</span>
            </button>
          ))}
          {/* The chip manages comments (count → open panel). The changeset add
              affordance lives in the change region above; only when there is no
              change region (no input context) does the chip fall back to being
              the changeset add, so a context-less review keeps one entry point. */}
          {commentCount > 0 ? (
            <button
              type="button"
              onClick={() => onOpenComments?.()}
              style={styles.noteChip}
              title={`${commentCount} comment${commentCount === 1 ? '' : 's'} — click to manage`}
            >
              <span style={styles.noteChipLabel}>comments</span>
              <span style={styles.noteChipCount}>{commentCount}</span>
            </button>
          ) : !hasInput ? (
            <button
              type="button"
              onClick={() => onAddChangesetComment?.()}
              style={styles.noteChip}
              title="Add a changeset comment"
            >
              <span style={styles.noteChipLabel}>+ comment</span>
            </button>
          ) : null}
        </div>

        <div style={styles.rightCluster}>
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
                <span style={{ color: 'var(--color-equal)' }}>all changes viewed</span>
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

          {(onApprove || onReject) && (
            <div style={styles.verdictGroup}>
              <VerdictButton
                kind="approve"
                disabled={approveDisabled}
                onClick={() => onApprove?.()}
                title={approveDisabled ? 'Resolve fix-now comments before approving' : 'Approve — finalize the review clean'}
              >✓ Approve</VerdictButton>
              <VerdictButton
                kind="reject"
                onClick={() => onReject?.()}
                title="Request changes — leave blocking feedback"
              >✗ Reject</VerdictButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// The top-bar verdict controls. Approve carries the "ship it" green; Reject the
// conflict red. Both read as large, deliberate actions — the active close, in
// contrast to quitting the window and letting the exit code be inferred.
function VerdictButton({ kind, children, onClick, disabled, title }) {
  const [hover, setHover] = React.useState(false);
  const color = kind === 'approve' ? 'var(--color-equal)' : 'var(--color-conflict)';
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    padding: '5px 16px',
    borderRadius: '4px',
    border: `1px solid ${color}`,
    cursor: disabled ? 'default' : 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.12s ease, color 0.12s ease, opacity 0.12s ease',
    flexShrink: 0,
  };
  let style;
  if (kind === 'approve') {
    // Filled — the primary, affirmative action.
    style = {
      ...base,
      background: color,
      color: '#fff',
      opacity: disabled ? 0.4 : (hover ? 0.9 : 1),
    };
  } else {
    // Outlined — prominent but secondary; fills on hover.
    style = {
      ...base,
      background: hover ? color : 'transparent',
      color: hover ? '#fff' : color,
    };
  }
  return (
    <button
      type="button"
      style={style}
      title={title}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-disabled={disabled}
    >
      {children}
    </button>
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

  // The change region is a label-less block: a colored gutter marks it as the
  // incoming change context, and the content (eyebrow + headline) speaks for
  // itself — no "INPUTS" channel jargon. Two columns: the message on the left,
  // the details button + provenance card on the right. The right column fills
  // the vertical space beside the message rather than stacking beneath it, so
  // expanding doesn't make the header taller than the message already is.
  changeRegion: {
    position: 'relative',
    paddingLeft: '14px',
    paddingRight: '12px',
    paddingTop: '8px',
    paddingBottom: '10px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '16px',
    // The whole region is a click target for expand/collapse (handleRegionClick).
    cursor: 'pointer',
  },

  changeMain: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },

  changeAside: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
  },

  // Eyebrow: where the change lives. Always visible (location is context you
  // shouldn't have to expand for); the branch carries the input-channel amber.
  eyebrow: {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: '6px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    lineHeight: 1.4,
    minWidth: 0,
  },

  eyebrowProject: {
    color: 'var(--text-primary)',
    fontWeight: 600,
  },

  eyebrowAt: {
    color: 'var(--text-muted)',
  },

  eyebrowBranch: {
    color: 'var(--text-secondary)',
  },

  eyebrowSep: {
    color: 'var(--text-muted)',
  },

  eyebrowTask: {
    color: 'var(--text-primary)',
    fontWeight: 600,
  },

  // Headline: what the change is. The commit-message subject, always visible.
  headline: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    fontWeight: 600,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  // The commit body, revealed on expand as a continuation of the message.
  bodyText: {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: '1px 0 0 0',
  },

  // CO-09: commit-message annotations and the control that adds one, stacked
  // under the message so the feedback reads next to what it's about.
  messageComments: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    marginTop: '3px',
  },

  messageComment: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '6px',
    maxWidth: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    lineHeight: 1.45,
  },

  messageCommentBody: {
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    minWidth: 0,
  },

  // The contextual add-comment controls under the message: changeset (always)
  // and, when expanded, the commit message. Each infers its target from where
  // it sits, so the comments panel is a manager, not a target picker.
  commentActions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    marginTop: '3px',
  },

  addCommentChip: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'transparent',
    border: '1px solid var(--color-accent-border)',
    color: 'var(--color-accent)',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '2px 8px',
    borderRadius: '3px',
    cursor: 'pointer',
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

  // Expanded: the rest of the story — an aligned label/value property grid,
  // a compact card in the right column.
  grid: {
    margin: 0,
    padding: '8px 12px',
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    columnGap: '14px',
    rowGap: '4px',
    alignItems: 'baseline',
    animation: 'details-reveal 0.18s ease',
    minWidth: '220px',
    maxWidth: '460px',
    boxSizing: 'border-box',
  },

  // Line-change stat: matches the diff view's added (right) / removed (left)
  // colors so the counts read the same as the highlighted lines.
  statAdded: {
    color: 'var(--color-right)',
    fontWeight: 600,
  },

  statRemoved: {
    color: 'var(--color-left)',
    fontWeight: 600,
  },

  gridLabel: {
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    margin: 0,
  },

  gridValue: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    lineHeight: 1.5,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    minWidth: 0,
  },

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

  // The comments control (NV-19) reads as a status chip in the accent color —
  // distinct from the red fix-now badges. Doubles as the "+ comment" CTA when
  // there are none yet.
  noteChip: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '6px',
    padding: '2px 8px',
    background: 'var(--color-accent-bg)',
    border: '1px solid var(--color-accent-border)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    cursor: 'pointer',
    borderRadius: '2px',
    flexShrink: 0,
  },

  noteChipLabel: {
    color: 'var(--color-accent)',
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: '9px',
    letterSpacing: '0.1em',
    flexShrink: 0,
  },

  noteChipCount: {
    color: 'var(--text-primary)',
    fontWeight: 700,
  },

  // Progress read-out and the verdict buttons share a right-aligned cluster that
  // spans the remaining columns, so the 1fr gap sits between the badges and it.
  rightCluster: {
    gridColumn: '3 / -1',
    justifySelf: 'end',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },

  verdictGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
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
