# Changelog

## 0.15.0

### Features
- Review the **commit message**, not just the code. Expand the details pane
  (the `d` key) and comment on the message — a vague subject, a missing ticket
  reference — with the same `fix-now` / `fix-later` / `consider` actions you use
  everywhere else (press `m` to jump straight to it). A `fix-now` message comment
  blocks approval like any other, and the comment rides back to the caller as
  `{ ..., "target": "commit-message" }` so the agent can rewrite the message.

### Changed
- **Comment where you are.** Every comment now infers its target from the
  surface you start it on — a line or range from the diff, a file from its
  header, the commit message from the details pane (`m`), and the whole
  changeset from a new control on the header (`c`). Hovering a line's right-side
  gutter now reveals a **`+`** — click it to comment that line, or drag from it
  to comment a range — so the most common case has a visible affordance too. The
  comments panel (`n`) is now purely for **managing** what you've
  written — edit, re-action, delete — and no longer doubles as a
  `+ changeset / + commit message / + this file` target picker.
- The change-briefing header now toggles its details on a click **anywhere** in
  the panel (not just the small `details` chevron) — `d` still works, and clicks
  on the add-comment controls or text selections are left alone.

## 0.14.1

### Changed
- Reworked the docs landing page around the review loop — a step-by-step
  "review loop in a Claude session" walkthrough with screenshots (the
  commit-briefing hero, the comment composer with action tiers, the
  send-feedback dialog), and the "In action" animation now runs the full loop:
  the review rejects a change, Claude interprets the fix-now, and a re-review
  card shows the corrected code.

### Removed
- Dropped the speculative FUT-02 / FUT-03 requirements (the optional `prev`-diff
  reference and its read-only preview) from the spec.

## 0.14.0

### Breaking Changes
- The `/moor:moor` slash command has been removed. moor is driven through its CLI, `git difftool`, and anchor's `/anchor:preview` / `/anchor:commit` (plus the session ambient rule) — the command was only a passthrough to the same launcher. If you ran `/moor:moor install-cli`, run `moor install-cli` instead.

## 0.13.0

### Features
- The review verdict is now an explicit action: large **Approve** and **Reject** buttons sit in the top bar's status row. Approve finalizes the review clean (confirming first if changes remain unreviewed, and disabled while `fix-now` comments block the change); Reject opens the feedback dialog, seeding a blocking changeset comment when none exists so a rejection always carries an actionable reason.
- Adding a changeset or file comment is a single action — the "+ comment" control (and the `n` key) opens the comments panel with a comment ready to type, instead of requiring a second "add" click. Blank comments are pruned on close.

### Changed
- New and deleted files now show the content pane at nearly full width, with the empty side reduced to a neutral diagonal cross-hatch rather than an even split against a blank pane. Detection is content-based, so it also applies under `git difftool` (which supplies an empty temp file for the absent side), and the file/preview actions move to whichever side holds content.
- The minimap is hidden for one-sided (new/deleted) files, where every line is a single color. For regular diffs its change bands are scaled to the real content height and offset past the sticky header, so a short file no longer stretches a few changed lines into a full-height block and the bands line up with their rows.

## 0.12.0

### Features
- Markdown and SVG diffs now have a source ↔ rendered preview toggle (a header button, or the `r` key): review a docs change or an icon edit as the rendered result, side by side, instead of reading raw markup. Each side renders inside a sandboxed, CSP-locked iframe, so viewing an attacker-authored file can neither run scripts nor load remote subresources.

## 0.11.0

### Features
- Press `p` to preview the current file in the application your OS has registered for that file type (images, PDFs, etc.). Right-click a change and choose "Preview" for the same action.

### Breaking Changes
- The `i` shortcut (open the current change in your editor) has been removed. It relied on guessing which editor workspace held the file, which was unreliable, and opening a file to edit it cut against letting the agent drive edits. Use `p` to view the file instead.

### Other
- Dropped the `better-sqlite3` native dependency (and the electron-rebuild postinstall step) that the old editor-lookup required — `npm install` no longer compiles a native module.

## 0.10.1

### Changed
- Aligned moor's voice and marketplace metadata with the bridge.ai suite: "the AI" → "Claude" across the pitch, description, and docs, and migrated the suite block to the current schema (group slug, declared `activations`, dropped the derived accent and spoke flag).

## 0.10.0

### Changed
- In the comments panel, Enter now confirms and closes the panel (the "Done"
  action) and Shift+Enter inserts a newline — matching the inline composer, so
  the keyboard contract is the same wherever you type a comment.
- Pressing Space/Enter on a hunk that already has a comment now opens that
  comment for editing instead of stacking a second one.

## 0.9.0

### Changed
- **New comments default to `fix-now`.** A freshly composed comment starts at
  the most actionable tier; `Tab` in the composer down-classifies it
  (`fix-now` → `fix-later` → `consider`), and `Shift+Tab` walks back up.
- **The quit dialog is a send-feedback dialog whenever feedback exists.** Any
  comment — `fix-now` or advisory — routes the close through a dialog that
  reveals every comment with its action and defaults to "Send review feedback"
  rather than "Quit anyway". The plain quit prompt is reserved for closing with
  unreviewed changes and no comments.

### Other
- The action badge styling is centralized in a shared `actionChipStyle` helper
  (no visual change).

## 0.8.0

### Breaking
- **Sidecar `output` schema.** The `rejections` and `notes` arrays are replaced
  by a single `comments` array of `{body, action, file?, startLine?, endLine?}`.
  Callers that read `output.rejections` / `output.notes` must switch to
  `output.comments` (exit code `1` now means one or more `fix-now` comments).

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
- **Clicking a change toggles its reviewed state, and dims it on the spot.** A
  reviewed change dims as soon as you click it — previously the dim appeared
  only after you navigated away — and clicking a reviewed change again marks it
  unreviewed.
- **Two-column details panel.** The expanded details show the commit message on
  the left and the provenance card on the right, with a removed/added
  line-change stat (`−M +N`) and per-file counts as sidebar hover hints.
  Expanding no longer grows the panel's height.
- **Keyboard refinements.** The `d` (details) and `f` (sidebar) toggles are
  case-insensitive, and bare `=` / `-` / `0` control zoom. Letter toggles ignore
  modified keypresses, so `Cmd+F` no longer also toggles the sidebar.

### Fixes
- **Dragging a selection no longer scrolls the diff offscreen.** Selecting text
  and dragging past the edge could auto-scroll the whole view away with no
  scrollbar to recover; the clip containers no longer act as scroll containers.
- **Destructive single-keystroke bindings removed.** Deleting review feedback
  goes through a confirmed control rather than a bare keystroke, protecting
  hard-to-recreate text.

### Other
- In-diff search was removed (it added little, and frees the `n` / `N` keys).
- The user-facing label "hunk" is now "change" throughout the viewer.

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
