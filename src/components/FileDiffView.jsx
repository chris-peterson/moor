import React, { useMemo, useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { computeLineChanges, diffChars, buildDisplayRows, BINARY_SENTINEL } from '../engine/diff.js';
import { DEFAULT_ACTION, ACTIONS, isBlocking, commentToOutput, actionColor, actionBg, actionLabel } from '../engine/comments.js';
import Minimap from './Minimap.jsx';

const TAB_SPACES = '    ';
function expandTabs(str) {
  return str == null ? '' : str.replaceAll('\t', TAB_SPACES);
}

function areSimilarEnough(a, b) {
  if (!a || !b) return false;
  // Compare distinct word tokens, not characters — English sentences always
  // share most letters of the alphabet, so a char-set check returns true even
  // for completely different lines and produces noisy per-word badges.
  const tokensA = new Set(a.match(/[a-zA-Z0-9_]+/g) || []);
  const tokensB = new Set(b.match(/[a-zA-Z0-9_]+/g) || []);
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let common = 0;
  for (const t of tokensA) if (tokensB.has(t)) common++;
  return common / Math.max(tokensA.size, tokensB.size) > 0.4;
}

const ROW_HEIGHT = Math.ceil(15 * 1.6); // 24px — fits active font (15px)
const OVERSCAN = 20;
const H_SCROLL_STEP = 40;
const V_SCROLL_STEP = ROW_HEIGHT * 3;
const RESIZER_WIDTH = 5;
const BAR_WIDTH = 3;
// CO-04 gesture thresholds: a press that moves more than DRAG_PX, or onto
// another row, is a range drag; a press held LONG_PRESS_MS without moving is a
// single-line comment; a quick release is a plain review click.
const LONG_PRESS_MS = 400;
const DRAG_PX = 4;

function CharDiffSpans({ oldStr, newStr, side }) {
  const parts = useMemo(() => diffChars(oldStr || '', newStr || ''), [oldStr, newStr]);
  return (
    <>
      {parts.map((part, i) => {
        if (side === 'left') {
          if (part.type === 'insert') return null;
          const highlight = part.type === 'delete';
          return (
            <span key={i} style={highlight ? { background: 'var(--color-left)', color: 'var(--bg-deep)', borderRadius: '2px' } : undefined}>
              {expandTabs(part.value)}
            </span>
          );
        } else {
          if (part.type === 'delete') return null;
          const highlight = part.type === 'insert';
          return (
            <span key={i} style={highlight ? { background: 'var(--color-right)', color: 'var(--bg-deep)', borderRadius: '2px' } : undefined}>
              {expandTabs(part.value)}
            </span>
          );
        }
      })}
    </>
  );
}

function DiffRow({ row, idx, active, reviewed, commentAction, selected, scrollLeft, leftWidth, rightWidth, onResizerMouseDown, onClick, onContextMenu, onGutterMouseDown, onRowEnter }) {
  const fontSize = active ? '15px' : '13px';
  const dimmed = reviewed && !active;

  const barColor = active
    ? 'var(--color-accent)'
    : (commentAction ? actionColor(commentAction) : 'transparent');

  const gutterStyle = {
    width: '48px',
    minWidth: '48px',
    textAlign: 'right',
    paddingRight: '8px',
    fontFamily: 'var(--font-mono)',
    fontSize,
    lineHeight: ROW_HEIGHT + 'px',
    color: 'var(--text-muted)',
    userSelect: 'none',
    flexShrink: 0,
  };

  const cellBg = (type, side) => {
    if (selected) return 'var(--color-accent-bg)';
    if (commentAction) return actionBg(commentAction);
    if (dimmed) return 'var(--bg-reviewed)';
    if (type === 'delete' && side === 'left') return 'var(--color-left-bg)';
    if (type === 'insert' && side === 'right') return 'var(--color-right-bg)';
    return 'transparent';
  };

  const codeStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize,
    lineHeight: ROW_HEIGHT + 'px',
    whiteSpace: 'pre',
    flex: 1,
    paddingLeft: '8px',
    transform: scrollLeft ? `translateX(-${scrollLeft}px)` : undefined,
  };

  const isModify = row.type === 'modify';
  const showCharDiff = isModify && areSimilarEnough(row.leftLine, row.rightLine);
  const leftType = isModify ? 'delete' : row.type;
  const rightType = isModify ? 'insert' : row.type;
  const isHunk = row.type !== 'equal';

  // The comment affordance (CO-04) lives on the NEW (right) side's line-number
  // gutter only — review feedback references the new file, so commenting on the
  // old (left) side would be ambiguous. Pressing the right gutter starts the
  // click / drag / long-press gesture; code-area text stays selectable.
  // onMouseEnter extends a range drag. The left gutter is inert (a click on a
  // changed row still marks it reviewed via the row's onClick).
  return (
    <div
      onClick={isHunk ? onClick : undefined}
      onContextMenu={onContextMenu}
      onMouseEnter={() => onRowEnter(idx)}
      style={{ display: 'flex', height: ROW_HEIGHT + 'px', cursor: isHunk ? 'pointer' : 'default' }}
    >
      <div style={{ width: BAR_WIDTH + 'px', flexShrink: 0, background: barColor }} />
      <div style={{ width: leftWidth + 'px', display: 'flex', overflow: 'clip', background: cellBg(leftType, 'left') }}>
        <span style={{ ...gutterStyle, cursor: isHunk ? 'pointer' : 'default' }}>{row.leftNum ?? ''}</span>
        <span style={codeStyle}>
          {showCharDiff
            ? <CharDiffSpans oldStr={row.leftLine} newStr={row.rightLine} side="left" />
            : expandTabs(row.leftLine)}
        </span>
      </div>
      <div onMouseDown={onResizerMouseDown} style={{ width: RESIZER_WIDTH + 'px', flexShrink: 0, background: 'var(--border)', cursor: 'col-resize' }} />
      <div style={{ width: rightWidth + 'px', display: 'flex', overflow: 'clip', background: cellBg(rightType, 'right') }}>
        <span data-gutter="1" onMouseDown={(e) => onGutterMouseDown(e, idx)} style={{ ...gutterStyle, cursor: 'pointer' }}>{row.rightNum ?? ''}</span>
        <span style={codeStyle}>
          {showCharDiff
            ? <CharDiffSpans oldStr={row.leftLine} newStr={row.rightLine} side="right" />
            : expandTabs(row.rightLine)}
        </span>
      </div>
    </div>
  );
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|bmp|webp|svg|ico)$/i;

export function FileDiffView({ leftPath, rightPath, leftContent, rightContent, leftFullPath, rightFullPath, onNavigateNext, onNavigatePrev, onNavigatePrevFile, startAtEnd, startAtRow, onHunkChange, reviewedHunks: externalReviewedHunks, onReviewedHunksChange, fileComments = [], onAddComment, onUpdateComment, onSetCommentAction, onDeleteComment, onAddFileComment, paused = false }) {
  const leftBinary = leftContent === BINARY_SENTINEL;
  const rightBinary = rightContent === BINARY_SENTINEL;
  const isBinary = leftBinary || rightBinary;
  const isImage = isBinary && (IMAGE_EXTENSIONS.test(leftPath || '') || IMAGE_EXTENSIONS.test(rightPath || ''));

  const fileKey = rightFullPath || leftFullPath || rightPath || leftPath || '';

  const [leftDataUrl, setLeftDataUrl] = useState(null);
  const [rightDataUrl, setRightDataUrl] = useState(null);

  useEffect(() => {
    if (!isImage) { setLeftDataUrl(null); setRightDataUrl(null); return; }
    const api = window.moor;
    if (!api?.readFileAsDataUrl) return;
    let cancelled = false;
    (async () => {
      const [l, r] = await Promise.all([
        leftFullPath ? api.readFileAsDataUrl(leftFullPath) : Promise.resolve(null),
        rightFullPath ? api.readFileAsDataUrl(rightFullPath) : Promise.resolve(null),
      ]);
      if (!cancelled) { setLeftDataUrl(l); setRightDataUrl(r); }
    })();
    return () => { cancelled = true; };
  }, [isImage, leftFullPath, rightFullPath]);

  const leftLines = useMemo(() => isBinary || !leftContent ? [] : leftContent.split('\n'), [leftContent, isBinary]);
  const rightLines = useMemo(() => isBinary || !rightContent ? [] : rightContent.split('\n'), [rightContent, isBinary]);

  const hunks = useMemo(() => isBinary ? [] : computeLineChanges(leftLines, rightLines), [leftLines, rightLines, isBinary]);
  const rows = useMemo(() => isBinary ? [] : buildDisplayRows(leftLines, rightLines, hunks), [leftLines, rightLines, hunks, isBinary]);

  const scrollContainerRef = useRef(null);
  const contentAreaRef = useRef(null);
  const headerRef = useRef(null);
  const hScrollRef = useRef(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [currentHunk, setCurrentHunk] = useState(0);
  const [internalReviewedHunks, setInternalReviewedHunks] = useState(() => new Set());
  const reviewedHunks = externalReviewedHunks || internalReviewedHunks;
  const setReviewedHunks = onReviewedHunksChange || setInternalReviewedHunks;
  // CO-06: the inline comment composer. null when closed; otherwise
  // { commentId|null, action, body, target } where target is a range.
  const [composing, setComposing] = useState(null);
  const composerRef = useRef(null);
  // Mirror `composing` into a ref and guard commits so Enter-then-blur (or a
  // StrictMode double-invoke) can't write the same comment twice.
  const composingRef = useRef(null);
  const committedRef = useRef(false);
  useEffect(() => { composingRef.current = composing; }, [composing]);
  // The live line-range selection during a gutter drag (CO-04).
  const [selection, setSelection] = useState(null);
  const pressRef = useRef(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [draggingResizer, setDraggingResizer] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const errorToastTimerRef = useRef(null);

  const showErrorToast = useCallback((message) => {
    setErrorToast(message);
    if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current);
    errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 3000);
  }, []);

  const handleOpenInEditor = useCallback((line) => {
    if (!window.moor?.openInEditor || !rightPath) return;
    window.moor.openInEditor(rightPath, line, 1).then(r => {
      if (r && !r.found) showErrorToast(r.error || 'Could not open in editor');
    });
  }, [rightPath, showErrorToast]);
  const contextMenuRef = useRef(null);
  const totalHeight = rows.length * ROW_HEIGHT;
  // NV-13 bottom pad: lets a hunk near end-of-file scroll into the
  // "second visible row" position even when the file isn't tall enough.
  const bottomPad = Math.max(0, viewportHeight - headerHeight - 2 * ROW_HEIGHT);

  const widestCandidates = useMemo(() => {
    const K = 10;
    const all = [];
    for (const row of rows) {
      if (row.leftLine) all.push(expandTabs(row.leftLine));
      if (row.rightLine) all.push(expandTabs(row.rightLine));
    }
    all.sort((a, b) => b.length - a.length);
    return all.slice(0, K);
  }, [rows]);

  const [maxContentWidth, setMaxContentWidth] = useState(0);
  const measureContainerRef = useRef(null);

  useEffect(() => {
    const el = measureContainerRef.current;
    if (!el) { setMaxContentWidth(0); return; }
    const recompute = () => {
      let max = 0;
      for (const child of el.children) {
        const w = child.getBoundingClientRect().width;
        if (w > max) max = w;
      }
      setMaxContentWidth(max + 8);
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [widestCandidates]);

  const hunkRanges = useMemo(() => {
    const ranges = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].type !== 'equal' && (i === 0 || rows[i - 1].type === 'equal')) {
        ranges.push({ start: i, end: i });
      } else if (rows[i].type !== 'equal' && ranges.length > 0) {
        ranges[ranges.length - 1].end = i;
      }
    }
    return ranges;
  }, [rows]);

  const rowToHunk = useMemo(() => {
    const map = new Map();
    for (let h = 0; h < hunkRanges.length; h++) {
      for (let i = hunkRanges[h].start; i <= hunkRanges[h].end; i++) {
        map.set(i, h);
      }
    }
    return map;
  }, [hunkRanges]);

  const lineForRow = useCallback((rowIdx) => {
    const row = rows[rowIdx];
    return row?.rightNum ?? row?.leftNum ?? 1;
  }, [rows]);

  // Standalone-mode (no ReviewShell parent) quit-state mirror. In the app every
  // FileDiffView has an onNavigateNext, so this is the defensive path only.
  useEffect(() => {
    if (onNavigateNext) return;
    const unreviewed = Math.max(0, hunkRanges.length - reviewedHunks.size);
    const fixNow = fileComments.filter(c => isBlocking(c.action) && (c.body || '').trim()).length;
    window.__moorQuitState = { fixNow, unreviewed, comments: fileComments.map(commentToOutput).filter(c => c.body) };
    return () => { window.__moorQuitState = null; };
  }, [hunkRanges, reviewedHunks, fileComments, onNavigateNext]);

  // Grow the composer textarea to fit its content (capped).
  const resizeComposer = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 320) + 'px';
  }, []);

  useEffect(() => {
    if (composing && composerRef.current) {
      composerRef.current.focus();
      const len = composerRef.current.value.length;
      composerRef.current.setSelectionRange(len, len);
      resizeComposer();
    }
  }, [composing, resizeComposer]);

  const activeRowSet = useMemo(() => {
    if (hunkRanges.length === 0) return new Set();
    const range = hunkRanges[currentHunk];
    if (!range) return new Set();
    const set = new Set();
    for (let i = range.start; i <= range.end; i++) set.add(i);
    return set;
  }, [hunkRanges, currentHunk]);

  const reviewedRowSet = useMemo(() => {
    const set = new Set();
    for (const hIdx of reviewedHunks) {
      const range = hunkRanges[hIdx];
      if (range) {
        for (let i = range.start; i <= range.end; i++) set.add(i);
      }
    }
    return set;
  }, [hunkRanges, reviewedHunks]);

  // Per-row action of the highest-severity comment covering it — drives the row
  // tint, the bar, and the minimap markers. The in-progress composer counts too,
  // so the range bands while you type.
  const rowActionMap = useMemo(() => {
    const rank = { 'consider': 0, 'fix-later': 1, 'fix-now': 2 };
    const map = new Map();
    const apply = (startRow, endRow, action) => {
      if (startRow == null) return;
      for (let i = startRow; i <= endRow; i++) {
        const cur = map.get(i);
        if (cur == null || rank[action] > rank[cur]) map.set(i, action);
      }
    };
    for (const c of fileComments) apply(c.target?.startRow, c.target?.endRow, c.action);
    if (composing && composing.target?.type === 'range') {
      apply(composing.target.startRow, composing.target.endRow, composing.action);
    }
    return map;
  }, [fileComments, composing]);

  const commentRowColors = useMemo(() => {
    const map = new Map();
    for (const [rowIdx, action] of rowActionMap) map.set(rowIdx, actionColor(action));
    return map;
  }, [rowActionMap]);

  // CO-07: one outline band per comment range (and the live composer range),
  // spanning its rows in the action color so the covered lines are unmistakable.
  const commentBands = useMemo(() => {
    const bands = [];
    for (const c of fileComments) {
      const t = c.target || {};
      if (t.startRow == null) continue;
      if (composing && composing.commentId === c.id) continue; // composer band covers it
      bands.push({ key: `band-${c.id}`, startRow: t.startRow, endRow: t.endRow, action: c.action });
    }
    if (composing && composing.target?.type === 'range') {
      bands.push({ key: 'band-composing', startRow: composing.target.startRow, endRow: composing.target.endRow, action: composing.action });
    }
    return bands;
  }, [fileComments, composing]);

  const selectionRowSet = useMemo(() => {
    if (!selection) return null;
    const set = new Set();
    for (let i = selection.startRow; i <= selection.endRow; i++) set.add(i);
    return set;
  }, [selection]);

  const maxScroll = useMemo(() => {
    if (!viewportWidth) return 0;
    const availableWidth = Math.max(0, viewportWidth - BAR_WIDTH - RESIZER_WIDTH);
    const leftW = Math.round(availableWidth * splitPercent / 100);
    const rightW = availableWidth - leftW;
    const codeAreaWidth = Math.max(0, Math.min(leftW, rightW) - 64);
    return Math.max(0, maxContentWidth - codeAreaWidth);
  }, [maxContentWidth, viewportWidth, splitPercent]);

  useEffect(() => {
    if (onHunkChange) onHunkChange(currentHunk, hunkRanges.length);
  }, [currentHunk, hunkRanges.length, onHunkChange]);

  // Scroll to current hunk after render (useLayoutEffect = uses updated state, fires before paint)
  const scrolledForKey = useRef(null);
  useLayoutEffect(() => {
    if (!scrollContainerRef.current) return;
    const fileKeyId = `${leftPath ?? ''}|${rightPath ?? ''}`;
    if (hunkRanges.length === 0) {
      scrollContainerRef.current.scrollTop = 0;
      scrolledForKey.current = fileKeyId;
      return;
    }
    const isFirstScrollForFile = scrolledForKey.current !== fileKeyId;
    // IM.OUT-03: a fix-now badge navigates to a specific row — scroll straight
    // to it on the first pass for the file.
    if (isFirstScrollForFile && startAtRow != null) {
      scrollContainerRef.current.scrollTop = Math.max(0, (startAtRow - 1) * ROW_HEIGHT);
      scrolledForKey.current = fileKeyId;
      setScrollLeft(0);
      return;
    }
    let effectiveHunk = currentHunk;
    if (isFirstScrollForFile) {
      if (startAtEnd) {
        effectiveHunk = hunkRanges.length - 1;
      } else {
        // NV-04: first unreviewed hunk; fall back to the first hunk.
        effectiveHunk = 0;
        for (let i = 0; i < hunkRanges.length; i++) {
          if (!reviewedHunks.has(i)) { effectiveHunk = i; break; }
        }
      }
    }
    const range = hunkRanges[effectiveHunk];
    if (!range) return;
    scrolledForKey.current = fileKeyId;
    const topAtRow2 = Math.max(0, (range.start - 1) * ROW_HEIGHT);
    const scrollForBottom = (range.end + 1) * ROW_HEIGHT + headerHeight - viewportHeight;
    const topFlush = range.start * ROW_HEIGHT;
    let target;
    if (scrollForBottom <= topAtRow2) {
      target = topAtRow2;
    } else if (scrollForBottom <= topFlush) {
      target = scrollForBottom;
    } else {
      target = topAtRow2;
    }
    target = Math.max(0, target);
    if (isFirstScrollForFile) {
      scrollContainerRef.current.scrollTop = target;
    } else {
      const ev = Math.max(0, viewportHeight - headerHeight);
      const visibleTop = scrollContainerRef.current.scrollTop;
      const hunkTopY = range.start * ROW_HEIGHT;
      const hunkBottomY = (range.end + 1) * ROW_HEIGHT;
      if (hunkTopY >= visibleTop && hunkBottomY <= visibleTop + ev) {
        return;
      }
      scrollContainerRef.current.scrollTo({ top: target, behavior: 'smooth' });
    }
    setScrollLeft(0);
  }, [currentHunk, hunkRanges, viewportHeight, headerHeight]);

  const markRowReviewed = useCallback((rowIdx) => {
    const hIdx = rowToHunk.get(rowIdx);
    if (hIdx == null) return;
    setReviewedHunks(prev => {
      const next = new Set(prev);
      next.add(hIdx);
      return next;
    });
    setCurrentHunk(hIdx);
  }, [rowToHunk, setReviewedHunks]);

  const markCurrentReviewed = useCallback(() => {
    setReviewedHunks(prev => {
      const next = new Set(prev);
      next.add(currentHunk);
      return next;
    });
  }, [currentHunk, setReviewedHunks]);

  // CO-06: open the composer on a row range (a new comment).
  const openComposerForRows = useCallback((rowA, rowB) => {
    const startRow = Math.min(rowA, rowB);
    const endRow = Math.max(rowA, rowB);
    const target = {
      type: 'range',
      file: fileKey,
      startLine: lineForRow(startRow),
      endLine: lineForRow(endRow),
      startRow,
      endRow,
    };
    setSelection(null);
    const hIdx = rowToHunk.get(startRow);
    if (hIdx != null) setCurrentHunk(hIdx);
    committedRef.current = false;
    setComposing({ commentId: null, action: DEFAULT_ACTION, body: '', target });
  }, [fileKey, lineForRow, rowToHunk]);

  const editComment = useCallback((comment) => {
    committedRef.current = false;
    setComposing({ commentId: comment.id, action: comment.action, body: comment.body, target: comment.target });
  }, []);

  // CO-06: Enter confirms; Escape confirms a non-empty comment or discards an
  // empty one. A new empty comment is dropped; an existing one emptied is deleted.
  const closeComposer = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    const cur = composingRef.current;
    const text = (composerRef.current?.value || '').trim();
    if (cur) {
      if (cur.commentId == null) {
        if (text && onAddComment) onAddComment({ body: text, action: cur.action, target: cur.target });
      } else if (text && onUpdateComment) {
        onUpdateComment(cur.commentId, { body: text, action: cur.action });
      } else if (!text && onDeleteComment) {
        onDeleteComment(cur.commentId);
      }
    }
    setComposing(null);
  }, [onAddComment, onUpdateComment, onDeleteComment]);

  // CO-04 gesture: begin from a line-number gutter press.
  const beginGutterGesture = useCallback((e, rowIdx) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (pressRef.current?.timer) clearTimeout(pressRef.current.timer);
    const timer = setTimeout(() => {
      const p = pressRef.current;
      if (!p) return;
      p.longPressed = true;
      openComposerForRows(p.startRow, p.startRow);
    }, LONG_PRESS_MS);
    pressRef.current = { startRow: rowIdx, endRow: rowIdx, startY: e.clientY, moved: false, longPressed: false, timer };
    // Selection highlight appears once a drag actually starts (handleRowEnter),
    // so a plain click doesn't flash the row.
  }, [openComposerForRows]);

  const handleRowEnter = useCallback((rowIdx) => {
    const p = pressRef.current;
    if (!p || p.longPressed) return;
    if (rowIdx !== p.startRow) {
      p.moved = true;
      if (p.timer) { clearTimeout(p.timer); p.timer = null; }
    }
    p.endRow = rowIdx;
    setSelection({ startRow: Math.min(p.startRow, rowIdx), endRow: Math.max(p.startRow, rowIdx) });
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const p = pressRef.current;
      if (!p || p.longPressed) return;
      if (!p.moved && Math.abs(e.clientY - p.startY) > DRAG_PX) {
        p.moved = true;
        if (p.timer) { clearTimeout(p.timer); p.timer = null; }
      }
    };
    const onUp = () => {
      const p = pressRef.current;
      if (!p) return;
      if (p.timer) clearTimeout(p.timer);
      pressRef.current = null;
      if (p.longPressed) return; // composer already opened by the timer
      if (p.moved) {
        openComposerForRows(p.startRow, p.endRow);
      } else {
        // Plain click: a changed line marks reviewed; an unchanged (context)
        // line opens a single-line comment (CO-04).
        if (rowToHunk.has(p.startRow)) markRowReviewed(p.startRow);
        else openComposerForRows(p.startRow, p.startRow);
        setSelection(null);
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [openComposerForRows, markRowReviewed, rowToHunk]);

  // Plain click on the code area marks reviewed (NV-06/09). Gutter clicks are
  // owned by the gesture above, so ignore clicks that originate there.
  const handleRowClick = useCallback((e, rowIdx) => {
    if (e.target?.dataset?.gutter) return;
    const hIdx = rowToHunk.get(rowIdx);
    if (hIdx == null) return;
    setReviewedHunks(prev => {
      const next = new Set(prev);
      next.add(hIdx);
      return next;
    });
    setCurrentHunk(hIdx);
  }, [rowToHunk, setReviewedHunks]);

  const handleRowContextMenu = useCallback((e, rowIdx) => {
    e.preventDefault();
    const hIdx = rowToHunk.get(rowIdx);
    if (hIdx != null) setCurrentHunk(hIdx);
    // hunk is null for a context line — the menu still offers Comment.
    setContextMenu({ x: e.clientX, y: e.clientY, hunk: hIdx ?? null, row: rowIdx });
  }, [rowToHunk]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const contextMenuActions = useMemo(() => {
    if (!contextMenu) return [];
    const h = contextMenu.hunk;
    const row = contextMenu.row;
    const actions = [];
    // Review actions only on a changed line (a context line has no hunk).
    if (h != null) {
      if (!reviewedHunks.has(h)) {
        actions.push({ label: 'Mark as reviewed', action: () => {
          setReviewedHunks(prev => { const next = new Set(prev); next.add(h); return next; });
        }});
      } else {
        actions.push({ label: 'Mark as unreviewed', action: () => {
          setReviewedHunks(prev => { const next = new Set(prev); next.delete(h); return next; });
        }});
      }
    }
    // CM-04: comment on the clicked line (changed or context).
    actions.push({ label: 'Comment', action: () => openComposerForRows(row, row) });
    if (window.moor?.openInEditor && rightPath) {
      const line = lineForRow(row);
      actions.push({ label: 'Open in editor', action: () => handleOpenInEditor(line) });
    }
    return actions;
  }, [contextMenu, reviewedHunks, rightPath, lineForRow, setReviewedHunks, openComposerForRows, handleOpenInEditor]);

  useEffect(() => {
    if (!contextMenu) return;
    const onMouseDown = (e) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target)) return;
      setContextMenu(null);
    };
    const onKeyDown = () => setContextMenu(null);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  useLayoutEffect(() => {
    setScrollTop(0);
    setScrollLeft(0);
    if (!externalReviewedHunks) setInternalReviewedHunks(new Set());
    let initial;
    if (startAtRow != null) {
      initial = rowToHunk.get(startAtRow) ?? 0;
    } else if (startAtEnd && hunkRanges.length > 0) {
      initial = hunkRanges.length - 1;
    } else {
      // NV-4: land on the first unreviewed hunk; fall back to the first hunk.
      initial = 0;
      for (let i = 0; i < hunkRanges.length; i++) {
        if (!reviewedHunks.has(i)) { initial = i; break; }
      }
    }
    setCurrentHunk(initial);
    setComposing(null);
  }, [leftContent, rightContent]);

  useEffect(() => {
    if (hScrollRef.current && hScrollRef.current.scrollLeft !== scrollLeft) {
      hScrollRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // NV-18: while the help overlay / comments panel is open the shell owns keys.
      if (paused) return;

      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (composing) return;

      switch (e.key) {
        case 'j': {
          e.preventDefault();
          markCurrentReviewed();
          if (currentHunk < hunkRanges.length - 1) {
            setCurrentHunk(currentHunk + 1);
          } else if (onNavigateNext) {
            onNavigateNext();
          }
          break;
        }
        case 'J': {
          e.preventDefault();
          setReviewedHunks(prev => {
            const next = new Set(prev);
            for (let i = 0; i < hunkRanges.length; i++) next.add(i);
            return next;
          });
          if (onNavigateNext) onNavigateNext();
          break;
        }
        case 'k': {
          e.preventDefault();
          markCurrentReviewed();
          if (currentHunk > 0) {
            setCurrentHunk(currentHunk - 1);
          } else if (onNavigatePrev) {
            onNavigatePrev();
          }
          break;
        }
        case 'K': {
          // NV-15: jump back a file without touching review state.
          e.preventDefault();
          if (onNavigatePrevFile) onNavigatePrevFile();
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = Math.min(scrollContainerRef.current.scrollTop + V_SCROLL_STEP, totalHeight);
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = Math.max(scrollContainerRef.current.scrollTop - V_SCROLL_STEP, 0);
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          setScrollLeft(prev => Math.min(prev + H_SCROLL_STEP, maxScroll));
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          setScrollLeft(prev => Math.max(prev - H_SCROLL_STEP, 0));
          break;
        }
        case 'u': {
          e.preventDefault();
          setReviewedHunks(prev => {
            const next = new Set(prev);
            next.delete(currentHunk);
            return next;
          });
          break;
        }
        case ' ':
        case 'Enter': {
          // NV-07: comment on the current hunk's line range.
          e.preventDefault();
          const range = hunkRanges[currentHunk];
          if (range) openComposerForRows(range.start, range.end);
          break;
        }
        case 'i': {
          e.preventDefault();
          if (window.moor?.openInEditor && rightPath && hunkRanges[currentHunk]) {
            const line = lineForRow(hunkRanges[currentHunk].start);
            handleOpenInEditor(line);
          }
          break;
        }
        case 'q':
        case 'Escape': {
          if (!onNavigateNext) {
            e.preventDefault();
            window.close();
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hunkRanges, currentHunk, reviewedHunks, markCurrentReviewed, totalHeight, maxScroll, onNavigateNext, onNavigatePrev, onNavigatePrevFile, composing, paused, openComposerForRows, lineForRow, handleOpenInEditor, setReviewedHunks, rightPath]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setViewportHeight(el.clientHeight);
      setViewportWidth(el.clientWidth);
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0) {
        e.preventDefault();
        setScrollLeft(prev => Math.max(0, Math.min(maxScroll, prev + e.deltaX)));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [maxScroll]);

  const handleMinimapScroll = useCallback((newScrollTop) => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = newScrollTop;
  }, []);

  const handleHScroll = useCallback((e) => {
    setScrollLeft(e.target.scrollLeft);
  }, []);

  const handleResizerMouseDown = useCallback((e) => {
    e.preventDefault();
    setDraggingResizer(true);
    const onMouseMove = (e) => {
      const el = scrollContainerRef.current || contentAreaRef.current;
      if (!el) return;
      const left = el.getBoundingClientRect().left;
      const width = el.clientWidth;
      const flexSpace = width - BAR_WIDTH - RESIZER_WIDTH;
      const pct = Math.max(20, Math.min(80, (e.clientX - left - BAR_WIDTH) / flexSpace * 100));
      setSplitPercent(pct);
    };
    const onMouseUp = () => {
      setDraggingResizer(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const effectiveViewport = Math.max(0, viewportHeight - headerHeight);
  const rowScrollTop = Math.max(0, scrollTop - headerHeight);
  const startIdx = Math.max(0, Math.floor(rowScrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(rows.length, Math.ceil((rowScrollTop + effectiveViewport) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(startIdx, endIdx);

  const availableWidth = Math.max(0, viewportWidth - BAR_WIDTH - RESIZER_WIDTH);
  const leftWidth = Math.round(availableWidth * splitPercent / 100);
  const rightWidth = availableWidth - leftWidth;

  const fileFixNowCount = fileComments.filter(c => isBlocking(c.action) && (c.body || '').trim()).length;

  const headerCellStyle = (color, width) => ({
    width: width + 'px',
    padding: '5px 16px',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color,
    background: 'var(--bg-panel)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
    {errorToast && (
      <div style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--color-conflict)',
        color: 'var(--bg-deep)',
        fontFamily: 'var(--font-ui)',
        fontSize: '13px',
        fontWeight: 600,
        padding: '8px 20px',
        borderRadius: '6px',
        zIndex: 1000,
        animation: 'toast-fade 3s ease-in-out',
      }}>
        {errorToast}
      </div>
    )}
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div ref={contentAreaRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'clip', minWidth: 0, position: 'relative' }}>

        <div
          ref={measureContainerRef}
          aria-hidden
          style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', top: 0, left: 0, zIndex: -1 }}
        >
          {widestCandidates.map((line, i) => (
            <div key={i} style={{ whiteSpace: 'pre', fontFamily: 'var(--font-mono)', fontSize: '15px' }}>
              {line}
            </div>
          ))}
        </div>

        {draggingResizer && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize' }} />
        )}

        {isBinary ? (
          <>
            <div ref={headerRef} style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ width: BAR_WIDTH + 'px', flexShrink: 0 }} />
              <div style={headerCellStyle(leftPath === rightPath ? 'transparent' : 'var(--color-left)', leftWidth)}>
                {leftPath === rightPath ? '' : (leftPath || '(empty)')}
              </div>
              <div style={{ width: RESIZER_WIDTH + 'px', flexShrink: 0 }} />
              <div style={headerCellStyle('var(--color-right)', rightWidth)}>{rightPath || '(empty)'}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', background: 'var(--bg-deep)', overflow: 'auto', ...(isImage ? { alignItems: 'flex-start', justifyContent: 'center', padding: '20px', gap: '20px' } : { alignItems: 'center', justifyContent: 'center' }) }}>
              {isImage ? (
                <>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {leftDataUrl ? (
                      <img src={leftDataUrl} style={{ maxWidth: '100%', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '4px' }} />
                    ) : leftFullPath ? (
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px' }}>Loading...</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px' }}>(empty)</span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {rightDataUrl ? (
                      <img src={rightDataUrl} style={{ maxWidth: '100%', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '4px' }} />
                    ) : rightFullPath ? (
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px' }}>Loading...</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px' }}>(empty)</span>
                    )}
                  </div>
                </>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontSize: '14px' }}>Binary files differ</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{ flex: 1, overflowY: 'auto', overflowX: 'clip', background: 'var(--bg-deep)' }}
            >
              <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-panel)' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', alignItems: 'stretch' }}>
                  <div style={{ width: BAR_WIDTH + 'px', flexShrink: 0 }} />
                  <div style={headerCellStyle(leftPath === rightPath ? 'transparent' : 'var(--color-left)', leftWidth)}>
                    {leftPath === rightPath ? '' : (leftPath || '(empty)')}
                  </div>
                  <div onMouseDown={handleResizerMouseDown} style={{ width: RESIZER_WIDTH + 'px', flexShrink: 0, background: 'var(--border)', cursor: 'col-resize' }} />
                  <div style={{ ...headerCellStyle('var(--color-right)', rightWidth), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rightPath || '(empty)'}</span>
                    {onAddFileComment && (
                      <button
                        type="button"
                        onClick={() => onAddFileComment(fileKey)}
                        title="Comment on this file"
                        style={{
                          flexShrink: 0,
                          background: 'transparent',
                          border: '1px solid var(--color-accent-border)',
                          color: 'var(--color-accent)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >+ comment</button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ height: (totalHeight + bottomPad) + 'px', position: 'relative' }}>
                {hunkRanges[currentHunk] && (
                  <div style={{
                    position: 'absolute',
                    top: hunkRanges[currentHunk].start * ROW_HEIGHT + 'px',
                    left: 0,
                    right: 0,
                    height: (hunkRanges[currentHunk].end - hunkRanges[currentHunk].start + 1) * ROW_HEIGHT + 'px',
                    border: '1px solid var(--color-accent)',
                    borderRadius: '3px',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }} />
                )}
                {/* CO-07: banding outlines over each comment's line range. */}
                {commentBands.map((b) => (
                  <div
                    key={b.key}
                    style={{
                      position: 'absolute',
                      top: b.startRow * ROW_HEIGHT + 'px',
                      left: 0,
                      right: 0,
                      height: (b.endRow - b.startRow + 1) * ROW_HEIGHT + 'px',
                      border: `1.5px solid ${actionColor(b.action)}`,
                      borderRadius: '3px',
                      pointerEvents: 'none',
                      zIndex: 3,
                    }}
                  />
                ))}
                {/* Persistent comment bars (CO-07) + the inline composer (CO-06). */}
                {composing && (
                  <CommentComposer
                    key={`composer-${composing.commentId ?? 'new'}-${composing.target.endRow}`}
                    composing={composing}
                    composerRef={composerRef}
                    top={(composing.target.endRow + 1) * ROW_HEIGHT}
                    onResize={resizeComposer}
                    onSetAction={(action) => setComposing(c => ({ ...c, action }))}
                    onClose={closeComposer}
                  />
                )}
                {fileComments.map((c) => {
                  if (composing && composing.commentId === c.id) return null;
                  const t = c.target || {};
                  if (t.endRow == null) return null;
                  return (
                    <CommentBar
                      key={`comment-${c.id}`}
                      comment={c}
                      top={(t.endRow + 1) * ROW_HEIGHT}
                      onEdit={() => editComment(c)}
                      onCycleAction={() => onSetCommentAction(c.id, ACTIONS[(ACTIONS.indexOf(c.action) + 1) % ACTIONS.length])}
                      onDelete={() => {
                        if ((c.body || '').trim() && !window.confirm('Delete this comment?')) return;
                        onDeleteComment(c.id);
                      }}
                    />
                  );
                })}
                <div style={{ position: 'absolute', top: startIdx * ROW_HEIGHT + 'px', left: 0, right: 0 }}>
                  {visibleRows.map((row, i) => {
                    const idx = startIdx + i;
                    return (
                      <DiffRow
                        key={idx}
                        row={row}
                        idx={idx}
                        active={activeRowSet.has(idx)}
                        reviewed={reviewedRowSet.has(idx)}
                        commentAction={rowActionMap.get(idx)}
                        selected={selectionRowSet ? selectionRowSet.has(idx) : false}
                        scrollLeft={scrollLeft}
                        leftWidth={leftWidth}
                        rightWidth={rightWidth}
                        onResizerMouseDown={handleResizerMouseDown}
                        onClick={(e) => handleRowClick(e, idx)}
                        onContextMenu={(e) => handleRowContextMenu(e, idx)}
                        onGutterMouseDown={beginGutterGesture}
                        onRowEnter={handleRowEnter}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {maxScroll > 0 && (
              <div
                ref={hScrollRef}
                onScroll={handleHScroll}
                style={{ overflowX: 'scroll', overflowY: 'hidden', height: '12px', flexShrink: 0, background: 'var(--bg-deep)' }}
              >
                <div style={{ width: viewportWidth + maxScroll + 'px', height: '1px' }} />
              </div>
            )}
          </>
        )}
      </div>

      {!isBinary && (
        <Minimap
          rows={rows}
          totalHeight={totalHeight}
          viewportHeight={viewportHeight}
          scrollTop={scrollTop}
          onScrollTo={handleMinimapScroll}
          reviewedRows={reviewedRowSet}
          commentRowColors={commentRowColors}
        />
      )}
      {contextMenu && (
        <div ref={contextMenuRef} style={{
          position: 'fixed',
          left: contextMenu.x + 'px',
          top: contextMenu.y + 'px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '4px 0',
          zIndex: 100,
          minWidth: '160px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {contextMenuActions.map((item, i) => (
            <div
              key={i}
              onClick={() => { item.action(); closeContextMenu(); }}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'var(--font-ui)',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
    {!onNavigateNext && !isBinary && hunkRanges.length > 0 && (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        height: '36px',
        flexShrink: 0,
        padding: '0 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: 'var(--text-primary)',
        gap: '12px',
      }}>
        {fileFixNowCount > 0 && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            background: 'var(--color-conflict)',
            color: 'var(--bg-primary)',
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: 600,
          }}>
            {fileFixNowCount} fix-now
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '120px',
            height: '4px',
            background: 'var(--border)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${hunkRanges.length > 0 ? reviewedHunks.size / hunkRanges.length * 100 : 0}%`,
              height: '100%',
              background: reviewedHunks.size >= hunkRanges.length ? 'var(--color-equal)' : 'var(--color-accent)',
              borderRadius: '2px',
              transition: 'width 0.2s',
            }} />
          </div>
          <span>
            {reviewedHunks.size >= hunkRanges.length ? (
              <span style={{ color: 'var(--color-equal)' }}>All changes viewed · q to close</span>
            ) : (
              <>{reviewedHunks.size} of {hunkRanges.length} changes viewed</>
            )}
          </span>
        </div>
      </div>
    )}
    </div>
  );
}

// CO-06: the inline composer — an auto-growing text area plus the action
// control. Enter confirms; Shift+Enter inserts a newline; Escape confirms a
// non-empty comment or discards an empty one (closeComposer decides).
function CommentComposer({ composing, composerRef, top, onResize, onSetAction, onClose }) {
  return (
    <div style={{ position: 'absolute', top: top + 'px', left: 0, right: 0, zIndex: 10, pointerEvents: 'auto' }}>
      <div style={{ background: 'var(--bg-panel)', border: `1px solid ${actionColor(composing.action)}`, borderRadius: '3px' }}>
        <textarea
          ref={composerRef}
          defaultValue={composing.body}
          rows={2}
          onInput={onResize}
          placeholder="Comment for the author…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onClose();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
            e.stopPropagation();
          }}
          onBlur={onClose}
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            padding: '4px 8px',
            fontSize: '13px',
            fontFamily: 'var(--font-ui)',
            background: 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            outline: 'none',
            resize: 'none',
            overflow: 'auto',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderTop: '1px solid var(--border)' }}>
          {ACTIONS.map((a) => {
            const selected = composing.action === a;
            return (
              <button
                key={a}
                type="button"
                // onMouseDown + preventDefault keeps the textarea focused so its
                // blur doesn't close the composer before the action is set.
                onMouseDown={(e) => { e.preventDefault(); onSetAction(a); }}
                style={{
                  background: selected ? actionBg(a) : 'transparent',
                  border: `1px solid ${selected ? actionColor(a) : 'var(--border)'}`,
                  color: selected ? actionColor(a) : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >{actionLabel(a)}</button>
            );
          })}
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            Enter saves · Shift+Enter newline · Esc
          </span>
        </div>
      </div>
    </div>
  );
}

// CO-07: a persistent bar at a comment's anchor showing its body and action.
// Click the body to edit; click the action chip to cycle; ✕ deletes (confirms).
function CommentBar({ comment, top, onEdit, onCycleAction, onDelete }) {
  const color = actionColor(comment.action);
  return (
    <div style={{ position: 'absolute', top: top + 'px', left: 0, right: 0, zIndex: 9, pointerEvents: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 8px', fontSize: '12px', fontFamily: 'var(--font-ui)', background: 'var(--bg-panel)', borderLeft: `3px solid ${color}` }}>
        <button
          type="button"
          onClick={onCycleAction}
          title="Cycle action: consider → fix later → fix now"
          style={{
            flexShrink: 0,
            background: actionBg(comment.action),
            border: `1px solid ${color}`,
            color,
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '1px 6px',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >{actionLabel(comment.action)}</button>
        <span onClick={onEdit} style={{ flex: 1, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', cursor: 'text' }}>{comment.body}</span>
        <span onClick={onDelete} style={{ opacity: 0.5, cursor: 'pointer', fontSize: '11px' }} title="Delete comment">✕</span>
      </div>
    </div>
  );
}

export default FileDiffView;
