import React, { useMemo, useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { computeLineChanges, diffChars, buildDisplayRows, BINARY_SENTINEL } from '../engine/diff.js';
import { DEFAULT_ACTION, ACTIONS, ACTIONS_BY_SEVERITY, isBlocking, commentToOutput, actionColor, actionBg, actionLabel, actionChipStyle, cycleAction, cycleActionDown } from '../engine/comments.js';
import { previewKindFor, renderMarkdown } from '../engine/preview.js';
import { renderMermaid, hasMermaid } from '../mermaid.js';
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
// The width the empty pane collapses to for a new / deleted file.
const COLLAPSED_PANE_WIDTH = 132;
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
  const dimmed = reviewed;

  // CO-04: the hover "+" on the new-side gutter — a visible, discoverable way to
  // comment on a single line, on par with the file / message / changeset
  // controls. Dragging the gutter still selects a range; this is the one-click
  // path for a single line (changed or context) without the long-press gesture.
  // It spans the full row height (not a centered 16px chip) so there is no
  // gutter dead zone above/below it where a press would fall through to the
  // review toggle; visibility is CSS-driven (see .moor-comment-add).
  const commentAddStyle = {
    position: 'absolute',
    left: '2px',
    top: '2px',
    bottom: '2px',
    width: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    border: 'none',
    borderRadius: '3px',
    background: 'var(--color-accent)',
    color: 'var(--bg-deep)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
  };

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
  // changed row still toggles its reviewed state via the row's onClick).
  return (
    <div
      className="moor-diff-row"
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
        <span data-gutter="1" onMouseDown={(e) => onGutterMouseDown(e, idx)} style={{ ...gutterStyle, cursor: 'pointer', position: 'relative' }}>
          {row.rightNum != null && (
            <button
              type="button"
              className="moor-comment-add"
              data-comment-add="1"
              // Start the same gesture as the gutter, flagged to comment on a
              // plain release; stopPropagation so the gutter span doesn't also
              // start an unflagged press. onClick is swallowed so the row's
              // review-toggle click doesn't fire.
              onMouseDown={(e) => { e.stopPropagation(); onGutterMouseDown(e, idx, { commentOnClick: true }); }}
              onClick={(e) => e.stopPropagation()}
              title="Comment on this line — drag to select a range"
              style={commentAddStyle}
            >+</button>
          )}
          {row.rightNum ?? ''}
        </span>
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

const inlineKbdStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '16px',
  padding: '1px 5px',
  background: 'var(--bg-deep)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  fontWeight: 600,
};

export function FileDiffView({ leftPath, rightPath, leftContent, rightContent, leftFullPath, rightFullPath, onNavigateNext, onNavigatePrev, onNavigatePrevFile, startAtEnd, startAtRow, onHunkChange, reviewedHunks: externalReviewedHunks, onReviewedHunksChange, fileComments = [], onAddComment, onUpdateComment, onSetCommentAction, onDeleteComment, onAddFileComment, onForceText, paused = false }) {
  const leftBinary = leftContent === BINARY_SENTINEL;
  const rightBinary = rightContent === BINARY_SENTINEL;
  const isBinary = leftBinary || rightBinary;
  const isImage = isBinary && (IMAGE_EXTENSIONS.test(leftPath || '') || IMAGE_EXTENSIONS.test(rightPath || ''));

  // A wholly-added (new) or wholly-removed (deleted) file has content on one
  // side only. Detect it by content emptiness, not a missing path: git difftool
  // (moor's primary caller) feeds an *empty temp file* for the absent side, so
  // the path is present but empty — a path-only check would miss every new /
  // deleted file outside directory-compare mode. Collapse the empty pane to a
  // narrow strip so the content gets nearly the full width, and mark which side
  // collapsed so the layout and the pointer placeholder agree.
  const leftHasContent = Boolean(leftContent) && leftContent !== BINARY_SENTINEL;
  const rightHasContent = Boolean(rightContent) && rightContent !== BINARY_SENTINEL;
  const isNew = !leftHasContent && rightHasContent;
  const isDeleted = leftHasContent && !rightHasContent;
  const collapsedSide = isNew ? 'left' : isDeleted ? 'right' : null;
  // Binary panes lay their body out with flex, not the measured pane widths, so
  // collapsing them would desync the header from the body — leave binary at the
  // even split and apply the collapse only to the source / rendered layouts.
  const collapseLayout = collapsedSide && !isBinary;

  // FUT-01 / BF-02: a file with a rendered representation can toggle between the
  // source diff and a side-by-side preview. The kind comes from whichever side
  // has a path (the new side wins, falling back to the old for a deletion).
  const previewKind = !isBinary
    ? previewKindFor(rightPath || leftPath)
    : null;

  // An SVG is most useful rendered — the source is markup you'd otherwise have
  // to picture — so it opens in the preview; toggle to source to read the
  // markup. Markdown opens to its source diff (the default for everything else).
  const defaultViewMode = previewKind === 'svg' ? 'rendered' : 'source';

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

  // FUT-01: the rendered body for each side. Markdown is converted to HTML;
  // SVG is its own markup. Both are dropped into a scripts-disabled sandbox
  // iframe (renderedDoc), so embedded scripts never run.
  const leftBase = useMemo(
    () => previewKind === 'markdown' ? renderMarkdown(leftContent) : (leftContent || ''),
    [previewKind, leftContent]);
  const rightBase = useMemo(
    () => previewKind === 'markdown' ? renderMarkdown(rightContent) : (rightContent || ''),
    [previewKind, rightContent]);

  // BF-04: mermaid diagrams render asynchronously (the library needs a DOM), so
  // the body starts at the placeholder-bearing HTML and upgrades to the
  // diagram-substituted HTML once mermaid resolves. Markdown without a mermaid
  // fence, and SVG, settle synchronously on the first pass.
  const [leftRendered, setLeftRendered] = useState('');
  const [rightRendered, setRightRendered] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLeftRendered(leftBase);
    if (hasMermaid(leftBase)) renderMermaid(leftBase).then(h => { if (!cancelled) setLeftRendered(h); });
    return () => { cancelled = true; };
  }, [leftBase]);
  useEffect(() => {
    let cancelled = false;
    setRightRendered(rightBase);
    if (hasMermaid(rightBase)) renderMermaid(rightBase).then(h => { if (!cancelled) setRightRendered(h); });
    return () => { cancelled = true; };
  }, [rightBase]);

  // FD-01 (rendered mode): source mode scrolls both columns as one because they
  // share a single scroll container. Rendered mode mounts two iframes, so each
  // pane is sized to the content height its height-reporter posts back and the
  // panes sit in one shared scroll container — the outer scrollbar then drives
  // both sides in lockstep, matching source mode. Heights reset per file so a
  // short file after a long one doesn't inherit stale scroll extent.
  const leftIframeRef = useRef(null);
  const rightIframeRef = useRef(null);
  const [leftRenderedHeight, setLeftRenderedHeight] = useState(0);
  const [rightRenderedHeight, setRightRenderedHeight] = useState(0);
  useEffect(() => { setLeftRenderedHeight(0); setRightRenderedHeight(0); }, [leftBase, rightBase]);
  useEffect(() => {
    const onMessage = (e) => {
      const h = e.data?.moorHeight;
      if (typeof h !== 'number') return;
      if (e.source === leftIframeRef.current?.contentWindow) setLeftRenderedHeight(h);
      else if (e.source === rightIframeRef.current?.contentWindow) setRightRenderedHeight(h);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const renderedHeight = Math.max(leftRenderedHeight, rightRenderedHeight);

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
  // #3: measured pixel height of each rendered comment bar / composer, keyed by
  // its insert key. Comment overlays reserve vertical space (the rows below them
  // shift down instead of being covered), so the row grid needs their real
  // heights — which vary as a bar wraps or the composer grows.
  const [insertHeights, setInsertHeights] = useState({});
  const reportInsertHeight = useCallback((key, h) => {
    setInsertHeights(prev => (prev[key] === h ? prev : { ...prev, [key]: h }));
  }, []);
  const [splitPercent, setSplitPercent] = useState(50);
  const [viewMode, setViewMode] = useState(defaultViewMode);
  const [draggingResizer, setDraggingResizer] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const errorToastTimerRef = useRef(null);

  const showErrorToast = useCallback((message) => {
    setErrorToast(message);
    if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current);
    errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 3000);
  }, []);

  const handlePreview = useCallback(() => {
    const target = rightFullPath || leftFullPath;
    if (!window.moor?.openInDefaultApp || !target) return;
    window.moor.openInDefaultApp(target).then(r => {
      if (r && !r.ok) showErrorToast(r.error || 'Could not open file');
    });
  }, [rightFullPath, leftFullPath, showErrorToast]);
  const toggleViewMode = useCallback(() => {
    if (!previewKind) return;
    setViewMode(m => (m === 'source' ? 'rendered' : 'source'));
  }, [previewKind]);
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

  // #3: the ordered list of comment overlays that reserve vertical space — a bar
  // per persisted comment (except the one currently being composed, whose bar is
  // replaced by the composer) plus the composer itself. Each is anchored below
  // its range's last row (endRow) and sorted by that row so the offset map is
  // built in document order.
  const commentInserts = useMemo(() => {
    const list = [];
    for (const c of fileComments) {
      const t = c.target || {};
      if (t.endRow == null) continue;
      if (composing && composing.commentId === c.id) continue;
      list.push({ key: `comment-${c.id}`, kind: 'bar', anchorRow: t.endRow, comment: c });
    }
    if (composing) {
      list.push({ key: `composer-${composing.commentId ?? 'new'}-${composing.target.endRow}`, kind: 'composer', anchorRow: composing.target.endRow });
    }
    list.sort((a, b) => a.anchorRow - b.anchorRow || (a.key < b.key ? -1 : 1));
    return list;
  }, [fileComments, composing]);

  // #3: the row → Y map. A row's top is its base offset (index * ROW_HEIGHT) plus
  // the summed height of every comment overlay anchored above it, so overlays
  // push the following rows down rather than covering them. `rowTop(i)` is the
  // top of row i's code; `rowEnd(i)` its bottom (before any overlay anchored at
  // i). `insertTops` places each overlay just below its anchor row, stacking
  // multiple overlays that share an anchor. All five geometry consumers (row
  // slice, hunk highlight, bands, scroll-to-hunk, minimap) read through this.
  const rowLayout = useMemo(() => {
    const n = rows.length;
    const byAnchor = new Map();
    for (const ins of commentInserts) {
      const h = insertHeights[ins.key] ?? ROW_HEIGHT;
      byAnchor.set(ins.anchorRow, (byAnchor.get(ins.anchorRow) || 0) + h);
    }
    const offsets = new Array(n + 1);
    let acc = 0;
    for (let i = 0; i <= n; i++) {
      offsets[i] = acc;
      acc += byAnchor.get(i) || 0;
    }
    const rowTop = (i) => { const c = i < 0 ? 0 : i > n ? n : i; return c * ROW_HEIGHT + offsets[c]; };
    const rowEnd = (i) => rowTop(i) + ROW_HEIGHT;
    const insertTops = new Map();
    const stackAt = new Map();
    for (const ins of commentInserts) {
      const used = stackAt.get(ins.anchorRow) || 0;
      insertTops.set(ins.key, rowEnd(ins.anchorRow) + used);
      stackAt.set(ins.anchorRow, used + (insertHeights[ins.key] ?? ROW_HEIGHT));
    }
    // Binary search: the largest row index whose top is at or above `y`.
    const rowAtY = (y) => {
      let lo = 0, hi = n;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (rowTop(mid) <= y) lo = mid; else hi = mid - 1; }
      return lo;
    };
    return { offsets, rowTop, rowEnd, insertTops, rowAtY, contentHeight: n * ROW_HEIGHT + acc };
  }, [rows.length, commentInserts, insertHeights]);

  // Drop measured heights for overlays that no longer exist so the map doesn't
  // accumulate stale keys across a long session.
  useEffect(() => {
    const live = new Set(commentInserts.map(i => i.key));
    setInsertHeights(prev => {
      const next = {};
      let changed = false;
      for (const k of Object.keys(prev)) {
        if (live.has(k)) next[k] = prev[k]; else changed = true;
      }
      return changed ? next : prev;
    });
  }, [commentInserts]);

  // The single source for the two pane widths. A new/deleted file pins the empty
  // side to a narrow strip (capped so it never exceeds 40% on a small window);
  // everything else honours the user's draggable split.
  const { leftWidth, rightWidth } = useMemo(() => {
    const availableWidth = Math.max(0, viewportWidth - BAR_WIDTH - RESIZER_WIDTH);
    if (collapseLayout) {
      const strip = Math.min(COLLAPSED_PANE_WIDTH, Math.round(availableWidth * 0.4));
      return collapsedSide === 'left'
        ? { leftWidth: strip, rightWidth: availableWidth - strip }
        : { leftWidth: availableWidth - strip, rightWidth: strip };
    }
    const lw = Math.round(availableWidth * splitPercent / 100);
    return { leftWidth: lw, rightWidth: availableWidth - lw };
  }, [viewportWidth, splitPercent, collapseLayout, collapsedSide]);

  const maxScroll = useMemo(() => {
    if (!viewportWidth) return 0;
    // Horizontal scroll follows the content pane — for a collapsed file that's
    // the wide side, not the narrow strip.
    const contentWidth = !collapseLayout ? Math.min(leftWidth, rightWidth)
      : collapsedSide === 'left' ? rightWidth
      : leftWidth;
    const codeAreaWidth = Math.max(0, contentWidth - 64);
    return Math.max(0, maxContentWidth - codeAreaWidth);
  }, [maxContentWidth, viewportWidth, collapseLayout, collapsedSide, leftWidth, rightWidth]);

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
      scrollContainerRef.current.scrollTop = Math.max(0, rowLayout.rowTop(startAtRow) - ROW_HEIGHT);
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
    // NV-13: positions read through rowLayout so a comment reserving space above
    // the hunk shifts the scroll target with it.
    const topAtRow2 = Math.max(0, rowLayout.rowTop(range.start) - ROW_HEIGHT);
    const scrollForBottom = rowLayout.rowEnd(range.end) + headerHeight - viewportHeight;
    const topFlush = rowLayout.rowTop(range.start);
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
      const hunkTopY = rowLayout.rowTop(range.start);
      const hunkBottomY = rowLayout.rowEnd(range.end);
      if (hunkTopY >= visibleTop && hunkBottomY <= visibleTop + ev) {
        return;
      }
      scrollContainerRef.current.scrollTo({ top: target, behavior: 'smooth' });
    }
    setScrollLeft(0);
  }, [currentHunk, hunkRanges, viewportHeight, headerHeight, rowLayout]);

  const toggleHunkReviewed = useCallback((hIdx) => {
    setReviewedHunks(prev => {
      const next = new Set(prev);
      if (next.has(hIdx)) next.delete(hIdx);
      else next.add(hIdx);
      return next;
    });
  }, [setReviewedHunks]);

  // A plain click toggles the clicked row's hunk reviewed/unreviewed (NV-06)
  // and focuses it.
  const toggleRowReviewed = useCallback((rowIdx) => {
    const hIdx = rowToHunk.get(rowIdx);
    if (hIdx == null) return;
    toggleHunkReviewed(hIdx);
    setCurrentHunk(hIdx);
  }, [rowToHunk, toggleHunkReviewed]);

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

  // CO-04 gesture: begin from a line-number gutter press. `commentOnClick` marks
  // a press that started on the hover "+" — a plain release then always comments
  // the single line (never toggles review), while a drag still selects a range.
  const beginGutterGesture = useCallback((e, rowIdx, opts = {}) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (pressRef.current?.timer) clearTimeout(pressRef.current.timer);
    const timer = setTimeout(() => {
      const p = pressRef.current;
      if (!p) return;
      p.longPressed = true;
      openComposerForRows(p.startRow, p.startRow);
    }, LONG_PRESS_MS);
    pressRef.current = { startRow: rowIdx, endRow: rowIdx, startY: e.clientY, moved: false, longPressed: false, commentOnClick: !!opts.commentOnClick, timer };
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
      } else if (p.commentOnClick) {
        // Started on the hover "+": a plain release always comments the single
        // line (never toggles review), matching the affordance's intent (CO-04).
        openComposerForRows(p.startRow, p.startRow);
        setSelection(null);
      } else {
        // Plain click: a changed line toggles reviewed; an unchanged (context)
        // line opens a single-line comment (CO-04).
        if (rowToHunk.has(p.startRow)) toggleRowReviewed(p.startRow);
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
  }, [openComposerForRows, toggleRowReviewed, rowToHunk]);

  // Plain click on the code area toggles reviewed (NV-06). Gutter clicks are
  // owned by the gesture above, so ignore clicks that originate there.
  const handleRowClick = useCallback((e, rowIdx) => {
    if (e.target?.dataset?.gutter) return;
    toggleRowReviewed(rowIdx);
  }, [toggleRowReviewed]);

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
    if (window.moor?.openInDefaultApp && (rightFullPath || leftFullPath)) {
      actions.push({ label: 'Preview', action: () => handlePreview() });
    }
    return actions;
  }, [contextMenu, reviewedHunks, rightFullPath, leftFullPath, lineForRow, setReviewedHunks, openComposerForRows, handlePreview]);

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
    setViewMode(defaultViewMode);
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
            // The container clamps to its own scroll extent, which already
            // includes the space reserved for comment overlays (#3).
            scrollContainerRef.current.scrollTop += V_SCROLL_STEP;
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
          // NV-07: comment on the current hunk's line range. If the hunk
          // already carries a comment, edit it rather than stacking a new one.
          e.preventDefault();
          const range = hunkRanges[currentHunk];
          if (!range) break;
          const existing = fileComments.find((c) => {
            const t = c.target || {};
            return t.startRow != null && t.endRow != null && t.startRow <= range.end && t.endRow >= range.start;
          });
          if (existing) editComment(existing);
          else openComposerForRows(range.start, range.end);
          break;
        }
        case 'p': {
          // handlePreview no-ops when preview is unavailable or no path exists.
          e.preventDefault();
          handlePreview();
          break;
        }
        case 'r':
        case 'R': {
          // toggleViewMode no-ops when the file has no rendered representation.
          e.preventDefault();
          toggleViewMode();
          break;
        }
        case 't':
        case 'T': {
          // BF-03: force a file flagged binary to text comparison. Meaningless
          // for an image (its bytes aren't text), so it's offered only for the
          // "Binary files differ" case.
          if (isBinary && !isImage && onForceText) {
            e.preventDefault();
            onForceText();
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
  }, [hunkRanges, currentHunk, reviewedHunks, markCurrentReviewed, totalHeight, maxScroll, onNavigateNext, onNavigatePrev, onNavigatePrevFile, composing, paused, openComposerForRows, editComment, fileComments, lineForRow, handlePreview, toggleViewMode, setReviewedHunks, isBinary, isImage, onForceText]);

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
    // The minimap works in row-space (headerless); the scroll container's
    // scrollTop includes the sticky header, so add it back.
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = newScrollTop + headerHeight;
  }, [headerHeight]);

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
  // #3: the visible slice is found through rowLayout (variable row offsets), not
  // a flat rowScrollTop / ROW_HEIGHT, so comment overlays don't desync it.
  const startIdx = Math.max(0, rowLayout.rowAtY(rowScrollTop) - OVERSCAN);
  const endIdx = Math.min(rows.length, rowLayout.rowAtY(rowScrollTop + effectiveViewport) + OVERSCAN + 1);
  const visibleRows = rows.slice(startIdx, endIdx);

  // Resizing is meaningless when a pane is pinned collapsed — leave the strip put.
  const onResizerDown = collapseLayout ? undefined : handleResizerMouseDown;
  const resizerCursor = collapseLayout ? 'default' : 'col-resize';

  const fileFixNowCount = fileComments.filter(c => isBlocking(c.action) && (c.body || '').trim()).length;

  // For a collapsed (new/deleted) file the empty side carries no path label — a
  // narrow strip would only truncate "(empty)" — and the file-comment / preview
  // actions move to whichever side actually holds content.
  const actionsOnLeft = collapsedSide === 'right';
  const leftHeaderLabel = collapsedSide === 'left'
    ? ''
    : (leftPath === rightPath ? '' : (leftPath || '(empty)'));
  const rightHeaderLabel = collapsedSide === 'right' ? '' : (rightPath || '(empty)');

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

        {previewKind && viewMode === 'rendered' ? (
          <>
            <div ref={headerRef} style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ width: BAR_WIDTH + 'px', flexShrink: 0 }} />
              <div style={{ ...headerCellStyle(leftPath === rightPath ? 'transparent' : 'var(--color-left)', leftWidth), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leftHeaderLabel}</span>
                {actionsOnLeft && <HeaderActions previewKind={previewKind} viewMode={viewMode} onToggle={toggleViewMode} onAddFileComment={onAddFileComment} fileKey={fileKey} />}
              </div>
              <div onMouseDown={onResizerDown} style={{ width: RESIZER_WIDTH + 'px', flexShrink: 0, background: 'var(--border)', cursor: resizerCursor }} />
              <div style={{ ...headerCellStyle('var(--color-right)', rightWidth), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rightHeaderLabel}</span>
                {!actionsOnLeft && <HeaderActions previewKind={previewKind} viewMode={viewMode} onToggle={toggleViewMode} onAddFileComment={onAddFileComment} fileKey={fileKey} />}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', background: 'var(--bg-deep)', overflowY: 'auto', overflowX: 'hidden' }}>
              <RenderedPane kind={previewKind} html={leftRendered} hasContent={Boolean(leftContent)} width={leftWidth} iframeRef={leftIframeRef} height={renderedHeight} />
              <div onMouseDown={onResizerDown} style={{ alignSelf: 'stretch', width: RESIZER_WIDTH + 'px', flexShrink: 0, background: 'var(--border)', cursor: resizerCursor }} />
              <RenderedPane kind={previewKind} html={rightRendered} hasContent={Boolean(rightContent)} width={rightWidth} iframeRef={rightIframeRef} height={renderedHeight} />
            </div>
          </>
        ) : isBinary ? (
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontSize: '14px' }}>Binary files differ</span>
                  {onForceText && (
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px' }}>
                      Detected as binary. Press <kbd style={inlineKbdStyle}>t</kbd> to compare as text.
                    </span>
                  )}
                </div>
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
                  <div style={{ ...headerCellStyle(leftPath === rightPath ? 'transparent' : 'var(--color-left)', leftWidth), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leftHeaderLabel}</span>
                    {actionsOnLeft && <HeaderActions previewKind={previewKind} viewMode={viewMode} onToggle={toggleViewMode} onAddFileComment={onAddFileComment} fileKey={fileKey} />}
                  </div>
                  <div onMouseDown={onResizerDown} style={{ width: RESIZER_WIDTH + 'px', flexShrink: 0, background: 'var(--border)', cursor: resizerCursor }} />
                  <div style={{ ...headerCellStyle('var(--color-right)', rightWidth), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rightHeaderLabel}</span>
                    {!actionsOnLeft && <HeaderActions previewKind={previewKind} viewMode={viewMode} onToggle={toggleViewMode} onAddFileComment={onAddFileComment} fileKey={fileKey} />}
                  </div>
                </div>
              </div>

              <div style={{ height: (rowLayout.contentHeight + bottomPad) + 'px', position: 'relative' }}>
                {hunkRanges[currentHunk] && (
                  <div style={{
                    position: 'absolute',
                    top: rowLayout.rowTop(hunkRanges[currentHunk].start) + 'px',
                    left: 0,
                    right: 0,
                    height: (rowLayout.rowEnd(hunkRanges[currentHunk].end) - rowLayout.rowTop(hunkRanges[currentHunk].start)) + 'px',
                    border: '1px solid var(--color-accent)',
                    borderRadius: '3px',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }} />
                )}
                {/* CO-07: banding outlines over each comment's line range. The
                    band spans only the code rows (rowTop..rowEnd), stopping above
                    the bar/composer that reserves space just below endRow (#3). */}
                {commentBands.map((b) => (
                  <div
                    key={b.key}
                    style={{
                      position: 'absolute',
                      top: rowLayout.rowTop(b.startRow) + 'px',
                      left: 0,
                      right: 0,
                      height: (rowLayout.rowEnd(b.endRow) - rowLayout.rowTop(b.startRow)) + 'px',
                      border: `1.5px solid ${actionColor(b.action)}`,
                      borderRadius: '3px',
                      pointerEvents: 'none',
                      zIndex: 3,
                    }}
                  />
                ))}
                {/* Persistent comment bars (CO-07) + the inline composer (CO-06),
                    each in a space-reserving wrapper (#3) that reports its
                    measured height back so the rows below it shift down. */}
                {commentInserts.map((ins) => (
                  <InsertMeasure
                    key={ins.key}
                    insKey={ins.key}
                    top={rowLayout.insertTops.get(ins.key) ?? 0}
                    zIndex={ins.kind === 'composer' ? 10 : 9}
                    onMeasure={reportInsertHeight}
                  >
                    {ins.kind === 'composer' ? (
                      <CommentComposer
                        composing={composing}
                        composerRef={composerRef}
                        onResize={resizeComposer}
                        onSetAction={(action) => setComposing(c => ({ ...c, action }))}
                        onClose={closeComposer}
                      />
                    ) : (
                      <CommentBar
                        comment={ins.comment}
                        onEdit={() => editComment(ins.comment)}
                        onCycleAction={() => onSetCommentAction(ins.comment.id, ACTIONS[(ACTIONS.indexOf(ins.comment.action) + 1) % ACTIONS.length])}
                        onDelete={() => {
                          if ((ins.comment.body || '').trim() && !window.confirm('Delete this comment?')) return;
                          onDeleteComment(ins.comment.id);
                        }}
                      />
                    )}
                  </InsertMeasure>
                ))}
                {visibleRows.map((row, i) => {
                  const idx = startIdx + i;
                  return (
                    <div key={idx} style={{ position: 'absolute', top: rowLayout.rowTop(idx) + 'px', left: 0, right: 0 }}>
                      <DiffRow
                        row={row}
                        idx={idx}
                        active={activeRowSet.has(idx)}
                        reviewed={reviewedRowSet.has(idx)}
                        commentAction={rowActionMap.get(idx)}
                        selected={selectionRowSet ? selectionRowSet.has(idx) : false}
                        scrollLeft={scrollLeft}
                        leftWidth={leftWidth}
                        rightWidth={rightWidth}
                        onResizerMouseDown={onResizerDown}
                        onClick={(e) => handleRowClick(e, idx)}
                        onContextMenu={(e) => handleRowContextMenu(e, idx)}
                        onGutterMouseDown={beginGutterGesture}
                        onRowEnter={handleRowEnter}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {collapseLayout && (
              <CollapsedPanePlaceholder
                kind={isNew ? 'new' : 'deleted'}
                left={collapsedSide === 'left' ? BAR_WIDTH : BAR_WIDTH + leftWidth + RESIZER_WIDTH}
                width={collapsedSide === 'left' ? leftWidth : rightWidth}
                top={headerHeight}
                bottom={maxScroll > 0 ? 12 : 0}
              />
            )}

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

      {!isBinary && !collapseLayout && (
        <Minimap
          rows={rows}
          totalHeight={totalHeight}
          contentHeight={rowLayout.contentHeight}
          rowOffsets={rowLayout.offsets}
          viewportHeight={effectiveViewport}
          scrollTop={rowScrollTop}
          topOffset={headerHeight}
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

// Fills the empty pane of a new / deleted file with a neutral diagonal
// cross-hatch — it reads as "nothing here" without a label or pointer. `kind`
// only picks which edge (the one facing the content pane) gets the divider.
function CollapsedPanePlaceholder({ kind, left, width, top, bottom }) {
  const contentIsRight = kind === 'new'; // the empty pane is on the left
  const hatch = 'repeating-linear-gradient(45deg, transparent, transparent 6px, var(--border) 6px, var(--border) 7px), repeating-linear-gradient(-45deg, transparent, transparent 6px, var(--border) 6px, var(--border) 7px)';
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: left + 'px',
        top: top + 'px',
        width: width + 'px',
        bottom: bottom + 'px',
        background: 'var(--bg-surface)',
        backgroundImage: hatch,
        borderRight: contentIsRight ? '1px solid var(--border)' : undefined,
        borderLeft: contentIsRight ? undefined : '1px solid var(--border)',
        pointerEvents: 'none',
        zIndex: 6,
      }}
    />
  );
}

// CO-06: the inline composer — an auto-growing text area plus the action
// control. Enter confirms; Shift+Enter inserts a newline; Escape confirms a
// non-empty comment or discards an empty one (closeComposer decides). Tab
// down-classifies the action (fix-now → fix-later → consider → fix-now);
// Shift+Tab walks back up.
function CommentComposer({ composing, composerRef, onResize, onSetAction, onClose }) {
  return (
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
            } else if (e.key === 'Tab') {
              e.preventDefault();
              onSetAction(e.shiftKey ? cycleAction(composing.action) : cycleActionDown(composing.action));
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
          {ACTIONS_BY_SEVERITY.map((a) => {
            const selected = composing.action === a;
            return (
              <button
                key={a}
                type="button"
                // onMouseDown + preventDefault keeps the textarea focused so its
                // blur doesn't close the composer before the action is set.
                onMouseDown={(e) => { e.preventDefault(); onSetAction(a); }}
                style={actionChipStyle(a, selected
                  ? { cursor: 'pointer' }
                  : { cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' })}
              >{actionLabel(a)}</button>
            );
          })}
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            Enter saves · Shift+Enter newline · Tab cycles action · Esc
          </span>
        </div>
      </div>
  );
}

// #3: positions a comment overlay just below its anchor row and reports its
// measured height so the row grid can reserve space for it (the rows below it
// shift down instead of being covered). useLayoutEffect measures before paint so
// the reserved space is correct on the first frame; a ResizeObserver keeps it in
// sync as the bar wraps or the composer grows.
function InsertMeasure({ insKey, top, zIndex, onMeasure, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onMeasure(insKey, el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [insKey, onMeasure]);
  return (
    <div ref={ref} style={{ position: 'absolute', top: top + 'px', left: 0, right: 0, zIndex, pointerEvents: 'auto' }}>
      {children}
    </div>
  );
}

// CO-07: a persistent bar at a comment's anchor showing its body and action.
// Click the body to edit; click the action chip to cycle; ✕ deletes (confirms).
function CommentBar({ comment, onEdit, onCycleAction, onDelete }) {
  const color = actionColor(comment.action);
  return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 8px', fontSize: '12px', fontFamily: 'var(--font-ui)', background: 'var(--bg-panel)', borderLeft: `3px solid ${color}` }}>
        <button
          type="button"
          onClick={onCycleAction}
          title="Cycle action: consider → fix later → fix now"
          style={actionChipStyle(comment.action, { flexShrink: 0, padding: '1px 6px', cursor: 'pointer' })}
        >{actionLabel(comment.action)}</button>
        <span onClick={onEdit} style={{ flex: 1, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', cursor: 'text' }}>{comment.body}</span>
        <span onClick={onDelete} style={{ opacity: 0.5, cursor: 'pointer', fontSize: '11px' }} title="Delete comment">✕</span>
      </div>
  );
}

// The right-side header controls: the source ↔ rendered toggle (when the file
// has a rendered representation) and the file-comment button. Rendered in both
// the source and rendered headers so a file comment can be added in either view.
function HeaderActions({ previewKind, viewMode, onToggle, onAddFileComment, fileKey }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
      {previewKind && <PreviewToggle viewMode={viewMode} onToggle={onToggle} />}
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
        >+ comment on file</button>
      )}
    </span>
  );
}

// FUT-01: the source ↔ rendered toggle in the file header. Visible only when
// the file has a rendered representation (previewKind set).
function PreviewToggle({ viewMode, onToggle }) {
  const rendered = viewMode === 'rendered';
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Toggle source / rendered (r)"
      style={{
        flexShrink: 0,
        background: rendered ? 'var(--color-accent-bg)' : 'transparent',
        border: '1px solid var(--color-accent-border)',
        color: 'var(--color-accent)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        padding: '1px 6px',
        borderRadius: '3px',
        cursor: 'pointer',
      }}
    >{rendered ? 'source' : 'rendered'}</button>
  );
}

// Reads the theme tokens from the host document so the sandboxed iframe (a
// separate document that can't see the parent's CSS variables) can style its
// body to match, keeping global.css the single source for the palette.
function themeTokens() {
  const cs = getComputedStyle(document.documentElement);
  const tok = (name) => cs.getPropertyValue(name).trim();
  return {
    bg: tok('--bg-deep'),
    panel: tok('--bg-panel'),
    text: tok('--text-primary'),
    muted: tok('--text-muted'),
    border: tok('--border'),
    accent: tok('--color-accent'),
    fontUi: tok('--font-ui'),
    fontMono: tok('--font-mono'),
  };
}

// FD-01 (rendered mode): the only script the preview iframe is allowed to run —
// it posts the document's content height to the parent so the pane can be sized
// to its content and the shared outer scrollbar drives both sides together. The
// CSP below hash-pins script execution to exactly these bytes, so an embedded
// script or inline handler in the SVG / Markdown never runs. Changing this
// string means recomputing RENDERED_SCRIPT_CSP_HASH.
const RENDERED_HEIGHT_REPORTER = "function post(){parent.postMessage({moorHeight:document.body.scrollHeight},'*');}new ResizeObserver(post).observe(document.body);post();";
const RENDERED_SCRIPT_CSP_HASH = "sha256-EtHshYpk8hDv9It8uW6E7furBG0yxjBCRSesa8z2SKo=";

// FUT-01: one rendered side. Markdown HTML and SVG markup render inside a
// sandbox iframe whose CSP hash-pins scripts to the height reporter alone
// (RENDERED_HEIGHT_REPORTER), so any script or event handler embedded in the
// content stays inert. The pane is sized to the reported content height so the
// shared container scrolls both sides in lockstep (FD-01).
function RenderedPane({ kind, html, hasContent, width, iframeRef, height }) {
  const srcDoc = useMemo(() => {
    if (!hasContent) return null;
    const t = themeTokens();
    const isSvg = kind === 'svg';
    const body = isSvg
      ? `<div class="svg-wrap">${html}</div>`
      : html;
    const layout = isSvg
      ? `body{display:flex;align-items:flex-start;justify-content:center;padding:20px;}
         .svg-wrap{max-width:100%;}
         .svg-wrap svg{max-width:100%;height:auto;}`
      : `body{padding:16px 24px;line-height:1.55;}
         pre{background:${t.panel};padding:12px;border-radius:4px;overflow:auto;}
         code{font-family:${t.fontMono};font-size:0.9em;}
         pre code{background:transparent;}
         :not(pre)>code{background:${t.panel};padding:1px 4px;border-radius:3px;}
         blockquote{margin:0 0 0 4px;padding-left:12px;border-left:3px solid ${t.border};color:${t.muted};}
         a{color:${t.accent};}
         h1,h2,h3,h4,h5,h6{font-family:${t.fontUi};}
         hr{border:none;border-top:1px solid ${t.border};}
         table{border-collapse:collapse;margin:10px 0;font-size:0.95em;}
         th,td{border:1px solid ${t.border};padding:5px 10px;vertical-align:top;}
         th{background:${t.panel};font-family:${t.fontUi};text-align:left;}
         .mermaid-diagram{margin:14px 0;overflow-x:auto;}
         .mermaid-diagram svg{max-width:100%;height:auto;}`;
    // The CSP allows only inline styles and the hash-pinned height reporter:
    // every subresource fetch is blocked so a remote image or beacon in an SVG
    // / Markdown image can't phone home, and no content-supplied script runs.
    const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src '${RENDERED_SCRIPT_CSP_HASH}'`;
    return `<!doctype html><html><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="${csp}"><style>
      html,body{margin:0;}
      body{background:${t.bg};color:${t.text};font-family:${t.fontUi};font-size:14px;}
      ${layout}
    </style></head><body>${body}<script>${RENDERED_HEIGHT_REPORTER}</script></body></html>`;
  }, [kind, html, hasContent]);

  // Before the reporter's first message the pane fills the viewport; once a
  // height arrives it is sized to content so the pane never scrolls internally.
  const sizedHeight = height > 0 ? height + 'px' : '100%';

  return (
    <div style={{ width: width + 'px', flexShrink: 0, height: sizedHeight, overflow: 'hidden' }}>
      {srcDoc ? (
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          scrolling="no"
          srcDoc={srcDoc}
          title="Rendered preview"
          style={{ display: 'block', width: '100%', height: '100%', border: 'none', background: 'var(--bg-deep)' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px' }}>(empty)</div>
      )}
    </div>
  );
}

export default FileDiffView;
