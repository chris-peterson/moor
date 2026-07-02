#!/usr/bin/env bash
# SessionStart hook: detect CLI wrapper drift after a plugin update.
#
# `moor install-cli` drops a wrapper at ~/.local/bin/moor whose path is
# hardcoded at install time. When the plugin updates, the wrapper does NOT
# auto-update — it still points at wherever install-cli last ran from. This
# hook fires on each Claude Code session start, compares `moor --version`
# against plugin.json#version, and emits an additionalContext nudge when they
# differ. Silent when versions match, silent when moor isn't on PATH, never
# blocks the session.

set -euo pipefail

NAME="moor"
PLUGIN_JSON="${CLAUDE_PLUGIN_ROOT:-}/.claude-plugin/plugin.json"

[ -f "$PLUGIN_JSON" ] || exit 0
command -v "$NAME" >/dev/null 2>&1 || exit 0

# No `| head -1` — a closed pipe would trip pipefail. plugin.json has one
# version line; trim any trailing lines with parameter expansion instead.
PLUGIN_VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PLUGIN_JSON")
PLUGIN_VERSION=${PLUGIN_VERSION%%$'\n'*}
[ -z "$PLUGIN_VERSION" ] && exit 0

# Unset CLAUDE_PLUGIN_ROOT so the wrapper's target resolves its own bundled
# plugin.json (its __file__ root) rather than this hook's env — otherwise a
# stale wrapper would read the current plugin's version and drift never shows.
CLI_VERSION=$(env -u CLAUDE_PLUGIN_ROOT "$NAME" --version 2>/dev/null | awk '{print $NF}') || exit 0
[ -z "$CLI_VERSION" ] && exit 0

[ "$PLUGIN_VERSION" = "$CLI_VERSION" ] && exit 0

msg="PLEASE TELL THE USER (do not skip): the moor CLI on PATH reports version ${CLI_VERSION}, but the moor plugin is at ${PLUGIN_VERSION}. Refresh the shell wrapper before relying on the CLI — run \`moor install-cli\` (or \`git pull\` in the local source checkout if the wrapper points there). Until refreshed, CLI invocations may run stale code."

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"
