---
description: Bootstrap or refresh moor's PATH wrapper and zsh completions
argument-hint: "[--dir <path>]"
disable-model-invocation: true
---

Run moor's install bootstrap, then report its output as-is. Do no other work.

<!-- This command exists because it is the only door to the *newly installed*
plugin root. The wrapper at ~/.local/bin/moor execs bin/moor by the absolute
path it had at install time, and plugin directories are version-pinned, so
`moor install-cli` from a shell re-points the wrapper at the version it already
names. `${CLAUDE_PLUGIN_ROOT}` here is the new one. -->

```bash
bash "${CLAUDE_PLUGIN_ROOT}/bin/moor" install-cli ${ARGUMENTS}
```

Both steps are idempotent, so re-running is the normal way to recover from drift — the SessionStart freshness hook nudges you here when `moor --version` falls behind the plugin.
