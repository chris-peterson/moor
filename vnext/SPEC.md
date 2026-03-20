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
- **[NV-4]** When a file is opened, the viewer shall auto-scroll to the first diff hunk
- **[NV-5]** When the user presses `u`, the viewer shall mark the current hunk as unreviewed
- **[NV-6]** When the user clicks a hunk, the viewer shall mark it reviewed (equivalent to advancing past it with `j`)

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

### Binary Formats (BF)

- **[BF-1]** When a recognized image file is opened, the diff viewer shall display the images side-by-side

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
- **[AS-6]** When closed, the application shall exit with code 0 (for `git difftool` integration)
- **[AS-7]** The application shall support `git difftool` integration via `git config`

### User Preferences (UP)

Fixed for now, configurable later:

- **[UP-1]** The application shall use system monospace font at 13px
- **[UP-2]** The application shall render tabs as 4 spaces (display only)
- **[UP-3]** The application shall use a dark color scheme with distinct hues per source
- **[UP-4]** The application shall disable word wrap (horizontal scroll for long lines)

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
