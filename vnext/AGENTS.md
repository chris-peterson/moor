# kdiff4 — Build Philosophy

## What This Is

A modern JavaScript reimplementation of kdiff3, focused on directory comparison and 3-way merge. The original is a Qt/C++ KDE application from the early 2000s that remains one of the best diff/merge tools available — but its UI and build system show their age.

## Key Constraints

- **Electron + web stack** — Node.js backend for filesystem, browser frontend for UI
- **No configuration UI** — all preferences hardcoded (see [UP-*] requirements in SPEC.md)
- **UTF-8 only** — no encoding detection or conversion
- **Text files only** — no binary diff
- **Local filesystem only** — no remote protocols

## Build Philosophy

- **Functional first, pretty second** — a working diff is worth more than a beautiful loading screen
- **Diff algorithm correctness is non-negotiable** — port or use a proven algorithm, don't invent one
- **Large files are real** — virtual scrolling from day one, not bolted on later
- **The merge editor is the hard part** — directory comparison is straightforward; invest complexity budget in the 3-way merge UX

## Suggested Build Order

1. Diff engine (line-level + character-level)
2. 2-file side-by-side viewer with diff highlighting
3. Directory comparison tree
4. 3-way diff computation
5. 3-way merge UI with conflict resolution
6. Electron shell + CLI integration

## Tech Stack Notes

Each implementation chooses its own frameworks, but all must:
- Use Node.js for filesystem access
- Run in Electron for desktop distribution
- Produce a single `npm start` or `just run` entry point
