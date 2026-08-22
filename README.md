# moor

📖 **[Read the docs →](https://chris-peterson.github.io/moor/#/)**

A fast, keyboard-driven diff viewer optimized for `git difftool`, built with
Electron + React + Vite. This README is for working on moor itself; for usage,
keybindings, and the review-feedback contract, see the docs site above.

## Stack

- **Electron** — desktop shell, production build loaded from `dist/`
- **React + Vite** — UI, built ahead of time (no dev server at runtime)

## Layout

| Path | Purpose |
|------|---------|
| `src/` | React UI and the diff engine (`src/engine/`) |
| `electron/` | Electron main process and launch wiring |
| `bin/moor` | Launcher + CLI — builds `dist/` on first run and launches Electron; also handles `--version`, `install-cli`, and `completions` |
| `hooks/` | `SessionStart` hooks: wrapper-drift warning, ambient-rule injection |
| `rules/` | Ambient rules the `emit-rules.sh` hook injects into every session |
| `scripts/` | Sample-data generation, and `shipyard`, which projects the generated artifacts |
| `plugin.yml` | Canonical plugin descriptor — `.claude-plugin/plugin.json` and the generated docs pages are projected from it |
| `docs/` | Docsify documentation site (deployed to GitHub Pages) |
| `SPEC.md` | Numbered requirements (EARS) — the behavioral contract |
| `STATUS.md` | Requirement coverage tracker |

## Develop

```bash
just install        # npm install
just build          # vite build → dist/
just test           # node --test src/engine/*.test.js
just diff           # build sample data and open a two-file diff
just dir-diff       # build sample data and open a directory diff
just diff-context   # same, with a sample REVIEW_CONTEXT sidecar so the header renders
```

Generated artifacts — `.claude-plugin/plugin.json`, `hooks/hooks.json`, and
`plugin.yml`'s describe block — are written by CI, never by hand. The Project
workflow runs shipyard's generators on every push and commits the result back
to the branch, so a committed artifact matches its source at all times and the
diff a reviewer approves is the change that lands. Editing `plugin.yml`,
`hooks/hooks.yml`, a rule, or a command needs no local regeneration step.

```bash
just preview-generated   # run the generators as CI does; git restore . to discard
```

## Use as git difftool

```bash
just git-install    # builds dist/ and sets diff.tool = moor
just git-uninstall  # removes the difftool config
just install-cli    # copies a moor wrapper to ~/.local/bin + zsh completion
```

After a plugin update the wrapper points at the previous version's directory. A
SessionStart hook reports the drift; `/moor:install-moor` is what clears it,
because only a slash command runs against the newly installed plugin root.

## Docs

```bash
just docs           # render the site into docs/
just docs-preview   # render, then serve it locally
```

The docs site deploys from `docs/` to GitHub Pages on push to `main`. `SPEC.md`,
the ambient rules, and `docs/index.html` are projected into `docs/` at build time
and gitignored — `SPEC.md` stays at the repo root for the spec-driven tooling.

## Releasing

Releasing is one `workflow_dispatch` on the Release workflow whose only input is
the bump level. Write the notes first — reading what landed is what tells you the
bump, so the two are one judgment:

```bash
git log $(git describe --tags --abbrev=0)..main --no-merges
```

Commit that under `## Unreleased` in `CHANGELOG.md`, then dispatch with the bump
the notes imply. A missing or empty `## Unreleased` section fails the run.
shipyard derives the version from `plugin.yml`, retitles the section, commits,
tags that commit, publishes the GitHub Release from the section, and notifies the
marketplace. Don't bump the version, retitle the section, or cut the tag by hand.
