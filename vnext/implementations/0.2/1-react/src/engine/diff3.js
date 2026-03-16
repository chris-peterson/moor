import { computeLineChanges } from './diff.js';

function expandHunks(hunks, oldLines, newLines) {
  const mapping = [];

  for (const hunk of hunks) {
    if (hunk.type === 'equal') {
      for (let o = hunk.oldStart, n = hunk.newStart; o <= hunk.oldEnd; o++, n++) {
        mapping.push({ type: 'equal', oldIdx: o, newIdx: n });
      }
    } else if (hunk.type === 'delete') {
      for (let o = hunk.oldStart; o <= hunk.oldEnd; o++) {
        mapping.push({ type: 'delete', oldIdx: o });
      }
    } else if (hunk.type === 'insert') {
      for (let n = hunk.newStart; n <= hunk.newEnd; n++) {
        mapping.push({ type: 'insert', newIdx: n });
      }
    }
  }

  return mapping;
}

// Build a per-base-line classification of what each side did.
// Returns an array indexed by base line number with entries:
// { leftStatus: 'unchanged'|'deleted'|'modified', rightStatus: same, leftLines, rightLines }
function classifyBaseLines(baseLines, leftLines, rightLines) {
  const leftHunks = computeLineChanges(baseLines, leftLines);
  const rightHunks = computeLineChanges(baseLines, rightLines);

  const leftEdits = expandHunks(leftHunks, baseLines, leftLines);
  const rightEdits = expandHunks(rightHunks, baseLines, rightLines);

  // Build maps: for each base line index, track what happened on each side.
  // Also track insertions that occur *before* a given base line index.
  const leftBaseMap = new Map();
  const rightBaseMap = new Map();
  const leftInsertBefore = new Map();
  const rightInsertBefore = new Map();

  buildSideMap(leftEdits, leftLines, leftBaseMap, leftInsertBefore);
  buildSideMap(rightEdits, rightLines, rightBaseMap, rightInsertBefore);

  return { leftBaseMap, rightBaseMap, leftInsertBefore, rightInsertBefore };
}

function buildSideMap(edits, sideLines, baseMap, insertBefore) {
  let lastBaseIdx = -1;

  for (const edit of edits) {
    if (edit.type === 'equal') {
      baseMap.set(edit.oldIdx, { status: 'unchanged', line: sideLines[edit.newIdx] });
      lastBaseIdx = edit.oldIdx;
    } else if (edit.type === 'delete') {
      baseMap.set(edit.oldIdx, { status: 'deleted' });
      lastBaseIdx = edit.oldIdx;
    } else if (edit.type === 'insert') {
      // Insertions are anchored after the last base line we saw.
      const anchor = lastBaseIdx + 1;
      if (!insertBefore.has(anchor)) insertBefore.set(anchor, []);
      insertBefore.get(anchor).push(sideLines[edit.newIdx]);
    }
  }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function mergeAdjacentRegions(regions) {
  if (regions.length === 0) return regions;

  const merged = [regions[0]];
  for (let i = 1; i < regions.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = regions[i];

    if (prev.type === curr.type) {
      prev.baseLines = prev.baseLines.concat(curr.baseLines);
      prev.leftLines = prev.leftLines.concat(curr.leftLines);
      prev.rightLines = prev.rightLines.concat(curr.rightLines);
      if (prev.resolvedLines !== null && curr.resolvedLines !== null) {
        prev.resolvedLines = prev.resolvedLines.concat(curr.resolvedLines);
      } else {
        prev.resolvedLines = null;
      }
    } else {
      merged.push({ ...curr, baseLines: [...curr.baseLines], leftLines: [...curr.leftLines], rightLines: [...curr.rightLines], resolvedLines: curr.resolvedLines ? [...curr.resolvedLines] : null });
    }
  }

  return merged;
}

export function diff3Merge(baseText, leftText, rightText) {
  const baseLines = baseText.length === 0 ? [] : baseText.split('\n');
  const leftLines = leftText.length === 0 ? [] : leftText.split('\n');
  const rightLines = rightText.length === 0 ? [] : rightText.split('\n');

  const { leftBaseMap, rightBaseMap, leftInsertBefore, rightInsertBefore } =
    classifyBaseLines(baseLines, leftLines, rightLines);

  const regions = [];
  let conflicts = 0;

  function pushRegion(type, base, left, right, resolved) {
    regions.push({
      type,
      baseLines: base,
      leftLines: left,
      rightLines: right,
      resolvedLines: resolved,
    });
    if (type === 'conflict') conflicts++;
  }

  function flushPending(pending) {
    if (pending.base.length === 0 && pending.left.length === 0 && pending.right.length === 0) {
      return;
    }

    const leftChanged = !arraysEqual(pending.base, pending.left);
    const rightChanged = !arraysEqual(pending.base, pending.right);

    if (!leftChanged && !rightChanged) {
      pushRegion('unchanged', pending.base, pending.left, pending.right, [...pending.base]);
    } else if (leftChanged && !rightChanged) {
      pushRegion('left-only', pending.base, pending.left, pending.right, [...pending.left]);
    } else if (!leftChanged && rightChanged) {
      pushRegion('right-only', pending.base, pending.left, pending.right, [...pending.right]);
    } else if (arraysEqual(pending.left, pending.right)) {
      pushRegion('both-changed', pending.base, pending.left, pending.right, [...pending.left]);
    } else {
      pushRegion('conflict', pending.base, pending.left, pending.right, null);
    }
  }

  // Walk through base lines, collecting runs that share the same classification.
  let pending = { base: [], left: [], right: [] };
  let prevClassification = null;

  function classifyAt(baseIdx) {
    const l = leftBaseMap.get(baseIdx);
    const r = rightBaseMap.get(baseIdx);
    const lStatus = l ? l.status : 'deleted';
    const rStatus = r ? r.status : 'deleted';

    if (lStatus === 'unchanged' && rStatus === 'unchanged') return 'unchanged';
    if (lStatus !== 'unchanged' && rStatus === 'unchanged') return 'left-only';
    if (lStatus === 'unchanged' && rStatus !== 'unchanged') return 'right-only';
    return 'both';
  }

  function handleInsertions(anchor) {
    const li = leftInsertBefore.get(anchor) || [];
    const ri = rightInsertBefore.get(anchor) || [];

    if (li.length === 0 && ri.length === 0) return;

    flushPending(pending);
    pending = { base: [], left: [], right: [] };
    prevClassification = null;

    if (li.length > 0 && ri.length === 0) {
      pushRegion('left-only', [], [...li], [], [...li]);
    } else if (li.length === 0 && ri.length > 0) {
      pushRegion('right-only', [], [], [...ri], [...ri]);
    } else if (arraysEqual(li, ri)) {
      pushRegion('both-changed', [], [...li], [...ri], [...li]);
    } else {
      pushRegion('conflict', [], [...li], [...ri], null);
    }
  }

  // Handle insertions before the first base line
  handleInsertions(0);

  for (let i = 0; i < baseLines.length; i++) {
    const cls = classifyAt(i);

    if (prevClassification !== null && cls !== prevClassification) {
      flushPending(pending);
      pending = { base: [], left: [], right: [] };
    }

    prevClassification = cls;
    pending.base.push(baseLines[i]);

    const l = leftBaseMap.get(i);
    const r = rightBaseMap.get(i);

    if (l && l.status === 'unchanged') {
      pending.left.push(l.line);
    } else if (l && l.status === 'deleted') {
      // line deleted on left — don't add to pending.left
    } else {
      pending.left.push(baseLines[i]);
    }

    if (r && r.status === 'unchanged') {
      pending.right.push(r.line);
    } else if (r && r.status === 'deleted') {
      // line deleted on right — don't add to pending.right
    } else {
      pending.right.push(baseLines[i]);
    }

    // Handle insertions after this base line
    handleInsertions(i + 1);
  }

  flushPending(pending);

  const merged = mergeAdjacentRegions(regions);
  const mergedConflicts = merged.filter(r => r.type === 'conflict').length;

  return { regions: merged, conflicts: mergedConflicts };
}
