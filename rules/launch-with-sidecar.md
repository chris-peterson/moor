# Launch moor with the sidecar, never via raw `git difftool`

When you launch moor to review changes, the outcome — accepted, rejected
hunks with reasons, unreviewed, closed early — comes back through the
`MOOR_CONTEXT` sidecar file and moor's exit code (`0`/`1`/`2`/`3`), not
through the terminal. Raw `git difftool` swallows the exit code and
configures no sidecar, so the review outcome is silently lost.

- **Reviewing a git range** (working tree, a commit, a branch) — launch
  through a wrapper that sets `MOOR_CONTEXT`, then read the verdict back
  from the file it names. If the anchor plugin is installed,
  `/anchor:preview` (working tree vs `HEAD`) and `/anchor:commit` (a
  specific commit) do this.
- **Arbitrary two-path or two-directory diff** unrelated to a git range —
  use moor's CLI directly: `moor <left> <right>`.

The sidecar contract — the `input`/`output` schema, the exit codes, why the
context file isn't deleted — is defined normatively (`IM.OUT-*`) in the
bundled spec: `${CLAUDE_PLUGIN_ROOT}/SPEC.md`
