#!/bin/bash
set -e

SAMPLE_DIR="${1:-$(dirname "$0")/../sample_data}"

LEFT="$SAMPLE_DIR/left"
RIGHT="$SAMPLE_DIR/right"
BASE="$SAMPLE_DIR/merge/base.txt"
MERGE_LEFT="$SAMPLE_DIR/merge/left.txt"
MERGE_RIGHT="$SAMPLE_DIR/merge/right.txt"

rm -rf "$SAMPLE_DIR"
mkdir -p "$LEFT/src" "$LEFT/docs" "$LEFT/config"
mkdir -p "$RIGHT/src" "$RIGHT/docs" "$RIGHT/config"
mkdir -p "$SAMPLE_DIR/merge"

# Identical file
cat > "$LEFT/README.md" << 'EOF'
# Sample Project

This is a sample project for testing kdiff4.
It contains various files to exercise the diff and merge features.
EOF
cp "$LEFT/README.md" "$RIGHT/README.md"

# Modified file — left has function, right has different implementation
cat > "$LEFT/src/utils.js" << 'EOF'
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
EOF

cat > "$RIGHT/src/utils.js" << 'EOF'
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
EOF

# Left-only file
cat > "$LEFT/src/legacy.js" << 'EOF'
export function oldFunction() {
  console.log('This only exists on the left side');
}
EOF

# Right-only file
cat > "$RIGHT/src/newFeature.js" << 'EOF'
export function newFeature() {
  return { status: 'only on right side' };
}
EOF

# Modified config
cat > "$LEFT/config/settings.json" << 'EOF'
{
  "debug": true,
  "port": 3000,
  "host": "localhost",
  "logLevel": "info"
}
EOF

cat > "$RIGHT/config/settings.json" << 'EOF'
{
  "debug": false,
  "port": 8080,
  "host": "0.0.0.0",
  "logLevel": "warn"
}
EOF

# Identical doc
cat > "$LEFT/docs/guide.md" << 'EOF'
# User Guide

Getting started with the project.
EOF
cp "$LEFT/docs/guide.md" "$RIGHT/docs/guide.md"

# Right-only doc
cat > "$RIGHT/docs/changelog.md" << 'EOF'
# Changelog

## v1.1.0
- Added modulo function
- Changed divide-by-zero behavior
EOF

# 3-way merge sample files
cat > "$BASE" << 'EOF'
function processData(input) {
  const data = parseInput(input);
  const filtered = data.filter(item => item.active);
  const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name));
  return sorted.map(item => ({
    id: item.id,
    name: item.name,
    value: item.value,
  }));
}

function parseInput(raw) {
  return JSON.parse(raw);
}

function formatOutput(items) {
  return items.map(item => `${item.name}: ${item.value}`).join('\n');
}
EOF

cat > "$MERGE_LEFT" << 'EOF'
function processData(input) {
  const data = parseInput(input);
  const validated = data.filter(item => item.active && item.value > 0);
  const sorted = validated.sort((a, b) => a.name.localeCompare(b.name));
  return sorted.map(item => ({
    id: item.id,
    name: item.name.trim(),
    value: item.value,
    timestamp: Date.now(),
  }));
}

function parseInput(raw) {
  return JSON.parse(raw);
}

function formatOutput(items) {
  return items.map(item => `${item.name}: ${item.value}`).join('\n');
}
EOF

cat > "$MERGE_RIGHT" << 'EOF'
function processData(input) {
  const data = parseInput(input);
  const filtered = data.filter(item => item.active);
  const sorted = filtered.sort((a, b) => b.value - a.value);
  return sorted.map(item => ({
    id: item.id,
    name: item.name,
    value: item.value,
  }));
}

function parseInput(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Parse error:', e);
    return [];
  }
}

function formatOutput(items) {
  const header = '--- Output ---';
  const body = items.map(item => `${item.name}: ${item.value}`).join('\n');
  return `${header}\n${body}`;
}
EOF

echo "Sample data created at: $SAMPLE_DIR"
echo ""
echo "Directory comparison:"
echo "  left:  $LEFT"
echo "  right: $RIGHT"
echo ""
echo "3-way merge:"
echo "  base:  $BASE"
echo "  left:  $MERGE_LEFT"
echo "  right: $MERGE_RIGHT"
