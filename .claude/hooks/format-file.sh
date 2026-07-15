#!/usr/bin/env bash
# PostToolUse hook: formats the just-written/edited file with Prettier, and
# additionally lints+fixes it with ESLint when it's a JS/TS file.
# Reads the hook event JSON from stdin, never fails the tool call (always exit 0).
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

file=$(node -e '
let d = "";
process.stdin.on("data", (c) => (d += c));
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(d);
    process.stdout.write((j.tool_input && j.tool_input.file_path) || "");
  } catch {
    process.stdout.write("");
  }
});
')

[ -n "$file" ] && [ -f "$file" ] || exit 0

npx --no-install prettier --write --ignore-unknown "$file" >/dev/null 2>&1 || true

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs)
    npx --no-install eslint --fix "$file" >/dev/null 2>&1 || true
    ;;
esac

exit 0
