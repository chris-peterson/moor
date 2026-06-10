# Status

**Spec:** v0.2 | **Audited:** 2026-06-10 | **Coverage:** all non-deferred requirements have implementing code

The 2026-06-09 comments redesign reconciled the former per-hunk rejections and free-text notes into one **comment** concept (new category [CO-01]..[CO-08], `src/engine/comments.js`). A comment carries a `body`, an `action` (`fix-now` / `fix-later` / `consider`, defaulting to `consider`), and a target — the changeset, a file, or a line range. Only `fix-now` gates the exit code (EC-01/02), earns the red sidebar/badge treatment, and gates the quit dialog; `fix-later` (amber) and `consider` (accent) are advisory. Hunk review state is now binary (reviewed / unreviewed) — "blocking" is a comment property, not a third hunk state. Range comments are created from the new (right) side's line-number gutter (drag = range, long-press = single line; a plain click toggles a changed line's reviewed state but comments an unchanged context line, so neighboring code can be flagged — [CO-04]; the old/left gutter is inert, since feedback references the new file), by Space / Enter on the current hunk ([NV-07]), or by the context-menu "Comment" ([CM-04]); changeset and file comments come from the header / file-header controls ([CO-05]) and the comments panel ([CO-08], `n` key). Each range comment bands its covered lines with an action-colored outline ([CO-07]). The sidecar `output` now carries a single `comments[]` array ([IM.OUT-02a]) — `rejections[]` and `notes[]` are gone. Retired: [NV-11], [NV-12] (→ [CO-06]/[CO-07]), [CM-07] (→ the action control), [IM.OUT-06] (→ `comments[]`). The work landed in `comments.js` (action vocabulary + output projection), `ReviewShell.jsx` (comment state, CommentsPanel, fix-now badges/summary), `FileDiffView.jsx` (gutter gesture, composer, comment bars), `ContextHeader.jsx`, `Sidebar.jsx`, `Minimap.jsx`, `KeyboardHelp.jsx`, `App.jsx` (exit code), and `electron/main.js` (close-payload default).

The 2026-06-05 details-panel work shipped four active requirements (implemented 2026-06-06): the label-less changeset header ([IM.IN-02]) — always-visible location eyebrow + commit-message headline, expanding to the full message body and a provenance grid — plus keyboard expand/collapse ([NV-17]), the `?` shortcuts overlay ([NV-18]), and the `f`/`F` sidebar toggle ([DD-16]). They landed in `ContextHeader.jsx` (the changeset header, dropping the `→ inputs` / `← outputs` channel labels for a quiet gutter cue + `status` strip), `ReviewShell.jsx` (lifted details state, global `d`/`D`/`f`/`F`/`?` keys), `FileDiffView.jsx` (`paused` prop), and the new `KeyboardHelp.jsx`. The `prev` reference and the `[prev]` read-only preview are speculative future work ([FUT-02], [FUT-03]) — no caller emits `prev` yet. A speculative implementation was prototyped this session and then removed before shipping (it was unreachable without a caller); the FUT entries document the design for when it's built. The 2026-05-31 audit closed the four items previously flagged: [UP-01] was reworded to match the shipped JetBrains Mono webfont (with platform-monospace fallback); [NV-13] was decomposed into NV-13a..d with a clause separating it from search-match positioning; and the two reverse-scan behaviors (active-row font zoom, single-file footer) were captured as [UP-05] and [IM.OUT-05]. The audit also decomposed three overloaded requirements ([AS-08], [IM.OUT-02], [FD-03]) into atomic forms.

An earlier 2026-06-09 change removed search mode ([SM-01]..[SM-06] retired — low value and limited) and freed its `n` key (now the comments panel, [NV-19]); the keyboard rejection-delete (`Shift+R`) was dropped ([NV-10] retired). It also documented two behaviors shipped earlier as drift: zoom keys ([NV-20] — `=` / `-`, `0` resets, no modifier) and the case-insensitive `d` / `f` toggles ([NV-17], [DD-16]); the toggles now ignore modified keypresses, fixing `Cmd+F` also toggling the sidebar. (Its review-notes step was superseded the same day by the comments redesign described above.)

The 2026-06-10 change made clicking a hunk **toggle** its reviewed state (was one-way mark-reviewed) and dim it immediately on click rather than only after navigating away ([NV-06], [CO-04] reworded; [FD-09] dim now fires while the hunk is still active). [NV-09] was retired into [NV-06] — clicking *a hunk* already covers the currently-selected one, so the separate click-the-current-hunk rule was redundant. `u` and the context menu remain the keyboard/menu unreview paths.

> **Version note:** the product version in `.claude-plugin/plugin.json` and this spec's version (`v0.2`) move independently — PD-01/PD-05 treat plugin.json as the product-version source of truth — so a mismatch between them is expected, not drift.

## Requirement Coverage

### File Diff View (FD) — 9/9

| Req | Description | Status |
|-----|-------------|--------|
| [FD-01] | Side-by-side with sync scroll | Done |
| [FD-02] | Color-coded changed lines | Done |
| [FD-03] | Hybrid intra-line diff (char-level single edits, word-level when noisy) | Done |
| [FD-04] | Line numbers | Done |
| [FD-05] | Pair modified lines side-by-side | Done |
| [FD-06] | Overview minimap | Done |
| [FD-07] | Virtual scrolling | Done |
| [FD-08] | Binary file detection | Done |
| [FD-09] | Dim reviewed hunks | Done |

### Navigation (NV) — 20/20

| Req | Description | Status |
|-----|-------------|--------|
| [NV-01] | j/k next/prev hunk | Done |
| [NV-02] | q/Escape close | Done |
| [NV-03] | Scroll wheel/trackpad | Done |
| [NV-04] | Land on first unreviewed hunk (fallback: first hunk) | Done |
| [NV-05] | u mark current hunk unreviewed | Done |
| [NV-06] | Click hunk toggles reviewed | Done |
| [NV-07] | Space / Enter comment on current hunk | Done |
| [NV-08] | i open in editor | Done |
| [NV-13] | Hunk-navigation viewport positioning (umbrella) | Done |
| [NV-13a] | Don't scroll if hunk already fully visible | Done |
| [NV-13b] | One line of context above, hunk first line on second row | Done |
| [NV-13c] | Flush-to-top (first-line hunks) and flush-to-bottom (tall-hunk) edge cases | Done |
| [NV-13d] | Animate in-file scroll; jump instantly cross-file | Done |
| [NV-14] | Shift+J marks file reviewed and advances to next file | Done |
| [NV-15] | Shift+K navigates to previous file | Done |
| [NV-16] | Transient error toast when open-in-editor fails | Done |
| [NV-17] | d toggles input details panel (either case) | Done |
| [NV-18] | `?` toggles keyboard-shortcuts overlay | Done |
| [NV-19] | n / comments control opens the comments panel ([CO-08]) | Done |
| [NV-20] | =/-/0 zoom in/out/reset, no modifier | Done |

### Directory Diff (DD) — 16/16

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
| [DD-12] | Quit dialog summarizes fix-now comments; primary CTA "Send review feedback" | Done |
| [DD-13] | Quit dialog "Approve anyway" exits 0 with unreviewed hunks (no fix-now) | Done |
| [DD-14] | Quit dialog keyboard nav (Tab, arrows, Enter, Escape) | Done |
| [DD-15] | Rename/move detection (`git mv`) — single entry instead of L+R | Done |
| [DD-16] | f toggles sidebar, either case (keyboard companion to DD-11) | Done |

### Comments (CO) — 8/8

| Req | Description | Status |
|-----|-------------|--------|
| [CO-01] | Comment = body + action + target; reconciles rejections / notes | Done |
| [CO-02] | Target: changeset / file / line range (changed or context lines) | Done |
| [CO-03] | Action defaults to `consider`; settable consider / fix-later / fix-now; only fix-now gates | Done |
| [CO-04] | New-side gutter: click = toggle review (changed) / comment (context), drag = range, long-press = single line; left gutter inert | Done |
| [CO-05] | Header control = changeset comment; file-header control = file comment | Done |
| [CO-06] | Inline composer: auto-grow textarea + action control; Enter / Shift+Enter / Esc | Done |
| [CO-07] | Banded line range (action-colored outline) + persistent comment bar; click to edit, confirmed delete | Done |
| [CO-08] | Comments panel lists all; inline edit, action cycle, confirmed delete | Done |

### Context Menu (CM) — 6/6

| Req | Description | Status |
|-----|-------------|--------|
| [CM-01] | Right-click hunk shows context menu | Done |
| [CM-02] | Mark as reviewed | Done |
| [CM-03] | Mark as unreviewed | Done |
| [CM-04] | Comment (compose on the clicked line) | Done |
| [CM-05] | Open in editor | Done |
| [CM-06] | Delete comment (when hunk has comments); confirms before discarding a typed body | Done |

### Review Feedback (RV) — 2/2

| Req | Description | Status |
|-----|-------------|--------|
| [RV-01] | "Review Complete!" toast notification | Done |
| [RV-04] | Sidebar entry red when file has fix-now comments | Done |

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
| [EC-01] | Exit code 0 when all reviewed and no fix-now comments | Done |
| [EC-02] | Exit code 1 on one or more fix-now comments | Done |
| [EC-03] | Exit code 2 on unreviewed (no fix-now) | Done |
| [EC-04] | Exit code 3 on early close | Done |

### Application Shell (AS) — 14/14

| Req | Description | Status |
|-----|-------------|--------|
| [AS-01] | Electron production build | Done |
| [AS-02] | CLI launch | Done |
| [AS-03] | Window title shows paths | Done |
| [AS-04] | Launch maximized | Done |
| [AS-05] | Fast startup | Done |
| [AS-06] | Exit code reflects review outcome (see EC) | Done |
| [AS-07] | git difftool integration | Done |
| [AS-08] | Window title `<project> - <context>` (umbrella) | Done |
| [AS-08a] | `<project>` = `<basename> (<path>)` from git toplevel | Done |
| [AS-08b] | Home-substitute `<path>` to `~/...` | Done |
| [AS-08c] | `<context>` priority: `--title` / `MOOR_TITLE` / file paths | Done |
| [AS-08d] | `<context>` = `git diff` when both paths are difftool temp dirs | Done |
| [AS-08e] | Single available component → that component alone | Done |
| [AS-08f] | No `moor —` title prefix | Done |

### Interaction Model (IM) — 10/10

| Req | Description | Status |
|-----|-------------|--------|
| [IM-01] | Channel resolution: `--context` flag, then `MOOR_CONTEXT` env var | Done |
| [IM-02] | Warning banner when no context channel is configured | Done |
| [IM.IN-01] | Render `input.title` + `input.details` in header (caller-defined shape); reveal via hover/click/`d`-`D` | Done |
| [IM.IN-02] | Label-less changeset header: location eyebrow + message headline always visible; expand reveals body + provenance grid | Done |
| [IM.OUT-01] | Stream `output` writes, flushing on every hunk review change and comment change | Done |
| [IM.OUT-02a] | Output always includes `reviewer` + `comments[{body,action,file?,startLine?,endLine?}]` | Done |
| [IM.OUT-02b] | `exitCode` present only after exit (finalization signal) | Done |
| [IM.OUT-03] | Fix-now badges in header's output region | Done |
| [IM.OUT-04] | Review progress in header's output region | Done |
| [IM.OUT-05] | Single-file-mode footer progress bar (q-to-close, fix-now count) | Done |

### User Preferences (UP) — 5/5

| Req | Description | Status |
|-----|-------------|--------|
| [UP-01] | JetBrains Mono at 13px base, platform-monospace fallback | Done |
| [UP-02] | Tab width 4 spaces | Done |
| [UP-03] | Dark theme with distinct hues | Done |
| [UP-04] | Never truncate or wrap; horizontal scroll reveals full lines | Done |
| [UP-05] | Active diff row renders at 15px for emphasis | Done |

### Plugin Distribution (PD) — 8/8

| Req | Description | Status |
|-----|-------------|--------|
| [PD-01] | `--version` prints version from plugin.json | Done |
| [PD-02] | `install-cli` writes ~/.local/bin/moor wrapper (`--dir` override) | Done |
| [PD-03] | `install-cli` also installs zsh completion | Done |
| [PD-04] | `completions zsh [--print]` installs or prints completion | Done |
| [PD-05] | SessionStart hook warns on wrapper/plugin version drift | Done |
| [PD-06] | `/moor:moor` slash command forwards args to launcher | Done |
| [PD-07] | SessionStart hook emits ambient rules (`rules/*.md`) into context | Done |
| [PD-08] | `--help` / `-h` / `help` prints usage and exits zero; no args prints usage to stderr and exits non-zero | Done |

## Resolved in the 2026-05-31 audit

The four items the prior audit left open were closed by aligning the spec to the shipped implementation. No code changed.

### [UP-01] — spec now matches code

The implementation ships **JetBrains Mono**, a named webfont (`--font-mono: 'JetBrains Mono', monospace` in `src/styles/global.css:21`), falling back to the platform monospace only if the webfont fails to load; the 13px size already matched. UP-01 was reworded to name JetBrains Mono as the intended font with platform monospace as the fallback, so spec and code now agree.

### [NV-13] — decomposed and bounded

The v0.2 scroll policy is implemented in the main hunk-navigation path (`FileDiffView.jsx`, ~lines 473–486): no scroll when the hunk is already visible, one line of context above with the hunk on the second visible row, flush-to-top for first-line hunks, flush-to-bottom for hunks too tall to show the context row, animated scroll in-file, instant jump cross-file. NV-13 was decomposed into NV-13a..d covering each of these.

The secondary search-match scroll helper `scrollToRow` (`FileDiffView.jsx:391`) uses different positioning math (`top - viewportHeight / 3`). NV-13's stem now states that it governs hunk navigation only and that search-match positioning is intentionally separate, so the two are not expected to share math. NV-13 and its sub-IDs are Covered.

### Reverse-scan behaviors — now have governing requirements

Both behaviors that traced to no requirement are now captured in the spec:

| Behavior | Location | Now governed by |
|----------|----------|-----------------|
| Active-row font zoom (active hunk row renders at 15px, others at 13px) | `FileDiffView.jsx:80` | [UP-05] |
| Single-file-mode footer progress bar | `FileDiffView.jsx:1190–1244` | [IM.OUT-05] |

## Deferred

| Req | Description |
|-----|-------------|
| [FUT-01] | Preview/source toggle for visual text files (ex-BF-02) |
| [FUT-02] | Optional `prev` input reference (ex-IM.IN-03) — speculative; no caller emits it yet |
| [FUT-03] | `[prev]` read-only preview of the previous diff (ex-RO-01..04) — speculative; not implemented |
