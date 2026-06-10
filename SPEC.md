# moor — Modern Diff Viewer

**Version:** 0.2
**Status:** Draft — narrowed scope after implementation 0.1 learnings

---

## Vision

A fast, beautiful diff viewer optimized for `git difftool`. Opens instantly, shows the diff clearly, closes when done. Keyboard-driven, vim-style navigation.

**Not a merge tool.** That's a solved problem (VS Code `--merge`). moor does one thing well: show diffs clearly across changed files in a directory.

---

## Core Workflow

Git launches moor once with all changed files:

```bash
git difftool --dir-diff  # opens moor once with all changes
```

moor opens a sidebar listing changed files. User navigates between files, reviews each diff, and closes when done.

---

## Terminology

| Term | Meaning |
|------|---------|
| **hunk** | A contiguous group of changed lines in a diff — the atomic unit of review. A single-word edit is still a one-line hunk. |
| **file pair** | The left (old) and right (new) versions of a single file |
| **change** | Informal shorthand for hunk; used in user-facing messaging (e.g. "3 changes remaining") |
| **changeset** | The whole diff under review — the target of a changeset-level comment, distinct from a single **change**/hunk |
| **comment** | Review feedback anchored to the changeset, a file, or a line range. Carries a free-text body and an action. Reconciles the former rejections and notes. |
| **action** | A comment's disposition: `fix-now` (must be addressed before shipping — gates the exit code), `fix-later` (must be addressed, but need not block this ship), or `consider` (advisory) |

---

## Requirements

### File Diff View (FD)

- **[FD-01]** The diff viewer shall display two files side-by-side with synchronized scrolling
- **[FD-02]** The diff viewer shall highlight changed lines with distinct colors per source (left vs right)
- **[FD-03]** The diff viewer shall show hybrid word/character differences within changed lines (char-level for single clean edits, word-level when noisy)
- **[FD-04]** The diff viewer shall display line numbers in both panels
- **[FD-05]** The diff viewer shall pair modified lines side-by-side (don't show all deletes then all inserts)
- **[FD-06]** The diff viewer shall display an overview minimap showing location of all changes
- **[FD-07]** The diff viewer shall handle large files efficiently via virtual scrolling
- **[FD-08]** When a binary file is opened, the diff viewer shall display "Binary files differ" instead of garbled text
- **[FD-09]** When a hunk has been reviewed, the diff viewer shall dim it so the eye is drawn to unreviewed changes

### Navigation (NV)

Vim-style, keyboard-first:

- **[NV-01]** When the user presses `j` / `k`, the viewer shall navigate to the next / previous diff hunk
- **[NV-02]** When the user presses `q` or `Escape`, the viewer shall close (exit with code 0)
- **[NV-03]** The viewer shall support scroll wheel and trackpad navigation
- **[NV-04]** When a file is opened, the viewer shall position to the first unreviewed hunk; if every hunk has been reviewed, the viewer shall fall back to the first hunk
- **[NV-05]** When the user presses `u`, the viewer shall mark the current hunk as unreviewed
- **[NV-06]** When the user clicks a hunk, the viewer shall mark it reviewed (equivalent to advancing past it with `j`)
- **[NV-07]** When the user presses Space or Enter, the viewer shall open a comment composer anchored to the current hunk's line range (CO-06). The hunk's review state is unchanged — commenting is orthogonal to review.
- **[NV-08]** When the user presses `i`, the viewer shall open the current hunk's file in the configured editor at the hunk's line number
- **[NV-09]** When the user clicks the currently-selected hunk, the viewer shall mark it as reviewed
- ~~**[NV-10]**~~ Removed — the keyboard rejection-delete (`Shift+R`) dropped; a single keystroke too easily discarded a typed rejection reason. Deleting a rejection is now mouse-only via the context menu (CM-06), which confirms first.
- ~~**[NV-11]**~~ Superseded by CO-06 — the comment composer replaces the reject-reason editor (one composer for all actions; severity/action chosen via the action control, not a separate flow)
- ~~**[NV-12]**~~ Superseded by CO-07 — the persistent comment bar replaces the rejection-reason note
- **[NV-13]** The viewer shall position the viewport when navigating between hunks, per the lettered sub-requirements below.
  - **[NV-13a]** When navigating to a hunk that is already fully visible in the viewport, the viewer shall not scroll.
  - **[NV-13b]** Otherwise the viewer shall scroll so that one line of context above the hunk is visible at the top of the viewport, with the hunk's first line on the second visible row.
  - **[NV-13c]** If the hunk begins at the first line of the file, the viewer shall align the hunk's first line flush with the top of the viewport. If the hunk would fit in the viewport flush to the top but not with the context-above row, the viewer shall align the hunk flush so the bottom is in view. The viewer shall not push the hunk's first line below the second visible row, even when the hunk is taller than the viewport.
  - **[NV-13d]** In-file hunk navigation shall animate the scroll; navigation to a new file shall scroll instantly.
- **[NV-14]** When the user presses `Shift+J`, the viewer shall mark all unreviewed hunks in the current file as reviewed and navigate to the first hunk of the next file. Comments are unaffected.
- **[NV-15]** When the user presses `Shift+K`, the viewer shall navigate to the first hunk of the previous file. The review state of hunks in the current file shall remain unchanged.
- **[NV-16]** When the user invokes "open in editor" (NV-08 or CM-05) and the editor lookup returns no result (file not in any open or recent workspace, or editor CLI not found), the viewer shall display a transient error toast with the failure reason for 3 seconds.
- **[NV-17]** When the user presses `d` (either case), the viewer shall toggle the input details panel (IM.IN-01) — the keyboard companion to IM.IN-01's hover / click-to-expand.
- **[NV-18]** When the user presses `?`, the viewer shall toggle an overlay listing the keyboard shortcuts; `Escape` or a second `?` shall dismiss it.
- **[NV-19]** When the user presses `n` (either case) or activates the comments control, the viewer shall open the comments panel (CO-08).
- **[NV-20]** When the user presses `=` / `+` or `-`, the viewer shall zoom the interface in or out; `0` shall reset the zoom. No modifier key shall be required.

### Directory Diff (DD)

When launched with two directories (`git difftool --dir-diff`):

- **[DD-01]** While in directory diff mode, the viewer shall display a sidebar listing all changed files as a collapsible tree
- **[DD-02]** While in directory diff mode, the viewer shall show file status indicators: modified (M), left-only (L), right-only (R)
- **[DD-03]** When the user clicks a file in the sidebar, the viewer shall display its diff
- **[DD-04]** When the user presses `j` / `k` at the last/first hunk, the viewer shall advance to the next/previous file
- **[DD-05]** While in directory diff mode, the viewer shall track which files have been visited (checkmark in sidebar) — files are a navigation aid, not the primary unit of review
- **[DD-06]** While in directory diff mode, review progress shall count **hunks** reviewed vs total — a file with 10 hunks counts for 10, not 1.
- **[DD-07]** When the user presses `q` or `Escape` in directory diff mode, the viewer shall prompt based on **unreviewed changes**, not unvisited files; always allows closing
- **[DD-08]** The viewer shall ignore common non-content directories (`.git`, `node_modules`, etc.)
- **[DD-09]** While in directory diff mode, the viewer shall display the full file path in the lower-left of the view
- **[DD-10]** While in directory diff mode, the viewer shall allow the user to resize the sidebar width by dragging its right edge
- **[DD-11]** While in directory diff mode, the viewer shall provide a way to hide and show the sidebar
- **[DD-12]** When the user attempts to close with one or more `fix-now` comments, the viewer shall display a quit confirmation dialog summarizing them (per-file count and bodies), with the primary CTA labeled "Send review feedback" that confirms the close. Exit code follows EC-02.
- **[DD-13]** When the user attempts to close with one or more unreviewed hunks and no `fix-now` comments, the viewer shall display a quit confirmation dialog with the existing OK / Cancel actions plus an "Approve anyway" button. "Approve anyway" shall close the viewer with exit code 0 (clean approve) regardless of the unreviewed count.
- **[DD-14]** While a quit confirmation dialog (DD-12, DD-13) is open, the viewer shall support keyboard navigation between dialog buttons via Tab / Shift+Tab and Left / Right arrow keys; Enter shall activate the focused button and Escape shall cancel.
- **[DD-15]** While in directory diff mode, when a left-only file and a right-only file are determined to be a rename or move of the same content (e.g., via `git mv`), the viewer shall display the pair as a single entry showing the old → new path, instead of as separate L and R entries. The entry shall contribute one item to the sidebar and hunk counts (DD-06), and its diff view shall show content changes between the two versions (zero-hunk when the rename is content-identical).
- **[DD-16]** When the user presses `f` (either case), the viewer shall toggle the file sidebar — the keyboard companion to DD-11's collapse / show controls.

### Search Mode (SM)

Search mode was removed — low value and limited in capability. The `n` / `N`
keys it used are repurposed for the comments panel (NV-19).

- ~~**[SM-01]**~~ Removed — in-diff search dropped
- ~~**[SM-02]**~~ Removed
- ~~**[SM-03]**~~ Removed
- ~~**[SM-04]**~~ Removed
- ~~**[SM-05]**~~ Removed — `n` / `N` repurposed for the comments panel (NV-19)
- ~~**[SM-06]**~~ Removed

### Context Menu (CM)

- **[CM-01]** When the user right-clicks a hunk, the viewer shall display a context menu
- **[CM-02]** The context menu shall include "Mark as reviewed" (see NV-06)
- **[CM-03]** The context menu shall include "Mark as unreviewed" (see NV-05)
- **[CM-04]** The context menu shall include "Comment" (compose a comment on the clicked line — see CO-06)
- **[CM-05]** The context menu shall include "Open in editor" (see NV-08)
- **[CM-06]** When the selected hunk has one or more comments, the context menu shall include "Delete comment" (removing the hunk's comment); when a comment has a typed body, selecting it shall confirm before discarding
- ~~**[CM-07]**~~ Retired — "Convert to note" is replaced by the CO-03 action control; lowering a comment's action to `consider` is the successor

### Comments (CO)

A **comment** is review feedback the reviewer leaves for the change's author. Comments reconcile what were two separate concepts — per-hunk rejections and free-text notes — into one, distinguished by **action** rather than by kind.

- **[CO-01]** The viewer shall represent review feedback as **comments**. A comment consists of a free-text `body`, an `action`, and a target. Comments reconcile the former per-hunk rejections (now `fix-now` comments) and free-text notes (now `consider` comments).
- **[CO-02]** A comment's target shall be one of: the overall **changeset** (unanchored), a **file**, or a **line range** within a file. The range may cover changed or unchanged (context) lines, so the reviewer can flag an issue in neighboring code, not only in the diff's hunks.
- **[CO-03]** When a comment is created, the viewer shall default its action to `consider`, and shall let the user set any comment's action to `consider`, `fix-later`, or `fix-now`. `fix-now` denotes feedback that must be addressed before shipping and gates the exit code (EC-02); `fix-later` denotes feedback that must be addressed but need not block this ship; `consider` is advisory. Neither `fix-later` nor `consider` shall affect review completion or the exit code.
- **[CO-04]** When the user presses on the **new (right) side's** line-number gutter, the gesture shall resolve on release: a quick press-and-release on a **changed** line marks it reviewed (NV-06, NV-09), while on an **unchanged (context)** line it opens a single-line comment (a context line has no review state); a press that drags across lines selects the spanned range; and a press held in place past a long-press threshold selects the single line. A range or single-line selection shall open a comment composer (CO-06) anchored to it. The old (left) side's gutter is not a comment affordance — review feedback references the new file. Right-clicking any line offers the same single-line comment via the context menu (CM-04).
- **[CO-05]** The viewer shall provide a control to comment on the overall **changeset** (from the header) and a control to comment on a **file** (from its sidebar entry or file header).
- **[CO-06]** When the user opens a comment composer (Space / Enter on the current hunk per NV-07, a range selection per CO-04, or a changeset / file control per CO-05), the viewer shall present an auto-growing text area with an action control; Enter shall confirm, Shift+Enter shall insert a newline, and Escape shall confirm a non-empty comment or discard an empty one.
- **[CO-07]** While a line-range comment exists (or is being composed), the viewer shall **band** the covered lines — a colored outline spanning the range in the comment's action color — and display a persistent bar at the range's lower edge showing the body and action. Clicking the body shall reopen it for editing, and a delete control shall remove it after a confirmation.
- **[CO-08]** When the user opens the comments panel (the header comments control or the `n` key, either case), the viewer shall list every comment with its target, body, and action; each shall be editable inline, action-changeable, and deletable after a confirmation.

### Review Feedback (RV)

- **[RV-01]** When all hunks have been reviewed, the viewer shall display a transient "Review Complete!" notification
- ~~**[RV-02]**~~ Superseded by IM.OUT-04 (progress now lives in the header's output region)
- ~~**[RV-03]**~~ Superseded by IM.OUT-03 (fix-now badges now live in the header's output region)
- **[RV-04]** While a file has one or more `fix-now` comments, the viewer shall display that file's sidebar entry in red

### Binary Formats (BF)

- **[BF-01]** When a recognized image file is opened, the diff viewer shall display the images side-by-side
- ~~**[BF-02]**~~ Deferred — see FUT-01

### Diff Algorithm (DA)

- **[DA-01]** The diff engine shall compute line-level diffs using Myers algorithm
- **[DA-02]** The diff engine shall compute hybrid intra-line diffs: character-level when a word has a single clean edit, word-level when multiple edits make char highlighting noisy
- **[DA-03]** The diff engine shall ignore trailing whitespace differences when computing diffs
- **[DA-04]** When computing a diff, the diff engine shall detect binary files via null byte check

### Application Shell (AS)

- **[AS-01]** The application shall be an Electron app with a production build (no dev server needed)
- **[AS-02]** The application shall launch from CLI: `moor file1 file2`
- **[AS-03]** The application shall show file paths in the window title
- **[AS-04]** When launched, the application shall open fullscreen (maximized)
- **[AS-05]** The application shall achieve first paint in under 1 second
- **[AS-06]** When closed, the application shall exit with a code indicating review outcome (see EC)
- **[AS-07]** The application shall support `git difftool` integration via `git config`
- **[AS-08]** When launched, the application shall set the window title to `<project> - <context>`, composed per the sub-requirements below.
  - **[AS-08a]** `<project>` shall be `<basename> (<path>)` derived from the git repository toplevel (`git rev-parse --show-toplevel` from the working directory).
  - **[AS-08b]** In `<project>`, `<path>` shall be home-substituted to `~/...` when the path is under the user's home directory.
  - **[AS-08c]** `<context>` shall be the highest-priority available of: (1) the `--title` CLI flag, (2) the `MOOR_TITLE` environment variable, (3) the file paths being diffed (`<left> vs <right>`, AS-03 fallback).
  - **[AS-08d]** When both diffed paths are git-difftool temp directories, `<context>` shall be `git diff` instead of the file-paths form (AS-08c option 3).
  - **[AS-08e]** When only one of `<project>` / `<context>` is available, the title shall be that component alone (no ` - ` separator).
  - **[AS-08f]** The window title shall not be prefixed with `moor —`.

### Exit Codes (EC)

- **[EC-01]** When closed with all hunks reviewed and no `fix-now` comments, the application shall exit with code 0
- **[EC-02]** When closed with one or more `fix-now` comments, the application shall exit with code 1
- **[EC-03]** When closed with one or more unreviewed hunks and no `fix-now` comments, the application shall exit with code 2
- **[EC-04]** When closed before hunk counting completes or before any review interaction, the application shall exit with code 3
- ~~**[EC-05]**~~ Superseded by IM-01 / IM.OUT-01 / IM.OUT-02 (sidecar contract moves to MOOR_CONTEXT)

### Interaction Model (IM)

moor exposes a bidirectional contract with its caller via a JSON file. The caller writes inputs before launch; the viewer writes outputs during and after the review. A context header above the diff view surfaces both sides to the user: the incoming change context on top and review status below, distinguished by a colored left gutter (amber for the change, teal for status) rather than explicit channel labels. When no context channel is configured, a warning banner takes the header's place.

- **[IM-01]** The context channel shall be resolved by checking, in order: the `--context <path>` CLI flag, then the `MOOR_CONTEXT` environment variable. The viewer shall read the file's `input` section on launch and write its `output` section during and after the review.
- **[IM-02]** When no context channel is configured (neither `--context` nor `MOOR_CONTEXT` is set), the viewer shall display a warning banner in the header so the user can investigate the tooling disconnect rather than discovering it at exit time. The banner shall include a hint that the user can pass `--context <path>` to capture review output.

#### Inputs (caller → viewer)

- **[IM.IN-01]** The input section shall contain a `title` string and a `details` array of `{label, value}` rows. The viewer shall render `title` as the change headline and shall reveal the expandable details on hover, click-to-expand, or the `d` / `D` keys (NV-17). The caller decides how content maps to these fields — a single commit, a range of commits, or a non-commit context all use the same shape.
- **[IM.IN-02]** The viewer shall present the change as a label-less header: an always-visible **location** eyebrow (`project @ branch`, composed from the repository and branch detail rows) and the commit-message **headline** (the `title`); when the caller supplies a beacon **task**, it shall be emphasized in the eyebrow. Expanding shall reveal the rest of the change — the full commit-message body (a `body` / `message` / `description` row, rendered as message prose, not a labeled field) and a provenance grid of the remaining `details` rows, excluding low-signal rows the viewer suppresses (e.g. `range`). The layout shall degrade gracefully when a source row is absent.

#### Outputs (viewer → caller)

- **[IM.OUT-01]** The viewer shall write review state to the context file's `output` section continuously, flushing after every hunk review-state change (review, unreview) and every comment change (add, edit, action change, delete). On exit, the file shall reflect the final state.
- **[IM.OUT-02a]** The output section shall always include `reviewer` (string, from `git config user.name`) and `comments` (array). Each comment is `{ body, action, file?, startLine?, endLine? }`: a changeset comment omits `file`; a file comment includes `file`; a line-range comment includes `file`, `startLine`, and `endLine`. `action` is one of `fix-now`, `fix-later`, `consider`. The calling agent interprets the comments.
- **[IM.OUT-02b]** The output section shall include `exitCode` (number) only after the viewer exits; its presence signals that the review has been finalized, while its absence signals an in-progress review whose comments may still change.
- **[IM.OUT-03]** While `fix-now` comments exist, the viewer shall display one badge per affected file in the header's output region, each showing the file's `fix-now` count; when the user clicks a badge, the viewer shall navigate to that file's first `fix-now` comment.
- **[IM.OUT-04]** The viewer shall display review progress ("X of Y changes viewed") in the header's output region.
- **[IM.OUT-05]** While in single-file mode (no directory sidebar), the viewer shall display an equivalent review-progress footer at the bottom of the view: a progress bar with "X of Y changes viewed" (collapsing to "All changes viewed · q to close" when complete) and a `fix-now` count when such comments exist.
- ~~**[IM.OUT-06]**~~ Superseded by IM.OUT-02a — `comments[]` subsumes the former `notes[]` (a note is now a `consider` comment).

### User Preferences (UP)

Fixed for now, configurable later:

- **[UP-01]** The application shall render diff text in JetBrains Mono at a 13px base size, falling back to the platform monospace font when the webfont is unavailable
- **[UP-02]** The application shall render tabs as 4 spaces (display only)
- **[UP-03]** The application shall use a dark color scheme with distinct hues per source
- **[UP-04]** The application shall never truncate or wrap long lines. The entire content of every line on both sides shall be reachable via horizontal scrolling.
- **[UP-05]** The diff viewer shall render the focused (active) diff row at 15px for emphasis, while all other rows render at the 13px base size (UP-01).

### Plugin Distribution (PD)

moor ships as a Claude Code plugin. These requirements cover the surfaces that make it installable and discoverable alongside its peers.

- **[PD-01]** The launcher shall accept `--version` (`-v`) and print `moor <version>`, reading the version from `.claude-plugin/plugin.json` (the single source of truth).
- **[PD-02]** The launcher shall provide an `install-cli` subcommand that writes a wrapper to `~/.local/bin/moor` (overridable with `--dir <path>`) which execs the plugin's launcher, and shall warn when the target directory is not on `$PATH`.
- **[PD-03]** `install-cli` shall also install zsh tab completion.
- **[PD-04]** The launcher shall provide a `completions zsh` subcommand that installs the zsh completion to `~/.zsh/completions/_moor` (configuring `fpath` and `compinit` in `~/.zshrc` when absent), or prints it to stdout when given `--print`.
- **[PD-05]** On each Claude Code session start, the plugin shall compare the on-PATH `moor` wrapper's reported version against `.claude-plugin/plugin.json`; when they differ, it shall instruct the user to re-run `install-cli`. When `moor` is not on `$PATH`, the check shall be silent.
- **[PD-06]** The plugin shall expose a `/moor:moor` slash command that forwards its arguments to the launcher.
- **[PD-07]** On each Claude Code session start (all sources, including after context compaction), the plugin shall emit its ambient rules (`rules/*.md`) into the session context, so the sidecar launch contract (IM.OUT-*) holds even when no skill is invoked.
- **[PD-08]** The launcher shall accept `--help` (`-h`, `help`) and print the usage text to stdout, exiting zero. When invoked with no arguments, the launcher shall print the same usage text to stderr and exit non-zero rather than launching the viewer with nothing to diff.

---

## Out of Scope

- 3-way merge (use `code --merge`)
- Configuration UI / settings dialog
- Remote file access
- Printing
- Plugin system
- Syntax highlighting (future consideration)

---

## Git Integration

```bash
# Install
git config --global diff.tool moor
git config --global difftool.moor.cmd '/path/to/moor "$LOCAL" "$REMOTE"'

# Usage
git difftool              # review changes file-by-file
git difftool --dir-diff   # review all changes in a single session
git difftool HEAD~3       # compare against 3 commits ago
git difftool branch       # compare against a branch
```

---

## Deferred (Future Versions)

- **[FUT-01]** (→ BF) Where a file has both a text and a visual representation (e.g., SVG, Markdown), the diff viewer shall provide a toggle between source diff and rendered preview
- **[FUT-02]** (→ IM) The input section may include an optional `prev` reference describing a previous diff, using the same shape as the primary input (`left` / `right` paths plus optional `title` / `details`, nestable). Speculative — no caller emits `prev` yet; revisit once anchor's wrapper supplies it.
- **[FUT-03]** (→ RO) `[prev]` read-only preview of the previous diff: render the link when `prev` is present, open the referenced diff read-only (commenting / open-in-editor disabled, no output writes), and return to the live review on `Escape` or a back affordance. Speculative companion to FUT-02; not yet implemented.
- **Syntax highlighting** — language-aware coloring in diff panels
- **Configurable preferences** — font, colors, ignored patterns
