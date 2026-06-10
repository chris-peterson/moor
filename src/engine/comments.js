// The comment model (CO-01..08): review feedback anchored to the changeset, a
// file, or a line range, distinguished by an `action`. Comments reconcile the
// former per-hunk rejections (now `fix-now`) and free-text notes (now
// `consider`). This module is the single home for the action vocabulary, its
// color/label mapping, and the output projection.

export const ACTIONS = ['consider', 'fix-later', 'fix-now'];
export const DEFAULT_ACTION = 'consider';

// `fix-now` is the only action that gates the exit code (EC-01/02) and earns
// the red treatment / header badges. `fix-later` and `consider` are advisory.
export function isBlocking(action) {
  return action === 'fix-now';
}

// Cycle order matches the escalation the action control walks through:
// consider → fix-later → fix-now → consider.
export function cycleAction(action) {
  const i = ACTIONS.indexOf(action);
  return ACTIONS[(i + 1) % ACTIONS.length];
}

export function actionLabel(action) {
  switch (action) {
    case 'fix-now': return 'fix now';
    case 'fix-later': return 'fix later';
    default: return 'consider';
  }
}

// Reuse the existing palette: conflict red for the blocker, the amber `left`
// hue for fix-later, accent blue for the advisory tier.
export function actionColor(action) {
  switch (action) {
    case 'fix-now': return 'var(--color-conflict)';
    case 'fix-later': return 'var(--color-left)';
    default: return 'var(--color-accent)';
  }
}

export function actionBg(action) {
  switch (action) {
    case 'fix-now': return 'var(--color-conflict-bg)';
    case 'fix-later': return 'var(--color-left-bg)';
    default: return 'var(--color-accent-bg)';
  }
}

export function actionBorder(action) {
  return action === 'consider' ? 'var(--color-accent-border)' : actionColor(action);
}

// The output-ready projection (IM.OUT-02a): a changeset comment omits `file`; a
// file comment includes `file`; a range comment adds `startLine` / `endLine`.
// Internal-only fields (id, the render-anchor rows) are dropped.
export function commentToOutput(c) {
  const out = { body: (c.body || '').trim(), action: c.action };
  const t = c.target || {};
  if (t.file) out.file = t.file;
  if (t.type === 'range') {
    out.startLine = t.startLine;
    out.endLine = t.endLine;
  }
  return out;
}
