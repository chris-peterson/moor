# Status

**Spec:** v0.2 | **Coverage:** 88/88 (100%)

## Requirement Coverage

### File Diff View (FD) — 9/9

| Req | Description | Status |
|-----|-------------|--------|
| [FD-01] | Side-by-side with sync scroll | Done |
| [FD-02] | Color-coded changed lines | Done |
| [FD-03] | Hybrid word/char diffs | Done |
| [FD-04] | Line numbers | Done |
| [FD-05] | Pair modified lines side-by-side | Done |
| [FD-06] | Overview minimap | Done |
| [FD-07] | Virtual scrolling | Done |
| [FD-08] | Binary file detection | Done |
| [FD-09] | Dim reviewed hunks | Done |

### Navigation (NV) — 16/16

| Req | Description | Status |
|-----|-------------|--------|
| [NV-01] | j/k next/prev hunk | Done |
| [NV-02] | q/Escape close | Done |
| [NV-03] | Scroll wheel/trackpad | Done |
| [NV-04] | Land on first non-reviewed hunk (fallback: first hunk) | Done |
| [NV-05] | u mark current hunk unreviewed | Done |
| [NV-06] | Click hunk marks reviewed | Done |
| [NV-07] | r reject current hunk | Done |
| [NV-08] | i open in editor | Done |
| [NV-09] | Click current hunk marks reviewed | Done |
| [NV-10] | R (shift+r) unreject current hunk | Done |
| [NV-11] | Inline rejection reason input | Done |
| [NV-12] | Persistent rejection reason note | Done |
| [NV-13] | Always align hunk top to viewport top on scroll (start of change visible, even for tall hunks) | Done |
| [NV-14] | Shift+J marks file reviewed and advances to next file | Done |
| [NV-15] | Shift+K navigates to previous file | Done |
| [NV-16] | Transient error toast when open-in-editor fails | Done |

### Directory Diff (DD) — 15/15

| Req | Description | Status |
|-----|-------------|--------|
| [DD-01] | Sidebar with file tree | Done |
| [DD-02] | File status indicators (M/L/R) | Done |
| [DD-03] | Click file shows diff | Done |
| [DD-04] | j/k at last/first hunk advances file | Done |
| [DD-05] | Track visited files (checkmark) | Done |
| [DD-06] | Progress counts hunks, not files | Done |
| [DD-07] | Quit prompts on unreviewed changes | Done |
| [DD-08] | Ignore .git, node_modules, etc. | Done |
| [DD-09] | Full file path in lower-left | Done |
| [DD-10] | Resizable sidebar | Done |
| [DD-11] | Hide/show sidebar | Done |
| [DD-12] | Quit dialog summarizes rejections; primary CTA "Send review feedback" | Done |
| [DD-13] | Quit dialog "Approve anyway" exits 0 with unreviewed hunks | Done |
| [DD-14] | Quit dialog keyboard nav (Tab, arrows, Enter, Escape) | Done |
| [DD-15] | Rename/move detection (`git mv`) — single entry instead of L+R | Done |

### Search Mode (SM) — 6/6

| Req | Description | Status |
|-----|-------------|--------|
| [SM-01] | Cmd+F enters search mode | Done |
| [SM-02] | Match all content, not just hunks | Done |
| [SM-03] | Hide non-matching files in sidebar | Done |
| [SM-04] | Dim non-matching hunks | Done |
| [SM-05] | n/N jump between matches | Done |
| [SM-06] | Escape exits search mode | Done |

### Context Menu (CM) — 6/6

| Req | Description | Status |
|-----|-------------|--------|
| [CM-01] | Right-click hunk shows context menu | Done |
| [CM-02] | Mark as reviewed | Done |
| [CM-03] | Mark as unreviewed | Done |
| [CM-04] | Reject | Done |
| [CM-05] | Open in editor | Done |
| [CM-06] | Unreject (when hunk is rejected) | Done |

### Review Feedback (RV) — 2/2

| Req | Description | Status |
|-----|-------------|--------|
| [RV-01] | "Review Complete!" toast notification | Done |
| [RV-04] | Sidebar entry red when file has rejected hunks | Done |

### Binary Formats (BF) — 1/1

| Req | Description | Status |
|-----|-------------|--------|
| [BF-01] | Side-by-side image diff | Done |

### Diff Algorithm (DA) — 4/4

| Req | Description | Status |
|-----|-------------|--------|
| [DA-01] | Myers line-level diff | Done |
| [DA-02] | Hybrid intra-line diff | Done |
| [DA-03] | Ignore trailing whitespace | Done |
| [DA-04] | Binary detection via null byte | Done |

### Exit Codes (EC) — 4/4

| Req | Description | Status |
|-----|-------------|--------|
| [EC-01] | Exit code 0 on clean approve | Done |
| [EC-02] | Exit code 1 on rejection | Done |
| [EC-03] | Exit code 2 on unreviewed | Done |
| [EC-04] | Exit code 3 on early close | Done |

### Application Shell (AS) — 8/8

| Req | Description | Status |
|-----|-------------|--------|
| [AS-01] | Electron production build | Done |
| [AS-02] | CLI launch | Done |
| [AS-03] | Window title shows paths | Done |
| [AS-04] | Launch maximized | Done |
| [AS-05] | Fast startup | Done |
| [AS-06] | Exit code reflects review outcome (see EC) | Done |
| [AS-07] | git difftool integration | Done |
| [AS-08] | Window title context (CLI / env / git repo / paths) | Done |

### Interaction Model (IM) — 7/7

| Req | Description | Status |
|-----|-------------|--------|
| [IM-01] | Channel resolution: `--context` flag, then `MOOR_CONTEXT` env var | Done |
| [IM-02] | Warning banner when no context channel is configured | Done |
| [IM.IN-01] | Render `input.title` + `input.details` in header (caller-defined shape) | Done |
| [IM.OUT-01] | Stream `output` writes, flushing on every hunk state change | Done |
| [IM.OUT-02] | Output shape: `exitCode`, `reviewer`, `rejections[{file,hunk,line,reason}]` | Done |
| [IM.OUT-03] | Rejection badges in header's output region | Done |
| [IM.OUT-04] | Review progress in header's output region | Done |

### User Preferences (UP) — 4/4

| Req | Description | Status |
|-----|-------------|--------|
| [UP-01] | Monospace 13px | Done |
| [UP-02] | Tab width 4 spaces | Done |
| [UP-03] | Dark theme with distinct hues | Done |
| [UP-04] | Never truncate or wrap; horizontal scroll reveals full lines | Done |

### Plugin Distribution (PD) — 6/6

| Req | Description | Status |
|-----|-------------|--------|
| [PD-01] | `--version` prints version from plugin.json | Done |
| [PD-02] | `install-cli` writes ~/.local/bin/moor wrapper (`--dir` override) | Done |
| [PD-03] | `install-cli` also installs zsh completion | Done |
| [PD-04] | `completions zsh [--print]` installs or prints completion | Done |
| [PD-05] | SessionStart hook warns on wrapper/plugin version drift | Done |
| [PD-06] | `/moor:moor` slash command forwards args to launcher | Done |

### Deferred

| Req | Description |
|-----|-------------|
| [FUT-01] | Preview/source toggle for visual text files (ex-BF-02) |
