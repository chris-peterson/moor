# Keyboard shortcuts

moor is keyboard-first and vim-flavored: you walk the diff with `j`/`k`, accept
or reject each change with a keystroke, and close when you're done. The mouse is
always available as a fallback, but you never need to reach for it.

## Reviewing changes

| Key | Action |
|-----|--------|
| `j` / `k` | Next / previous change. Moving off a change marks it reviewed — press `u` to undo. |
| `Shift+J` | Mark every unreviewed change in this file reviewed and jump to the next file. Rejected changes stay rejected. |
| `Shift+K` | Jump to the previous file, leaving review state untouched. |
| `u` | Mark the current change unreviewed. |
| `i` | Open the current change in your editor at its line. |

At the last change of a file, `j` rolls onto the next file; at the first change, `k`
rolls back to the previous one — so a long review is just `j` held down.

## Rejecting a change

| Key | Action |
|-----|--------|
| `r` | Reject the current change and open an inline box for an optional reason. |

The reason box grows as you type. `Enter` confirms, `Shift+Enter` inserts a
newline, `Escape` confirms without a reason. The box also has a **Convert to
note** button that moves the text into the [notes](#notes) — keeping the
change's location — instead of rejecting.

To remove a rejection, right-click the change and choose **Delete** (it confirms
before discarding a typed reason — there's no one-key delete, to avoid losing it
by accident). Rejections travel back to the caller through the
[feedback channel](/#review-feedback-channel).

## Scrolling

| Key | Action |
|-----|--------|
| `↑` / `↓` | Scroll up / down a step. |
| `←` / `→` | Scroll left / right a step. |

Lines are never wrapped, so horizontal scroll is how you reach the tail of a
long line.

## Notes

| Key | Action |
|-----|--------|
| `n` | Open the notes panel (also the `+ note` control in the status strip). |

Notes are guidance for the agent reading the result — minor tweaks that aren't
worth rejecting a change over. The panel lets you add ambient notes and edit or
delete any note inline (deleting confirms first, since a note is hard to
recreate). You can also right-click a rejected change and **Convert to note** to
move its reason into the notes, keeping the change's location.

Notes ride along in the result context as a `notes` array of
`{ note, file?, line? }`, separate from per-change rejections, and don't affect
whether the review counts as complete.

## View

| Key | Action |
|-----|--------|
| `d` | Toggle the details panel (when the review context carries expandable details). |
| `f` | Toggle the file sidebar. |
| `=` / `-` | Zoom in / out. `0` resets. |
| `?` | Toggle the keyboard help overlay. |

Toggle keys are case-insensitive, and zoom needs no modifier — press `=` or `-`
on their own.

## Closing

| Key | Action |
|-----|--------|
| `q` / `Escape` | Close moor. |

With unreviewed or rejected changes still outstanding, closing first raises a quit
dialog that summarizes what's left. Inside that dialog:

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Move between buttons. |
| `←` / `→` | Move between buttons. |
| `Enter` | Activate the focused button. |
| `Escape` | Cancel and return to the review. |

The exit code reflects the outcome (clean, rejections, unreviewed, or early
close) so the caller knows how the review ended.

## Mouse equivalents

Everything reviewable by keyboard is reachable by mouse too:

| Gesture | Action |
|---------|--------|
| Click a change | Mark it reviewed. |
| Right-click a change | Open the context menu (reviewed, unreviewed, reject, delete, convert to note, open in editor). |
| Drag the sidebar's right edge | Resize the file navigator. |
| Sidebar collapse / show buttons | Hide or reveal the file navigator. |
