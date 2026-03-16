# Implementation 0: VS Code — Requirement Coverage

VS Code as `git difftool` / `git mergetool` via:

```bash
git config --global diff.tool vscode
git config --global difftool.vscode.cmd "code --wait --diff \$LOCAL \$REMOTE"
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd "code --wait --merge \$REMOTE \$LOCAL \$BASE \$MERGED"
```

## Requirement Coverage

### Directory Comparison (DC)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [DC-1] | Accept two directory paths | No | VS Code has no directory diff mode; `git difftool --dir-diff` not supported |
| [DC-2] | Recursive directory traversal | No | |
| [DC-3] | Classify entries | No | |
| [DC-4] | Sidebar tree, always visible | No | |
| [DC-5] | Summary counts | No | |
| [DC-6] | Ignore common directories | N/A | Git handles this via .gitignore |
| [DC-7] | Follow symlinks | N/A | Git handles this |

### Review Flow (RF)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [RF-1] | Show first diff on launch | No | Git prompts file-by-file: "Launch 'vscode' [Y/n]?" |
| [RF-2] | Right/Enter=next, Left=prev | No | Must close each file to advance; no back |
| [RF-3] | Track viewed state | No | |
| [RF-4] | Bottom navbar with file strip | No | |
| [RF-5] | Click navbar/sidebar to jump | No | |
| [RF-6] | Escape closes when all viewed | No | Each file is a separate invocation |
| [RF-7] | Sidebar highlights current file | No | |
| [RF-8] | Keyboard-first navigation | Partial | VS Code has shortcuts within a file, but no cross-file review flow |

### File Diff View (FD)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [FD-1] | Side-by-side display | **Yes** | Excellent side-by-side with inline toggle |
| [FD-2] | Color-coded changed lines | **Yes** | Green/red with gutter indicators |
| [FD-3] | Hybrid word/char diffs | Partial | Advanced algorithm snaps to word boundaries, but not configurable |
| [FD-4] | Line numbers | **Yes** | |
| [FD-5] | Navigate between hunks | **Yes** | Alt+F5 / Shift+Alt+F5 |
| [FD-6] | Overview minimap | **Yes** | Full minimap with change indicators |
| [FD-7] | Virtual scrolling | **Yes** | Handles massive files |

### 3-Way Merge (TM)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [TM-1] | Accept three file paths | **Yes** | Via `--merge` flag |
| [TM-2] | Two-panel display | **Yes** | 3-way merge editor with incoming/current/result |
| [TM-3] | 3-way diff computation | **Yes** | |
| [TM-4] | Inline conflict resolution | **Yes** | Accept Current/Incoming/Both codelens |
| [TM-5] | Auto-resolve non-conflicts | **Yes** | |
| [TM-6] | Conflict count + navigation | **Yes** | |
| [TM-7] | Save merged result | **Yes** | |
| [TM-8] | Char-level conflict highlighting | **Yes** | |

### Diff Algorithm (DA)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [DA-1] | Line-level diff | **Yes** | Myers + advanced algorithm |
| [DA-2] | Hybrid intra-line diff | Partial | Word-boundary snapping, not configurable |
| [DA-3] | 3-way diff | **Yes** | |
| [DA-4] | Ignore trailing whitespace | **Yes** | `diffEditor.ignoreTrimWhitespace` setting |
| [DA-5] | Binary file detection | **Yes** | Shows "Binary file not shown" |

### Application Shell (AS)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [AS-1] | Desktop app | **Yes** | Electron-based |
| [AS-2] | CLI launch | **Yes** | `code --diff`, `code --merge` |
| [AS-3] | Drag-and-drop | No | Not for diff mode |
| [AS-4] | Window title shows paths | **Yes** | Tab titles show filenames |
| [AS-5] | Keyboard shortcuts | Partial | Within file: yes. Cross-file review: no |

### User Preferences (UP)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [UP-1] | Monospace font | **Yes** | Configurable |
| [UP-2] | Tab width | **Yes** | Configurable |
| [UP-3] | Dark theme | **Yes** | Many themes |
| [UP-4] | Ignored directories | N/A | Git-managed |
| [UP-5] | Ignore trailing whitespace | **Yes** | Setting available |
| [UP-6] | Word wrap off | **Yes** | Configurable |

## Summary

- **Yes:** 21/38
- **Partial:** 4/38
- **No:** 11/38
- **N/A:** 2/38

## Analysis

VS Code is excellent for **single-file diffs and merges** — better than kdiff4 in every way (syntax highlighting, mature editor, inline merge codelens). It completely covers the TM, DA, and UP requirement groups.

The gap is **directory-level review flow** — the entire DC and RF requirement groups. VS Code has no concept of:
- Comparing two arbitrary directory trees
- A guided sequential review across multiple files
- Tracking which files you've looked at
- Navigating between files within a single session

This is the same gap kdiff3 fills. The question is whether that gap justifies a standalone tool.

### Verdict

If your workflow is `git difftool` / `git mergetool`, **use VS Code**. It's better at single-file work.

If you need to **compare arbitrary directories** or want a **guided review flow across many files**, that's the niche for kdiff4.
