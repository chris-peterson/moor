// The comment model (CO-01..08): review feedback anchored to the changeset, a
// file, or a line range, distinguished by an `action`. The action vocabulary is
// the review-sidecar contract's severity taxonomy (see docs/review-sidecar-
// contract.md), aligned with the wider agent-diff ecosystem (diffity's
// must-fix / suggestion / nit / question). This module is the single home for
// that vocabulary, its color/label mapping, and the output projection.

// Ascending severity: the reviewer escalates question → nit → suggestion →
// must-fix (Tab down-classifies the other way).
export const ACTIONS = ['question', 'nit', 'suggestion', 'must-fix'];
// Severity order, most-actionable first — the left-to-right order the composer
// renders the action buttons in (must-fix → suggestion → nit → question).
export const ACTIONS_BY_SEVERITY = ['must-fix', 'suggestion', 'nit', 'question'];
// New comments start at the most actionable tier; the reviewer down-classifies
// (Tab in the composer) toward advisory as warranted.
export const DEFAULT_ACTION = 'must-fix';

// `must-fix` is the only action that gates the exit code (EC-01/02) and earns
// the red treatment / header badges. suggestion / nit / question are advisory.
export function isBlocking(action) {
  return action === 'must-fix';
}

// Cycle order matches the escalation the action control walks through:
// question → nit → suggestion → must-fix → question.
export function cycleAction(action) {
  const i = ACTIONS.indexOf(action);
  return ACTIONS[(i + 1) % ACTIONS.length];
}

// The reverse walk — down-classification toward advisory:
// must-fix → suggestion → nit → question → must-fix.
export function cycleActionDown(action) {
  const i = ACTIONS.indexOf(action);
  return ACTIONS[(i - 1 + ACTIONS.length) % ACTIONS.length];
}

export function actionLabel(action) {
  switch (action) {
    case 'must-fix': return 'must fix';
    case 'suggestion': return 'suggestion';
    case 'nit': return 'nit';
    default: return 'question';
  }
}

// Reuse the existing palette: conflict red for the blocker, accent blue for a
// suggestion, the amber `left` hue for a nit, teal `right` for a question.
export function actionColor(action) {
  switch (action) {
    case 'must-fix': return 'var(--color-conflict)';
    case 'suggestion': return 'var(--color-accent)';
    case 'nit': return 'var(--color-left)';
    default: return 'var(--color-right)';
  }
}

export function actionBg(action) {
  switch (action) {
    case 'must-fix': return 'var(--color-conflict-bg)';
    case 'suggestion': return 'var(--color-accent-bg)';
    case 'nit': return 'var(--color-left-bg)';
    default: return 'var(--color-right-bg)';
  }
}

export function actionBorder(action) {
  return action === 'suggestion' ? 'var(--color-accent-border)' : actionColor(action);
}

// The action badge shared across the composer, the comment bars, the comments
// panel, and the send-feedback dialog: base typography plus the action's color
// triad (background / text / border). Callers spread `overrides` for per-site
// size, padding, cursor, or state (e.g. the composer's unselected look).
export function actionChipStyle(action, overrides = {}) {
  return {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '2px 8px',
    borderRadius: '3px',
    background: actionBg(action),
    color: actionColor(action),
    border: `1px solid ${actionColor(action)}`,
    ...overrides,
  };
}

// The output-ready projection (IM.OUT-02a): a changeset comment omits `file`; a
// file comment includes `file`; a range comment adds `startLine` / `endLine`; a
// commit-message comment carries `target: 'commit-message'` (and no file) so the
// agent can tell it apart from a plain changeset comment. Internal-only fields
// (id, the render-anchor rows) are dropped.
export function commentToOutput(c) {
  const out = { body: (c.body || '').trim(), action: c.action };
  const t = c.target || {};
  if (t.type === 'commit-message') out.target = 'commit-message';
  if (t.file) out.file = t.file;
  if (t.type === 'range') {
    out.startLine = t.startLine;
    out.endLine = t.endLine;
  }
  return out;
}
