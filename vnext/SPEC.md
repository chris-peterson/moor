# kdiff4 — Modern Diff Viewer

**Version:** 0.2
**Status:** Draft — narrowed scope after implementation 0.1 learnings

---

## Vision

A fast, beautiful diff viewer optimized for `git difftool`. Opens instantly, shows the diff clearly, closes when done. Keyboard-driven, vim-style navigation.

**Not a merge tool.** That's a solved problem (VS Code `--merge`, kdiff3). kdiff4 does one thing well: show diffs clearly — whether a single file pair or every changed file in a directory.

---

## Core Workflow

**Single file:** Git launches kdiff4 for each changed file:

```bash
git difftool  # opens kdiff4 once per file, sequentially
```

kdiff4 opens, shows the diff, user reviews it, presses `q` to close. Git moves to the next file.

**Directory diff:** Git launches kdiff4 once with all changed files:

```bash
git difftool --dir-diff  # opens kdiff4 once with all changes
```

kdiff4 opens a sidebar listing changed files. User navigates between files, reviews each diff, and closes when done.

---

## Requirements

### File Diff View (FD)

- **[FD-1]** Display two files side-by-side with synchronized scrolling
- **[FD-2]** Highlight changed lines with distinct colors per source (left vs right)
- **[FD-3]** Show hybrid word/character differences within changed lines (char-level for single clean edits, word-level when noisy)
- **[FD-4]** Line numbers displayed in both panels
- **[FD-5]** Pair modified lines side-by-side (don't show all deletes then all inserts)
- **[FD-6]** Overview minimap showing location of all changes
- **[FD-7]** Handle large files efficiently (virtual scrolling)
- **[FD-8]** Detect binary files and display "Binary files differ" instead of garbled text
- **[FD-9]** Dim already-reviewed hunks so the eye is drawn to unreviewed changes

### Navigation (NV)

Vim-style, keyboard-first:

- **[NV-1]** `j` / `k` — next / previous diff hunk
- **[NV-2]** `q` or `Escape` — close (exit with code 0)
- **[NV-3]** Scroll wheel and trackpad work naturally
- **[NV-4]** On open, auto-scroll to the first diff hunk
- **[NV-5]** `u` — undo: mark the current hunk as unreviewed

### Directory Diff (DD)

When launched with two directories (`git difftool --dir-diff`):

- **[DD-1]** Sidebar listing all changed files as a collapsible tree
- **[DD-2]** File status indicators: modified (M), left-only (L), right-only (R)
- **[DD-3]** Click a file in the sidebar to view its diff
- **[DD-4]** `j` / `k` navigate between diff hunks; at the last/first hunk, advance to the next/previous file
- **[DD-5]** Track which files have been visited (checkmark in sidebar) — files are a navigation aid, not the primary unit of review
- **[DD-6]** Progress bar and all status messaging tracks **changes** (diff hunks) reviewed vs total — a file with 10 hunks counts for 10, not 1
- **[DD-7]** `q` or `Escape` prompts based on **unreviewed changes**, not unvisited files; always allows closing
- **[DD-8]** Ignore common non-content directories (`.git`, `node_modules`, etc.)
- **[DD-9]** Display the full file path in the lower-left of the view

### Diff Algorithm (DA)

- **[DA-1]** Line-level diff using Myers algorithm
- **[DA-2]** Hybrid intra-line diff: character-level when a word has a single clean edit, word-level when multiple edits make char highlighting noisy
- **[DA-3]** Ignore trailing whitespace differences when computing diffs
- **[DA-4]** Detect binary files via null byte check

### Application Shell (AS)

- **[AS-1]** Electron app, production build (no dev server needed)
- **[AS-2]** Launch from CLI: `kdiff4 file1 file2`
- **[AS-3]** Window title shows file paths
- **[AS-4]** Launch fullscreen (maximized)
- **[AS-5]** Fast startup — under 1 second to first paint
- **[AS-6]** Exit code 0 on close (for `git difftool` integration)
- **[AS-7]** `git difftool` integration via `git config`

### User Preferences (UP)

Fixed for now, configurable later:

- **[UP-1]** Font: system monospace, 13px
- **[UP-2]** Tab width: 4 spaces (display only)
- **[UP-3]** Color scheme: dark theme with distinct hues per source
- **[UP-4]** Word wrap: off (horizontal scroll for long lines)

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

- **Syntax highlighting** — language-aware coloring in diff panels
- **Configurable preferences** — font, colors, ignored patterns
