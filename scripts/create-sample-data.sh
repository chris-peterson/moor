#!/bin/bash
set -e

SAMPLE_DIR="${1:-$(dirname "$0")/../sample_data}"

rm -rf "$SAMPLE_DIR"
mkdir -p "$SAMPLE_DIR"

cat > "$SAMPLE_DIR/left.js" << 'EOF'
const VERSION = '1.0.0';

// Parse a date string. Uses the platform Date constructor, which accepts
// locale-dependent and ambiguous formats.
export function parse(s) {
  return new Date(s);
}

export function isValid(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function format(date) {
  return date.toISOString();
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function diffInDays(a, b) {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / 86400000);
}

export function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}
EOF

cat > "$SAMPLE_DIR/right.js" << 'EOF'
const VERSION = '2.0.0';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?)?$/;

// Parse an ISO-8601 date string into a Date. Rejects the ambiguous,
// locale-dependent formats the platform Date constructor would accept.
export function parseISO(s) {
  return new Date(s);
}

export function parse(s) {
  return parseISO(s);
}

export function isValid(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function format(date) {
  return date.toISOString();
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function daysBetween(a, b) {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / 86400000);
}

export function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}
EOF

mkdir -p "$SAMPLE_DIR/left" "$SAMPLE_DIR/right"
cp "$SAMPLE_DIR/left.js" "$SAMPLE_DIR/left/dates.js"
cp "$SAMPLE_DIR/right.js" "$SAMPLE_DIR/right/dates.js"

cat > "$SAMPLE_DIR/left/config.js" << 'EOF'
export const CONFIG = {
  debug: false,
  logLevel: 'warn',
  maxRetries: 3,
};
EOF

cat > "$SAMPLE_DIR/right/config.js" << 'EOF'
export const CONFIG = {
  debug: true,
  logLevel: 'info',
  maxRetries: 5,
  timeout: 30000,
};
EOF

# A sample REVIEW_CONTEXT sidecar so the redesigned change header has data to
# render: the location eyebrow (repo @ branch), the task, the commit-message
# headline, and the provenance rows (commit / author; range is suppressed) plus
# a multi-line body revealed on expand. The rationale intentionally describes
# the same change the diff shows, so the reviewer's rejection ("non-ISO inputs
# still reach here") reads as a real disagreement with the stated intent.
cat > "$SAMPLE_DIR/sample-context.json" << 'EOF'
{
  "input": {
    "title": "Parse dates through a strict ISO-8601 helper instead of the platform Date constructor",
    "details": [
      { "label": "repo", "value": "datekit" },
      { "label": "branch", "value": "strict-iso-parsing" },
      { "label": "task", "value": "stop accepting ambiguous, locale-dependent date strings" },
      { "label": "commit", "value": "a1b2c3d" },
      { "label": "author", "value": "Chris Peterson <chris.peterson@gettyimages.com>" },
      { "label": "date", "value": "Fri Jun 6 12:29:25 2026 -0700" },
      { "label": "range", "value": "HEAD~1..HEAD" },
      { "label": "body", "value": "`new Date(s)` accepts locale-dependent, ambiguous formats — '01/02/2026' parses as Jan 2 or Feb 1 depending on the runtime, and invalid strings quietly become Invalid Date instead of failing.\n\nThis routes every caller through parseISO, which accepts only ISO-8601, so the same string parses the same way everywhere. `parse()` now delegates to it, and `diffInDays` is renamed `daysBetween` to match the rest of the API." }
    ]
  }
}
EOF

echo "Sample data created at: $SAMPLE_DIR"
echo "  left:  $SAMPLE_DIR/left.js"
echo "  right: $SAMPLE_DIR/right.js"
echo "  left/:  $SAMPLE_DIR/left/"
echo "  right/: $SAMPLE_DIR/right/"
echo "  context: $SAMPLE_DIR/sample-context.json"
