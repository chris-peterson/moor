# Ambient rules

Moor's launch contract can't wait for a skill to load — an agent deciding to
show you a diff reaches for `git difftool` before any moor surface is
involved, and that path silently loses the review verdict. The plugin guards
the contract with **ambient rules**: a `SessionStart` hook adds `rules/*.md`
to the session context at startup and re-injects them after context
compaction.

This page shows exactly what gets injected, so you can see what installing
moor adds to your sessions.

---

[launch-with-sidecar](rules/launch-with-sidecar.md ':include')
