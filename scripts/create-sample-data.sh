#!/bin/bash
set -e

SAMPLE_DIR="${1:-$(dirname "$0")/../sample_data}"

rm -rf "$SAMPLE_DIR"
mkdir -p "$SAMPLE_DIR"

cat > "$SAMPLE_DIR/left.js" << 'EOF'
const VERSION = '1.0.0';

export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

export function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

export function power(a, b) {
  return Math.pow(a, b);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function average(numbers) {
  const sum = numbers.reduce((a, b) => a + b, 0);
  return sum / numbers.length;
}

export function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

export function fibonacci(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

export function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}

export function gcd(a, b) {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}
EOF

cat > "$SAMPLE_DIR/right.js" << 'EOF'
const VERSION = '2.0.0';

export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

export function divide(a, b) {
  if (b === 0) return Infinity;
  return a / b;
}

export function modulo(a, b) {
  return a % b;
}

export function clamp(value, min, max) {
  if (min > max) throw new RangeError('min must be <= max');
  return Math.min(Math.max(value, min), max);
}

export function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function average(numbers) {
  if (numbers.length === 0) return NaN;
  const sum = numbers.reduce((a, b) => a + b, 0);
  return sum / numbers.length;
}

export function median(numbers) {
  if (numbers.length === 0) return NaN;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function factorial(n) {
  if (n < 0) throw new RangeError('n must be non-negative');
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

export function fibonacci(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

export function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}
EOF

mkdir -p "$SAMPLE_DIR/left" "$SAMPLE_DIR/right"
cp "$SAMPLE_DIR/left.js" "$SAMPLE_DIR/left/math.js"
cp "$SAMPLE_DIR/right.js" "$SAMPLE_DIR/right/math.js"

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

# A sample MOOR_CONTEXT sidecar so the redesigned change header has data to
# render: the location eyebrow (repo @ branch), the task, the commit-message
# headline, and the provenance rows (commit / author; range is suppressed) plus
# a multi-line body revealed on expand.
cat > "$SAMPLE_DIR/sample-context.json" << EOF
{
  "input": {
    "title": "Rework the inputs header into a commit-briefing layout that wraps long subjects instead of truncating them",
    "details": [
      { "label": "repo", "value": "moor" },
      { "label": "branch", "value": "redesign-details-panel" },
      { "label": "task", "value": "redesign the details panel so context reads organically" },
      { "label": "commit", "value": "a1b2c3d" },
      { "label": "author", "value": "Chris Peterson <chris.peterson@gettyimages.com>" },
      { "label": "date", "value": "Fri Jun 6 12:29:25 2026 -0700" },
      { "label": "range", "value": "HEAD~1..HEAD" },
      { "label": "body", "value": "The expanded details panel rendered a property grid of label/value rows, which read like a form and repeated the commit subject already shown in the inputs bar.\n\nThis reworks it into a briefing: on expand the bar title becomes the full headline, the beacon task sits beneath it, and repo/branch/hash/author/range weave into a single provenance byline." }
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
