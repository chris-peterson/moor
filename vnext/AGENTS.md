# kdiff4 — Build Philosophy

## What This Is

A fast, keyboard-driven diff viewer optimized for `git difftool`. Not a merge tool, not a directory browser — those are solved by VS Code and kdiff3. kdiff4 does one thing well: show a two-file diff.

## Key Constraints

- **Electron + React + Vite** — production build, no dev server needed at runtime
- **No configuration UI** — all preferences hardcoded (see [UP-*] in SPEC.md)
- **UTF-8 only** — no encoding detection or conversion
- **Binary detection only** — no binary diff viewer

## Build Philosophy

- **Diff algorithm correctness is non-negotiable** — Myers diff, proven and tested
- **Large files are real** — virtual scrolling from day one
- **Keyboard-first** — vim-style navigation (j/k, gg, G, q)
- **Fast startup** — production build loads from dist/, no bundler at runtime
- **Minimal surface** — only the code needed for the spec, nothing speculative
