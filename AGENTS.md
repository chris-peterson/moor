# moor — Build Philosophy

## What This Is

A fast, keyboard-driven diff viewer optimized for `git difftool`. Not a merge tool, not a file browser — those are solved elsewhere. moor does one thing well: let a person review a changeset — walk it hunk by hunk, comment where it matters, and return that outcome to whatever launched it.

## Key Constraints

- **Electron + React + Vite** — production build, no dev server needed at runtime
- **No configuration UI** — all preferences hardcoded (see [UP-*] in SPEC.md)
- **UTF-8 only** — no encoding detection or conversion
- **Binary detection only** — no binary diff viewer
- **The return channel is the product** — the sidecar `output` and the exit code are how a review reaches its caller, so a change that touches either is a contract change (see the review-sidecar contract in `docs/`)
- **Comments are ungraded** — a body and a target, no severity tier ([CO-03])

## Build Philosophy

- **Diff algorithm correctness is non-negotiable** — Myers diff, proven and tested
- **Large files are real** — virtual scrolling from day one
- **Keyboard-first** — vim-style navigation (`j`/`k` between hunks, `Shift+J`/`Shift+K` between files, `q` to close); every mouse affordance has a key, and the full set lives in `docs/keyboard.md`
- **Fast startup** — production build loads from dist/, no bundler at runtime
- **Minimal surface** — only the code needed for the spec, nothing speculative
