# moor

📖 **[Read the docs →](https://chris-peterson.github.io/moor/#/)**

A fast, keyboard-driven diff viewer optimized for `git difftool`, built with
Electron + React + Vite. This README is for working on moor itself; for usage,
keybindings, and the review-feedback contract, see the docs site above.

## Stack

- **Electron** — desktop shell, production build loaded from `dist/`
- **React + Vite** — UI, built ahead of time (no dev server at runtime)
- **better-sqlite3** — native module, rebuilt for Electron on install

## Layout

| Path | Purpose |
|------|---------|
| `src/` | React UI and the diff engine (`src/engine/`) |
| `electron/` | Electron main process and launch wiring |
| `bin/moor` | Launcher + CLI — builds `dist/` on first run and launches Electron; also handles `--version`, `install-cli`, and `completions` |
| `commands/moor.md` | Slash-command shim forwarding `$ARGUMENTS` to `bin/moor` |
| `hooks/` | `SessionStart` hook that warns when the on-PATH `moor` wrapper drifts from the plugin version |
| `scripts/` | Sample-data generation |
| `docs/` | Docsify documentation site (deployed to GitHub Pages) |
| `SPEC.md` | Numbered requirements (EARS) — the behavioral contract |
| `STATUS.md` | Requirement coverage tracker |

## Develop

```bash
just install        # npm install (rebuilds native modules for Electron)
just build          # vite build → dist/
just test           # node --test src/engine/*.test.js
just diff           # build sample data and open a two-file diff
just dir-diff       # build sample data and open a directory diff
```

## Use as git difftool

```bash
just git-install    # builds dist/ and sets diff.tool = moor
just git-uninstall  # removes the difftool config
just install-cli    # copies a moor wrapper to ~/.local/bin + zsh completion
```

## Docs

```bash
just docs           # serve the docsify site locally
```

The docs site deploys from `docs/` to GitHub Pages on push to `main`. `SPEC.md`
is copied into `docs/` at build time (it stays at the repo root for the
spec-driven tooling).
