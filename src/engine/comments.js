// The comment model (CO-01..08): review feedback anchored to the changeset, a
// file, or a line range. A comment carries a body and a target — nothing else.
// There is no severity tier: every comment is feedback the author is expected to
// address, and any comment gates the exit code (EC-02). A reviewer who wants to
// send a note without blocking approves anyway from the send-feedback dialog
// (DD-12).

// Comments share the conflict palette, the same treatment the sidebar (RV-04)
// and the header badges (IM.OUT-03) give a file carrying feedback.
export const COMMENT_COLOR = 'var(--color-conflict)';
export const COMMENT_BG = 'var(--color-conflict-bg)';

// The output-ready projection (IM.OUT-02a): a changeset comment omits `file`; a
// file comment includes `file`; a range comment adds `startLine` / `endLine`; a
// commit-message comment carries `target: 'commit-message'` (and no file) so the
// agent can tell it apart from a plain changeset comment. Internal-only fields
// (id, the render-anchor rows) are dropped.
export function commentToOutput(c) {
  const out = { body: (c.body || '').trim() };
  const t = c.target || {};
  if (t.type === 'commit-message') out.target = 'commit-message';
  if (t.file) out.file = t.file;
  if (t.type === 'range') {
    out.startLine = t.startLine;
    out.endLine = t.endLine;
  }
  return out;
}
