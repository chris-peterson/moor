# kdiff4 — Modern Diff Viewer

**Version:** 0.2
**Status:** Draft — narrowed scope after implementation 0.1 learnings

---

## Vision

A fast, beautiful diff viewer optimized for `git difftool`. Opens instantly, shows the diff clearly, closes when done. Keyboard-driven, vim-style navigation.

**Not a merge tool.** That's a solved problem (VS Code `--merge`, kdiff3). kdiff4 does one thing well: show diffs clearly across changed files in a directory.

---

## Core Workflow

Git launches kdiff4 once with all changed files:

```bash
git difftool --dir-diff  # opens kdiff4 once with all changes
```

kdiff4 opens a sidebar listing changed files. User navigates between files, reviews each diff, and closes when done.

---

## Terminology

| Term | Meaning |
|------|---------|
| **hunk** | A contiguous group of changed lines in a diff — the atomic unit of review. A single-word edit is still a one-line hunk. |
| **file pair** | The left (old) and right (new) versions of a single file |
| **change** | Informal shorthand for hunk; used in user-facing messaging (e.g. "3 changes remaining") |

---

## Requirements

### File Diff View (FD)

- **[FD-1]** The diff viewer shall display two files side-by-side with synchronized scrolling
- **[FD-2]** The diff viewer shall highlight changed lines with distinct colors per source (left vs right)
- **[FD-3]** The diff viewer shall show hybrid word/character differences within changed lines (char-level for single clean edits, word-level when noisy)
- **[FD-4]** The diff viewer shall display line numbers in both panels
- **[FD-5]** The diff viewer shall pair modified lines side-by-side (don't show all deletes then all inserts)
- **[FD-6]** The diff viewer shall display an overview minimap showing location of all changes
- **[FD-7]** The diff viewer shall handle large files efficiently via virtual scrolling
- **[FD-8]** When a binary file is opened, the diff viewer shall display "Binary files differ" instead of garbled text
- **[FD-9]** When a hunk has been reviewed, the diff viewer shall dim it so the eye is drawn to unreviewed changes

### Navigation (NV)

Vim-style, keyboard-first:

- **[NV-1]** When the user presses `j` / `k`, the viewer shall navigate to the next / previous diff hunk
- **[NV-2]** When the user presses `q` or `Escape`, the viewer shall close (exit with code 0)
- **[NV-3]** The viewer shall support scroll wheel and trackpad navigation
- **[NV-4]** When a file is opened, the viewer shall position to the first non-reviewed, non-rejected hunk; if every hunk has been reviewed or rejected, the viewer shall fall back to the first hunk
- **[NV-5]** When the user presses `u`, the viewer shall mark the current hunk as unreviewed
- **[NV-6]** When the user clicks a hunk, the viewer shall mark it reviewed (equivalent to advancing past it with `j`)
- **[NV-7]** When the user presses `r`, the viewer shall reject the current hunk (visually distinct from reviewed; excluded from "unreviewed" counts)
- **[NV-8]** When the user presses `i`, the viewer shall open the current hunk's file in the configured editor at the hunk's line number
- **[NV-9]** When the user clicks the currently-selected hunk, the viewer shall mark it as reviewed
- **[NV-10]** When the user presses `R` (shift+r), the viewer shall unreject the current hunk (restoring it to unreviewed)
- **[NV-11]** When the user presses `r`, the viewer shall display an inline text area for an optional rejection reason; Enter confirms, Shift+Enter inserts a newline, Escape confirms without a reason
- **[NV-12]** While a rejected hunk has a rejection reason, the viewer shall display the reason as a persistent note below the hunk; clicking the note shall open it for editing, and clicking the ✕ shall remove the note (the hunk remains rejected)
- **[NV-13]** When navigating to a hunk, the viewer shall position the hunk so its first line is visible. If scrolling is required, the viewer shall align the top of the hunk to the top of the viewport — including when the hunk is taller than the viewport, so the start of the change is always shown.
- **[NV-14]** When the user presses `Shift+J`, the viewer shall mark all unreviewed hunks in the current file as reviewed and navigate to the first hunk of the next file. Rejected hunks remain rejected.

### Directory Diff (DD)

When launched with two directories (`git difftool --dir-diff`):

- **[DD-1]** While in directory diff mode, the viewer shall display a sidebar listing all changed files as a collapsible tree
- **[DD-2]** While in directory diff mode, the viewer shall show file status indicators: modified (M), left-only (L), right-only (R)
- **[DD-3]** When the user clicks a file in the sidebar, the viewer shall display its diff
- **[DD-4]** When the user presses `j` / `k` at the last/first hunk, the viewer shall advance to the next/previous file
- **[DD-5]** While in directory diff mode, the viewer shall track which files have been visited (checkmark in sidebar) — files are a navigation aid, not the primary unit of review
- **[DD-6]** While in directory diff mode, the progress bar and status messaging shall track **hunks** reviewed vs total — a file with 10 hunks counts for 10, not 1
- **[DD-7]** When the user presses `q` or `Escape` in directory diff mode, the viewer shall prompt based on **unreviewed changes**, not unvisited files; always allows closing
- **[DD-8]** The viewer shall ignore common non-content directories (`.git`, `node_modules`, etc.)
- **[DD-9]** While in directory diff mode, the viewer shall display the full file path in the lower-left of the view
- **[DD-10]** While in directory diff mode, the viewer shall allow the user to resize the sidebar width by dragging its right edge
- **[DD-11]** While in directory diff mode, the viewer shall provide a way to hide and show the sidebar
- **[DD-12]** When the user attempts to close with one or more rejected hunks, the viewer shall display a quit confirmation dialog summarizing the rejections (per-file count and reasons), with the primary CTA labeled "Send review feedback" that confirms the close. Exit code follows EC-2.
- **[DD-13]** When the user attempts to close with one or more unreviewed hunks and no rejected hunks, the viewer shall display a quit confirmation dialog with the existing OK / Cancel actions plus an "Approve anyway" button. "Approve anyway" shall close the viewer with exit code 0 (clean approve) regardless of the unreviewed count.
- **[DD-14]** While a quit confirmation dialog (DD-12, DD-13) is open, the viewer shall support keyboard navigation between dialog buttons via Tab / Shift+Tab and Left / Right arrow keys; Enter shall activate the focused button and Escape shall cancel.

### Search Mode (SM)

- **[SM-1]** When the user presses `Cmd+F`, the viewer shall enter search mode with a text input field
- **[SM-2]** While in search mode, the viewer shall match content across all lines, not just changed lines within hunks
- **[SM-3]** While in search mode in directory diff, the viewer shall temporarily hide files that contain no matches
- **[SM-4]** While in search mode, the viewer shall dim non-matching hunks
- **[SM-5]** While in search mode, when the user presses `n` / `N`, the viewer shall jump to the next / previous match
- **[SM-6]** While in search mode, when the user presses `Escape`, the viewer shall exit search mode and restore the normal view

### Context Menu (CM)

- **[CM-1]** When the user right-clicks a hunk, the viewer shall display a context menu
- **[CM-2]** The context menu shall include "Mark as reviewed" (see NV-6)
- **[CM-3]** The context menu shall include "Mark as unreviewed" (see NV-5)
- **[CM-4]** The context menu shall include "Reject" (see NV-7)
- **[CM-5]** The context menu shall include "Open in editor" (see NV-8)
- **[CM-6]** When the selected hunk is rejected, the context menu shall include "Unreject" (see NV-10)

### Review Feedback (RV)

- **[RV-1]** When all hunks have been reviewed, the viewer shall display a transient "Review Complete!" notification
- **[RV-2]** While in directory diff mode, the bottom bar shall display a progress bar and "X of Y changes viewed" status
- **[RV-3]** While rejected hunks exist, the bottom bar shall display one badge per rejected file with a rejection count, and when the user clicks a badge, the viewer shall navigate to that file's first rejected hunk
- **[RV-4]** While a file has one or more rejected hunks, the viewer shall display that file's sidebar entry in red

### Binary Formats (BF)

- **[BF-1]** When a recognized image file is opened, the diff viewer shall display the images side-by-side
- ~~**[BF-2]**~~ Deferred — see FUT-1

### Diff Algorithm (DA)

- **[DA-1]** The diff engine shall compute line-level diffs using Myers algorithm
- **[DA-2]** The diff engine shall compute hybrid intra-line diffs: character-level when a word has a single clean edit, word-level when multiple edits make char highlighting noisy
- **[DA-3]** The diff engine shall ignore trailing whitespace differences when computing diffs
- **[DA-4]** When computing a diff, the diff engine shall detect binary files via null byte check

### Application Shell (AS)

- **[AS-1]** The application shall be an Electron app with a production build (no dev server needed)
- **[AS-2]** The application shall launch from CLI: `kdiff4 file1 file2`
- **[AS-3]** The application shall show file paths in the window title
- **[AS-4]** When launched, the application shall open fullscreen (maximized)
- **[AS-5]** The application shall achieve first paint in under 1 second
- **[AS-6]** When closed, the application shall exit with a code indicating review outcome (see EC)
- **[AS-7]** The application shall support `git difftool` integration via `git config`
- **[AS-8]** When launched, the application shall set the window title to `<project> - <context>`, where `<project>` is `<basename> (<path>)` from the git repository toplevel (`git rev-parse --show-toplevel` from the working directory), with `<path>` home-substituted to `~/...` when applicable, and `<context>` is the highest-priority available of: (1) the `--title` CLI flag, (2) the `KDIFF4_TITLE` environment variable, (3) the file paths being diffed (`<left> vs <right>`, AS-3 fallback), or `git diff` when both paths are git-difftool temp directories. When only one component is available, the title shall be that component alone. The window title shall not be prefixed with `kdiff4 —`.

### Exit Codes (EC)

- **[EC-1]** When closed with all hunks reviewed and none rejected, the application shall exit with code 0
- **[EC-2]** When closed with one or more rejected hunks, the application shall exit with code 1
- **[EC-3]** When closed with one or more unreviewed hunks, the application shall exit with code 2
- **[EC-4]** When closed before hunk counting completes or before any review interaction, the application shall exit with code 3
- **[EC-5]** The launcher shall write a JSON sidecar file to `~/.cache/kdiff4/review-result-<PID>` (unique per invocation). If `KDIFF4_REVIEW_RESULT` is already set by the caller, the launcher shall respect it. The sidecar shall contain `exitCode` (number), `reviewer` (string, from `git config user.name`), and `rejections` (array of objects with `file`, `hunk`, `line`, and `reason` fields)

### User Preferences (UP)

Fixed for now, configurable later:

- **[UP-1]** The application shall use system monospace font at 13px
- **[UP-2]** The application shall render tabs as 4 spaces (display only)
- **[UP-3]** The application shall use a dark color scheme with distinct hues per source
- **[UP-4]** The application shall never truncate or wrap long lines. The entire content of every line on both sides shall be reachable via horizontal scrolling.

---

## Out of Scope

- 3-way merge (use `code --merge` or kdiff3)
- Configuration UI / settings dialog
- Remote file access
- Printing
- Plugin system
- Syntax highlighting (future consideration)

---

## Git Integration

```bash
# Install
git config --global diff.tool kdiff4
git config --global difftool.kdiff4.cmd '/path/to/kdiff4 "$LOCAL" "$REMOTE"'

# Usage
git difftool              # review changes file-by-file
git difftool --dir-diff   # review all changes in a single session
git difftool HEAD~3       # compare against 3 commits ago
git difftool branch       # compare against a branch
```

---

## Deferred (Future Versions)

- **[FUT-1]** (→ BF) Where a file has both a text and a visual representation (e.g., SVG, Markdown), the diff viewer shall provide a toggle between source diff and rendered preview
- **[FUT-2]** (→ DD) While in directory diff mode, when a file is renamed or moved, the viewer shall detect it as a single rename rather than displaying separate left-only (L) and right-only (R) entries *(needs design: detection strategy, visual indicator, content diff behavior)*
- **Syntax highlighting** — language-aware coloring in diff panels
- **Configurable preferences** — font, colors, ignored patterns
