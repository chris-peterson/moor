# Changelog

## 0.4.0

### Features
- moor now installs as a Claude Code plugin from the chris-peterson
  marketplace, with a published docs site at chris-peterson.github.io/moor.
- `moor install-cli` puts moor on your PATH (with zsh tab completion) so you
  can launch it from any directory and drive it as a difftool.
- `moor --version` reports the installed version.
- A `/moor:moor` slash command runs the CLI from inside Claude Code.
- After a plugin update, moor warns at session start when the on-PATH wrapper
  has drifted from the installed version, so you don't run stale code.

### Other
- New favicon, maintainer README, GitHub Pages deploy workflow, and Plugin
  Distribution (PD) requirements in SPEC.md / STATUS.md.
