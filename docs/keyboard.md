# Keyboard shortcuts

moor is keyboard-first and vim-flavored: you walk the diff with `j`/`k`, comment
on a change with a keystroke, and close when you're done. The mouse is always
available as a fallback, but you never need to reach for it.

## Reviewing changes

| Key | Action |
|-----|--------|
| `j` / `k` | Next / previous change. Moving off a change marks it reviewed — press `u` to undo. |
| `Shift+J` | Mark every unreviewed change in this file reviewed and jump to the next file. |
| `Shift+K` | Jump to the previous file, leaving review state untouched. |
| `u` | Mark the current change unreviewed. |
| `i` | Open the current change in your editor at its line. |

At the last change of a file, `j` rolls onto the next file; at the first change, `k`
rolls back to the previous one — so a long review is just `j` held down.

## Commenting

| Key | Action |
|-----|--------|
| `Space` / `Enter` | Comment on the current change — opens an inline composer anchored to its lines. |

The composer grows as you type. `Enter` confirms, `Shift+Enter` inserts a
newline, `Escape` confirms a non-empty comment or discards an empty one. Each
comment carries an **action** — `Tab` cycles it down from the default through
the tiers (`Shift+Tab` walks back up), or click one in the composer:

| Action | Meaning |
|--------|---------|
| **fix now** | The default. Must be fixed before shipping — gates the exit code and turns the change red. |
| **fix later** | Should be addressed, but needn't block this ship. |
| **consider** | Advisory. Doesn't block shipping. |

To comment on an arbitrary span, **drag the new (right) side's line-number
gutter** across the lines you want, then release. Comments anchor to the new
file, so the gutter affordance lives on the right side only. You can comment on
**any** right-side line — including unchanged context lines, so you can flag a
bug you spot in neighboring code: click an unchanged line's number (or
long-press / right-click any line). Each
comment **bands** the lines it covers with an outline in its action color, so
it's clear at a glance what the comment applies to. To remove a comment, click
the ✕ on its bar (it confirms before discarding a typed body). Comments travel
back to the caller through the [feedback channel](/#review-feedback-channel).

## Scrolling

| Key | Action |
|-----|--------|
| `↑` / `↓` | Scroll up / down a step. |
| `←` / `→` | Scroll left / right a step. |

Lines are never wrapped, so horizontal scroll is how you reach the tail of a
long line.

## Comments panel

| Key | Action |
|-----|--------|
| `n` | Open the comments panel (also the `comments` control in the status strip). |

The panel lists every comment — on the whole changeset, a file, or a line range
— and lets you edit the body inline, cycle its action, or delete it (deleting
confirms first, since a typed comment is hard to recreate). It's also where you
add a comment on the whole changeset.

Comments ride along in the result context as a `comments` array of
`{ body, action, file?, startLine?, endLine? }`. Only `fix-now` comments affect
the exit code; `fix-later` and `consider` are advisory.

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

With any comments written, closing first raises a send-feedback dialog that
reveals every comment (with its action) and defaults to sending it. With no
comments but unreviewed changes outstanding, closing raises a quit dialog
instead. Inside either dialog:

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Move between buttons. |
| `←` / `→` | Move between buttons. |
| `Enter` | Activate the focused button. |
| `Escape` | Cancel and return to the review. |

The exit code reflects the outcome (clean, fix-now comments, unreviewed, or
early close) so the caller knows how the review ended.

## Mouse equivalents

Everything reviewable by keyboard is reachable by mouse too:

| Gesture | Action |
|---------|--------|
| Click a changed line | Mark it reviewed. |
| Click an unchanged line's number (right side) | Comment on that line. |
| Drag the right-side line-number gutter | Select a line range (changed or context) and open a comment composer. |
| Long-press the right-side line-number gutter | Comment on that single line. |
| Right-click a change | Open the context menu (reviewed, unreviewed, comment, open in editor). |
| Drag the sidebar's right edge | Resize the file navigator. |
| Sidebar collapse / show buttons | Hide or reveal the file navigator. |
