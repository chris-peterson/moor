export const BINARY_SENTINEL = '\x00BINARY';

function myersDiff(a, b, equals) {
  const N = a.length;
  const M = b.length;
  const MAX = N + M;

  if (MAX === 0) return [];

  const eq = equals || ((x, y) => x === y);

  // V stores the x-coordinate of the furthest reaching path for each diagonal k.
  // We keep a history of V at each step d for backtracking.
  const vHistory = [];
  const v = new Map();
  v.set(1, 0);

  let found = false;
  let finalD = 0;

  for (let d = 0; d <= MAX; d++) {
    const vSnapshot = new Map(v);
    vHistory.push(vSnapshot);

    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))) {
        x = v.get(k + 1) ?? 0;
      } else {
        x = (v.get(k - 1) ?? 0) + 1;
      }
      let y = x - k;

      while (x < N && y < M && eq(a[x], b[y])) {
        x++;
        y++;
      }

      v.set(k, x);

      if (x >= N && y >= M) {
        found = true;
        finalD = d;
        break;
      }
    }
    if (found) break;
  }

  // Backtrack to recover the edit script
  const edits = [];
  let x = N;
  let y = M;

  for (let d = finalD; d > 0; d--) {
    const vPrev = vHistory[d];
    const k = x - y;

    let prevK;
    if (k === -d || (k !== d && (vPrev.get(k - 1) ?? -1) < (vPrev.get(k + 1) ?? -1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    let prevX = vPrev.get(prevK) ?? 0;
    let prevY = prevX - prevK;

    // Diagonal (equal) moves from the snake
    while (x > prevX && y > prevY) {
      x--;
      y--;
      edits.unshift({ type: 'equal', oldIdx: x, newIdx: y });
    }

    if (d > 0) {
      if (x === prevX) {
        y--;
        edits.unshift({ type: 'insert', newIdx: y });
      } else {
        x--;
        edits.unshift({ type: 'delete', oldIdx: x });
      }
    }

    x = prevX;
    y = prevY;
  }

  // Any remaining diagonal at d=0
  while (x > 0 && y > 0) {
    x--;
    y--;
    edits.unshift({ type: 'equal', oldIdx: x, newIdx: y });
  }

  return edits;
}

function groupIntoHunks(edits, oldLen, newLen) {
  if (edits.length === 0) {
    if (oldLen === 0 && newLen === 0) return [];
    return [];
  }

  const hunks = [];
  let currentType = edits[0].type;
  let oldStart = edits[0].oldIdx ?? null;
  let newStart = edits[0].newIdx ?? null;
  let oldEnd = oldStart;
  let newEnd = newStart;

  function pushHunk() {
    hunks.push({
      type: currentType,
      oldStart: oldStart !== null ? oldStart : -1,
      oldEnd: oldEnd !== null ? oldEnd : -1,
      newStart: newStart !== null ? newStart : -1,
      newEnd: newEnd !== null ? newEnd : -1,
    });
  }

  for (let i = 1; i < edits.length; i++) {
    const edit = edits[i];
    if (edit.type === currentType) {
      if (edit.oldIdx !== undefined) oldEnd = edit.oldIdx;
      if (edit.newIdx !== undefined) newEnd = edit.newIdx;
    } else {
      pushHunk();
      currentType = edit.type;
      oldStart = edit.oldIdx ?? null;
      newStart = edit.newIdx ?? null;
      oldEnd = oldStart;
      newEnd = newStart;
    }
  }
  pushHunk();

  return hunks;
}

export function computeLineChanges(oldLines, newLines) {
  const edits = myersDiff(oldLines, newLines, (a, b) => a.trimEnd() === b.trimEnd());
  return groupIntoHunks(edits, oldLines.length, newLines.length);
}

// Display hunks pair adjacent delete+insert blocks into a single review unit,
// matching the row pairing in FileDiffView. ReviewShell uses this to size its
// progress bar against what the reviewer will actually navigate through.
export function countDisplayHunks(hunks) {
  let count = 0;
  for (let i = 0; i < hunks.length; i++) {
    if (hunks[i].type === 'equal') continue;
    if (hunks[i].type === 'delete' && hunks[i + 1]?.type === 'insert') {
      count++;
      i++;
    } else {
      count++;
    }
  }
  return count;
}

// Expand line-level hunks into per-row display records, pairing adjacent
// delete+insert blocks as `modify` rows. This is the same expansion the diff
// view renders, exposed here so ReviewShell can derive per-hunk line numbers
// for the EC-5 sidecar without recomputing it differently.
export function buildDisplayRows(leftLines, rightLines, hunks) {
  const rows = [];
  for (let h = 0; h < hunks.length; h++) {
    const hunk = hunks[h];
    if (hunk.type === 'equal') {
      for (let o = hunk.oldStart, n = hunk.newStart; o <= hunk.oldEnd; o++, n++) {
        rows.push({ type: 'equal', leftLine: leftLines[o], rightLine: rightLines[n], leftNum: o + 1, rightNum: n + 1 });
      }
    } else if (hunk.type === 'delete') {
      const next = hunks[h + 1];
      if (next && next.type === 'insert') {
        const delCount = hunk.oldEnd - hunk.oldStart + 1;
        const insCount = next.newEnd - next.newStart + 1;
        const paired = Math.min(delCount, insCount);
        for (let i = 0; i < paired; i++) {
          rows.push({ type: 'modify', leftLine: leftLines[hunk.oldStart + i], rightLine: rightLines[next.newStart + i], leftNum: hunk.oldStart + i + 1, rightNum: next.newStart + i + 1 });
        }
        for (let i = paired; i < delCount; i++) {
          rows.push({ type: 'delete', leftLine: leftLines[hunk.oldStart + i], rightLine: null, leftNum: hunk.oldStart + i + 1, rightNum: null });
        }
        for (let i = paired; i < insCount; i++) {
          rows.push({ type: 'insert', leftLine: null, rightLine: rightLines[next.newStart + i], leftNum: null, rightNum: next.newStart + i + 1 });
        }
        h++;
      } else {
        for (let o = hunk.oldStart; o <= hunk.oldEnd; o++) {
          rows.push({ type: 'delete', leftLine: leftLines[o], rightLine: null, leftNum: o + 1, rightNum: null });
        }
      }
    } else if (hunk.type === 'insert') {
      for (let n = hunk.newStart; n <= hunk.newEnd; n++) {
        rows.push({ type: 'insert', leftLine: null, rightLine: rightLines[n], leftNum: null, rightNum: n + 1 });
      }
    }
  }
  return rows;
}

// Return [{ line }, ...] indexed by display hunk index, where `line` is the
// 1-based line number of the hunk's first row (rightNum preferred, leftNum
// for pure-deletions). Used by the EC-5 sidecar to populate `line` for every
// rejected hunk without having to plumb FileDiffView state up to ReviewShell.
export function computeHunkStartLines(leftContent, rightContent) {
  if (leftContent === BINARY_SENTINEL || rightContent === BINARY_SENTINEL) {
    return [{ line: 1 }];
  }
  const leftLines = leftContent ? leftContent.split('\n') : [];
  const rightLines = rightContent ? rightContent.split('\n') : [];
  const hunks = computeLineChanges(leftLines, rightLines);
  const rows = buildDisplayRows(leftLines, rightLines, hunks);

  const starts = [];
  let inHunk = false;
  for (const row of rows) {
    if (row.type === 'equal') {
      inHunk = false;
    } else if (!inHunk) {
      inHunk = true;
      starts.push({ line: row.rightNum || row.leftNum || 1 });
    }
  }
  return starts;
}

export function diffLines(oldText, newText) {
  const oldLines = oldText.length === 0 ? [] : oldText.split('\n');
  const newLines = newText.length === 0 ? [] : newText.split('\n');
  return computeLineChanges(oldLines, newLines);
}

function tokenize(str) {
  const tokens = [];
  const re = /(\s+|[a-zA-Z0-9_]+|[^\s\w])/g;
  let match;
  while ((match = re.exec(str)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function groupEditsIntoSpans(edits, oldSeq, newSeq) {
  if (edits.length === 0) return [];
  const valueAt = (edit) => edit.type === 'insert' ? newSeq[edit.newIdx] : oldSeq[edit.oldIdx];
  const result = [];
  let currentType = edits[0].type;
  let currentValue = valueAt(edits[0]);
  for (let i = 1; i < edits.length; i++) {
    const edit = edits[i];
    if (edit.type === currentType) {
      currentValue += valueAt(edit);
    } else {
      result.push({ type: currentType, value: currentValue });
      currentType = edit.type;
      currentValue = valueAt(edit);
    }
  }
  result.push({ type: currentType, value: currentValue });
  return result;
}

function diffTokens(oldTokens, newTokens) {
  const edits = myersDiff(oldTokens, newTokens, (a, b) => a === b);
  return groupEditsIntoSpans(edits, oldTokens, newTokens);
}

function diffCharLevel(oldStr, newStr) {
  const oldChars = Array.from(oldStr);
  const newChars = Array.from(newStr);
  const edits = myersDiff(oldChars, newChars);
  return groupEditsIntoSpans(edits, oldChars, newChars);
}

// Heuristic: within each word boundary, if there's a single contiguous diff
// region, use character-level (precise). If there are multiple diff regions
// in the same word, use word-level (cleaner).
export function diffChars(oldStr, newStr) {
  const wordResult = diffTokens(tokenize(oldStr), tokenize(newStr));

  // For each adjacent delete+insert pair, try char-level refinement
  const output = [];
  let i = 0;
  while (i < wordResult.length) {
    if (wordResult[i].type === 'delete' && i + 1 < wordResult.length && wordResult[i + 1].type === 'insert') {
      const oldPart = wordResult[i].value;
      const newPart = wordResult[i + 1].value;
      const charDiff = diffCharLevel(oldPart, newPart);

      const changeRegions = charDiff.filter(p => p.type !== 'equal').length;
      const equalChars = charDiff.filter(p => p.type === 'equal').reduce((sum, p) => sum + p.value.length, 0);
      const totalChars = Math.max(oldPart.length, newPart.length);
      const equalRatio = totalChars > 0 ? equalChars / totalChars : 0;

      if (changeRegions <= 2 && equalRatio >= 0.5) {
        output.push(...charDiff);
      } else {
        output.push(wordResult[i], wordResult[i + 1]);
      }
      i += 2;
    } else {
      output.push(wordResult[i]);
      i++;
    }
  }

  return output;
}
