# Implementation 1: React — Status

## Requirement Coverage

### Directory Comparison (DC)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [DC-1] | Accept two directory paths | Done | Welcome.jsx, CLI args |
| [DC-2] | Recursive directory traversal | Done | engine/directory.js |
| [DC-3] | Classify entries | Done | engine/directory.js |
| [DC-4] | Sidebar tree, always visible | Done | Sidebar.jsx |
| [DC-5] | Summary counts | Done | Sidebar.jsx header |
| [DC-6] | Ignore common directories | Done | engine/directory.js DEFAULT_IGNORED |
| [DC-7] | Follow symlinks | Done | fs default behavior |

### Review Flow (RF)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [RF-1] | Show first diff on launch | Done | ReviewShell.jsx auto-loads index 0 |
| [RF-2] | Right/Enter=next, Left=prev | Done | ReviewShell.jsx keydown handler |
| [RF-3] | Track viewed state | Done | ReviewShell.jsx viewed Set |
| [RF-4] | Bottom navbar with file strip | Done | FileNavbar.jsx |
| [RF-5] | Click navbar/sidebar to jump | Done | FileNavbar.jsx + Sidebar.jsx |
| [RF-6] | Escape closes when all viewed | Done | ReviewShell.jsx |
| [RF-7] | Sidebar highlights current file | Done | Sidebar.jsx accent border |
| [RF-8] | Keyboard-first navigation | Done | Arrow keys, Enter, Escape |

### File Diff View (FD)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [FD-1] | Side-by-side display | Done | FileDiffView.jsx |
| [FD-2] | Color-coded changed lines | Done | DiffRow left-bg/right-bg |
| [FD-3] | Hybrid word/char diffs | Done | engine/diff.js diffChars heuristic |
| [FD-4] | Line numbers | Done | DiffRow lineNumStyle |
| [FD-5] | Navigate between hunks (j/k) | **Backlog** | |
| [FD-6] | Overview minimap | Done | Minimap.jsx |
| [FD-7] | Virtual scrolling | Done | FileDiffView.jsx startIdx/endIdx |

### 3-Way Merge (TM)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [TM-1] | Accept three file paths | Done | Welcome.jsx, CLI args |
| [TM-2] | Two-panel display (left vs right) | **Backlog** | Current MergeView still uses 3+1 panels |
| [TM-3] | 3-way diff computation | Done | engine/diff3.js |
| [TM-4] | Inline conflict resolution | **Backlog** | Controls are in a strip, not inline |
| [TM-5] | Auto-resolve non-conflicts | Done | engine/diff3.js |
| [TM-6] | Conflict count + navigation | Partial | Count shown, nav doesn't scroll to conflict |
| [TM-7] | Save merged result | Done | MergeView.jsx → App.jsx |
| [TM-8] | Char-level conflict highlighting | **Backlog** | |

### Diff Algorithm (DA)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [DA-1] | Line-level Myers diff | Done | engine/diff.js |
| [DA-2] | Hybrid intra-line diff | Done | engine/diff.js diffChars + heuristic |
| [DA-3] | 3-way diff via base diffs | Done | engine/diff3.js |
| [DA-4] | Ignore trailing whitespace | **Backlog** | |
| [DA-5] | Text-only (no binary) | Done | UTF-8 reads throughout |

### Application Shell (AS)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [AS-1] | Electron app | Done | electron/main.js |
| [AS-2] | CLI launch | Done | parseLaunchArgs in main.js |
| [AS-3] | Drag-and-drop directories | **Backlog** | |
| [AS-4] | Window title shows paths | **Backlog** | |
| [AS-5] | Keyboard shortcuts | Partial | File nav done, hunk nav not done |

### User Preferences (UP)

| Req | Description | Status | Notes |
|-----|-------------|--------|-------|
| [UP-1] | Monospace 13px | Done | DM Mono via global.css |
| [UP-2] | Tab width 4 spaces | **Backlog** | No tab→space conversion |
| [UP-3] | Dark theme | Done | "Dark Observatory" in global.css |
| [UP-4] | Ignored directories | Done | engine/directory.js |
| [UP-5] | Ignore trailing whitespace | **Backlog** | Same as DA-4 |
| [UP-6] | Word wrap off | Done | whiteSpace: 'pre' |

## Summary

- **Done:** 28/38
- **Partial:** 2/38
- **Backlog:** 8/38

## Backlog

| Priority | Req | Work |
|----------|-----|------|
| P1 | [TM-2] [TM-4] | Rework merge view: 2 panels, inline conflict controls |
| P1 | [FD-5] [AS-5] | Hunk navigation (j/k or up/down within a file) |
| P2 | [TM-6] | Conflict nav should scroll to the conflict region |
| P2 | [TM-8] | Apply hybrid diff highlighting to conflict regions |
| P2 | [DA-4] [UP-5] | Strip trailing whitespace before diffing |
| P3 | [UP-2] | Convert tabs to 4 spaces for display |
| P3 | [AS-4] | Set window title to comparison paths |
| P3 | [AS-3] | Drag-and-drop directories onto welcome screen |

## Spec Observations

1. The 3+1 panel merge view is fundamentally wrong — spec now calls for 2 panels with inline controls, but MergeView.jsx hasn't been updated yet
2. Hunk navigation is the biggest missing keyboard feature — file-level nav is great, but within large files you still need mouse scrolling
3. Trailing whitespace handling (DA-4/UP-5) is a single change in the diff engine but untested — need sample data with trailing whitespace differences
4. The hybrid word/char diff heuristic is a genuine improvement over legacy tools — worth preserving through future iterations
