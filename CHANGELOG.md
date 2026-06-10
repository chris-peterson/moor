# Changelog

## Unreleased

### Features
- **Comments replace rejections and notes.** Per-hunk rejections and free-text
  review notes are unified into one **comment** concept: a body, a target (the
  whole changeset, a file, or a line range), and an **action** — `fix-now`
  (must fix before shipping — gates the exit code), `fix-later` (must fix, but
  not before this ship), or `consider` (advisory, the default). Comment a line
  range by dragging the new side's line-number gutter, a single line with a long-press,
  the current change with `Space` / `Enter`, or right-click → **Comment**;
  changeset and file comments come from the header controls and the comments
  panel (`n`). Comments can anchor to **any** line, including unchanged context
  lines, so you can flag a bug in neighboring code; each comment bands the lines
  it covers with an action-colored outline. Hunk review state is now binary
  (reviewed / unreviewed).

### Breaking
- **Sidecar `output` schema.** The `rejections` and `notes` arrays are replaced
  by a single `comments` array of `{body, action, file?, startLine?, endLine?}`.
  Callers that read `output.rejections` / `output.notes` must switch to
  `output.comments` (exit code `1` now means one or more `fix-now` comments).

## 0.7.0

### Features
- Redesigned the review header so you can see what you're reviewing at a
  glance: the project, branch, and commit message are visible without
  expanding, and expanding reveals the full commit message plus its details.
  The `→ inputs` / `← outputs` channel labels are gone, replaced by a quieter
  colored gutter and a `status` strip.
- New keyboard shortcuts: `d` / `D` show and hide the change details, `f` / `F`
  show and hide the file sidebar, and `?` opens an in-app shortcuts overlay. A
  keyboard reference page was added to the docs.

## 0.6.1

### Fixes
- **Two-file mode (`moor file1 file2`) now runs the full review.** It rendered
  a bare diff with no review machinery — no hunk counting, no rejection
  capture, no `MOOR_CONTEXT` verdict — so it always exited 3 (EC-04) and
  callers comparing two files got no diff and no feedback channel. Both file
  and directory launches now route through the same `ReviewShell`, so a
  two-file comparison gets hunk counting, rejection-with-reason capture, and a
  real exit code (0/1/2) written to the sidecar.

## 0.6.0

### Features
- **`moor --help` / `-h` / `help`** — Print the usage text and exit zero
  (PD-08). Previously `--help` was passed through to the viewer as a
  comparison path.
- **`moor` with no arguments now prints usage to stderr and exits non-zero**
  instead of launching the viewer with nothing to diff, which sat on the
  Loading screen indefinitely.

## 0.5.0

### Features
- The plugin ships its ambient rules: a SessionStart hook injects
  `rules/*.md` into the session context (re-injected after compaction), so
  the sidecar launch contract — read verdicts from `MOOR_CONTEXT`, never
  launch via raw `git difftool` — holds even when no skill is invoked
  (PD-07).

## 0.4.0

### Features
- moor now installs as a Claude Code plugin from the chris-peterson
  marketplace, with a published docs site at chris-peterson.github.io/moor.
- `moor install-cli` puts moor on your PATH (with zsh tab completion) so you
  can launch it from any directory and drive it as a difftool.
- `moor --version` reports the installed version.
- A `/moor:moor` slash command runs the CLI from inside Claude Code.
- After a plugin update, moor warns at session start when the on-PATH wrapper
  has drifted from the installed version, so you don't run stale code.

### Other
- New favicon, maintainer README, GitHub Pages deploy workflow, and Plugin
  Distribution (PD) requirements in SPEC.md / STATUS.md.
