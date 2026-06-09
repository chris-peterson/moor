# Status

**Spec:** v0.2 | **Audited:** 2026-06-09 | **Coverage:** all non-deferred requirements have implementing code

The 2026-06-05 details-panel work shipped four active requirements (implemented 2026-06-06): the label-less changeset header ([IM.IN-02]) — always-visible location eyebrow + commit-message headline, expanding to the full message body and a provenance grid — plus keyboard expand/collapse ([NV-17]), the `?` shortcuts overlay ([NV-18]), and the `f`/`F` sidebar toggle ([DD-16]). They landed in `ContextHeader.jsx` (the changeset header, dropping the `→ inputs` / `← outputs` channel labels for a quiet gutter cue + `status` strip), `ReviewShell.jsx` (lifted details state, global `d`/`D`/`f`/`F`/`?` keys), `FileDiffView.jsx` (`paused` prop), and the new `KeyboardHelp.jsx`. The `prev` reference and the `[prev]` read-only preview are speculative future work ([FUT-02], [FUT-03]) — no caller emits `prev` yet. A speculative implementation was prototyped this session and then removed before shipping (it was unreachable without a caller); the FUT entries document the design for when it's built. The 2026-05-31 audit closed the four items previously flagged: [UP-01] was reworded to match the shipped JetBrains Mono webfont (with platform-monospace fallback); [NV-13] was decomposed into NV-13a..d with a clause separating it from search-match positioning; and the two reverse-scan behaviors (active-row font zoom, single-file footer) were captured as [UP-05] and [IM.OUT-05]. The audit also decomposed three overloaded requirements ([AS-08], [IM.OUT-02], [FD-03]) into atomic forms.

The 2026-06-09 change removed search mode ([SM-01]..[SM-06] retired — low value and limited) and repurposed its `n` key for review notes ([NV-19]): a list of free-text notes, added ambiently via a "+ note" control or converted from a rejection's reason ([CM-07]), surfaced in `output` as a `notes` array of `{note, file?, line?}` ([IM.OUT-06]). To stop a single keystroke from discarding hard-to-recreate text, the keyboard rejection-delete (`Shift+R`) was dropped ([NV-10] retired; deleting a rejection is now mouse-only via CM-06's "Delete", which confirms), note/reason deletion is explicit and confirmed ([NV-12], [NV-19]), and there is no single-key note clear. The same change documented two behaviors shipped earlier as drift: zoom keys ([NV-20] — `=` / `-`, `0` resets, no modifier) and the case-insensitive `d` / `f` toggles ([NV-17], [DD-16]); the toggles now ignore modified keypresses, fixing `Cmd+F` also toggling the sidebar.

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

### Navigation (NV) — 23/23

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
| ~~[NV-10]~~ | Removed — keyboard rejection-delete dropped; use context menu (CM-06) | — |
| [NV-11] | Inline rejection reason input (auto-grows; "Convert to note" CTA) | Done |
| [NV-12] | Persistent rejection reason note; ✕ confirms before removing | Done |
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
| [NV-19] | n / "+ note" opens notes panel; list of notes, inline edit, confirmed delete | Done |
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
| [DD-12] | Quit dialog summarizes rejections; primary CTA "Send review feedback" | Done |
| [DD-13] | Quit dialog "Approve anyway" exits 0 with unreviewed hunks | Done |
| [DD-14] | Quit dialog keyboard nav (Tab, arrows, Enter, Escape) | Done |
| [DD-15] | Rename/move detection (`git mv`) — single entry instead of L+R | Done |
| [DD-16] | f toggles sidebar, either case (keyboard companion to DD-11) | Done |

### Search Mode (SM) — removed

Search mode was removed (low value, limited capability); [SM-01]..[SM-06] are
retired and excluded from the coverage count. The `n` / `N` keys are
repurposed for review notes ([NV-19]).

### Context Menu (CM) — 7/7

| Req | Description | Status |
|-----|-------------|--------|
| [CM-01] | Right-click hunk shows context menu | Done |
| [CM-02] | Mark as reviewed | Done |
| [CM-03] | Mark as unreviewed | Done |
| [CM-04] | Reject | Done |
| [CM-05] | Open in editor | Done |
| [CM-06] | Delete rejection (when hunk is rejected); confirms before discarding a typed reason | Done |
| [CM-07] | Convert rejection to note (moves reason + location into notes, deletes rejection) | Done |

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

### Interaction Model (IM) — 11/11

| Req | Description | Status |
|-----|-------------|--------|
| [IM-01] | Channel resolution: `--context` flag, then `MOOR_CONTEXT` env var | Done |
| [IM-02] | Warning banner when no context channel is configured | Done |
| [IM.IN-01] | Render `input.title` + `input.details` in header (caller-defined shape); reveal via hover/click/`d`-`D` | Done |
| [IM.IN-02] | Label-less changeset header: location eyebrow + message headline always visible; expand reveals body + provenance grid | Done |
| [IM.OUT-01] | Stream `output` writes, flushing on every hunk state change and note edit | Done |
| [IM.OUT-02a] | Output always includes `reviewer` + `rejections[{file,hunk,line,reason}]` | Done |
| [IM.OUT-02b] | `exitCode` present only after exit (finalization signal) | Done |
| [IM.OUT-03] | Rejection badges in header's output region | Done |
| [IM.OUT-04] | Review progress in header's output region | Done |
| [IM.OUT-05] | Single-file-mode footer progress bar (q-to-close, rejection count) | Done |
| [IM.OUT-06] | Output includes optional `note` string (free-text agent guidance) | Done |

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
