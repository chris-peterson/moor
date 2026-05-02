import React, { useMemo, useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { computeLineChanges, diffChars } from '../engine/diff.js';
import Minimap from './Minimap.jsx';

const TAB_SPACES = '    ';
function expandTabs(str) {
  return str == null ? '' : str.replaceAll('\t', TAB_SPACES);
}

function SearchHighlight({ text, query, isCurrent }) {
  if (!query || !text) return expandTabs(text);
  const expanded = expandTabs(text);
  const lower = expanded.toLowerCase();
  const qLower = query.toLowerCase();
  const parts = [];
  let lastIdx = 0;
  let idx = lower.indexOf(qLower);
  while (idx !== -1) {
    if (idx > lastIdx) parts.push(expanded.slice(lastIdx, idx));
    parts.push(
      <span key={idx} style={{ background: 'var(--color-search)', color: 'var(--bg-deep)', borderRadius: '2px' }}>
        {expanded.slice(idx, idx + qLower.length)}
      </span>
    );
    lastIdx = idx + qLower.length;
    idx = lower.indexOf(qLower, lastIdx);
  }
  if (lastIdx < expanded.length) parts.push(expanded.slice(lastIdx));
  return parts.length > 0 ? <>{parts}</> : expandTabs(text);
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

function buildDisplayRows(leftLines, rightLines, hunks) {
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

function CharDiffSpans({ oldStr, newStr, side, dimmed }) {
  const parts = useMemo(() => diffChars(oldStr || '', newStr || ''), [oldStr, newStr]);
  return (
    <>
      {parts.map((part, i) => {
        if (side === 'left') {
          if (part.type === 'insert') return null;
          const highlight = !dimmed && part.type === 'delete';
          return (
            <span key={i} style={highlight ? { background: 'var(--color-left)', color: 'var(--bg-deep)', borderRadius: '2px' } : undefined}>
              {expandTabs(part.value)}
            </span>
          );
        } else {
          if (part.type === 'delete') return null;
          const highlight = !dimmed && part.type === 'insert';
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

function DiffRow({ row, active, reviewed, rejected, scrollLeft, leftWidth, rightWidth, onResizerMouseDown, onClick, onContextMenu, searchQuery, searchDimmed }) {
  const fontSize = active ? '15px' : '13px';
  const dimmed = (reviewed && !active) || searchDimmed;

  const barColor = active
    ? (rejected ? 'var(--color-conflict)' : 'var(--color-accent)')
    : (rejected ? 'var(--color-conflict)' : 'transparent');

  const lineNumStyle = {
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
    if (rejected) return 'var(--color-conflict-bg)';
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
    overflow: 'hidden',
    flex: 1,
    paddingLeft: '8px',
    transform: scrollLeft ? `translateX(-${scrollLeft}px)` : undefined,
  };

  const isModify = row.type === 'modify';
  const showCharDiff = isModify && areSimilarEnough(row.leftLine, row.rightLine);
  const leftType = isModify ? 'delete' : row.type;
  const rightType = isModify ? 'insert' : row.type;

  return (
    <div onClick={row.type !== 'equal' ? onClick : undefined} onContextMenu={row.type !== 'equal' ? onContextMenu : undefined} style={{ display: 'flex', height: ROW_HEIGHT + 'px', cursor: row.type !== 'equal' ? 'pointer' : 'default' }}>
      <div style={{ width: BAR_WIDTH + 'px', flexShrink: 0, background: barColor }} />
      <div style={{ width: leftWidth + 'px', display: 'flex', overflow: 'hidden', background: cellBg(leftType, 'left') }}>
        <span style={lineNumStyle}>{row.leftNum ?? ''}</span>
        <span style={codeStyle}>
          {searchQuery && !dimmed
            ? <SearchHighlight text={row.leftLine} query={searchQuery} />
            : showCharDiff
              ? <CharDiffSpans oldStr={row.leftLine} newStr={row.rightLine} side="left" dimmed={dimmed} />
              : expandTabs(row.leftLine)}
        </span>
      </div>
      <div onMouseDown={onResizerMouseDown} style={{ width: RESIZER_WIDTH + 'px', flexShrink: 0, background: 'var(--border)', cursor: 'col-resize' }} />
      <div style={{ width: rightWidth + 'px', display: 'flex', overflow: 'hidden', background: cellBg(rightType, 'right') }}>
        <span style={lineNumStyle}>{row.rightNum ?? ''}</span>
        <span style={codeStyle}>
          {searchQuery && !dimmed
            ? <SearchHighlight text={row.rightLine} query={searchQuery} />
            : showCharDiff
              ? <CharDiffSpans oldStr={row.leftLine} newStr={row.rightLine} side="right" dimmed={dimmed} />
              : expandTabs(row.rightLine)}
        </span>
      </div>
    </div>
  );
}

const BINARY_SENTINEL = '\x00BINARY';

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|bmp|webp|svg|ico)$/i;

export function FileDiffView({ leftPath, rightPath, leftContent, rightContent, leftFullPath, rightFullPath, onNavigateNext, onNavigatePrev, startAtEnd, startAtHunk, onHunkChange, reviewedHunks: externalReviewedHunks, onReviewedHunksChange, rejectedHunks: externalRejectedHunks, onRejectedHunksChange, rejectionReasons: externalRejectionReasons, onRejectionReasonsChange, onSearchChange }) {
  const leftBinary = leftContent === BINARY_SENTINEL;
  const rightBinary = rightContent === BINARY_SENTINEL;
  const isBinary = leftBinary || rightBinary;
  const isImage = isBinary && (IMAGE_EXTENSIONS.test(leftPath || '') || IMAGE_EXTENSIONS.test(rightPath || ''));

  const [leftDataUrl, setLeftDataUrl] = useState(null);
  const [rightDataUrl, setRightDataUrl] = useState(null);

  useEffect(() => {
    if (!isImage) { setLeftDataUrl(null); setRightDataUrl(null); return; }
    const api = window.kdiff4;
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
  const [internalRejectedHunks, setInternalRejectedHunks] = useState(() => new Set());
  const rejectedHunks = externalRejectedHunks || internalRejectedHunks;
  const setRejectedHunks = onRejectedHunksChange || setInternalRejectedHunks;
  const [internalRejectionReasons, setInternalRejectionReasons] = useState(() => new Map());
  const rejectionReasons = externalRejectionReasons || internalRejectionReasons;
  const setRejectionReasons = onRejectionReasonsChange || setInternalRejectionReasons;
  const [rejectingHunk, setRejectingHunk] = useState(null);
  const rejectInputRef = useRef(null);
  const rejectCompletedRef = useRef(false);
  const [splitPercent, setSplitPercent] = useState(50);
  const [draggingResizer, setDraggingResizer] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);
  const totalHeight = rows.length * ROW_HEIGHT;

  const maxContentWidth = useMemo(() => {
    const charWidth = 7.8;
    let maxLen = 0;
    for (const row of rows) {
      const leftLen = row.leftLine ? expandTabs(row.leftLine).length : 0;
      const rightLen = row.rightLine ? expandTabs(row.rightLine).length : 0;
      maxLen = Math.max(maxLen, leftLen, rightLen);
    }
    return maxLen * charWidth + 8;
  }, [rows]);

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

  const hunkStarts = useMemo(() => hunkRanges.map(r => r.start), [hunkRanges]);

  const rowToHunk = useMemo(() => {
    const map = new Map();
    for (let h = 0; h < hunkRanges.length; h++) {
      for (let i = hunkRanges[h].start; i <= hunkRanges[h].end; i++) {
        map.set(i, h);
      }
    }
    return map;
  }, [hunkRanges]);

  useEffect(() => {
    if (onNavigateNext) return;
    const totalHunks = hunkRanges.length;
    const reviewed = reviewedHunks.size;
    const rejected = rejectedHunks.size;
    const unreviewed = Math.max(0, totalHunks - reviewed - rejected);
    const rejections = [];
    for (const [hunkIdx, reason] of rejectionReasons) {
      const range = hunkRanges[hunkIdx];
      if (!range) continue;
      const row = rows[range.start];
      rejections.push({ file: rightPath || leftPath, hunk: hunkIdx, line: row?.rightNum || row?.leftNum || 1, reason });
    }
    window.__kdiff4QuitState = { rejected, unreviewed, rejections };
    return () => { window.__kdiff4QuitState = null; };
  }, [hunkRanges, rows, reviewedHunks, rejectedHunks, rejectionReasons, onNavigateNext, leftPath, rightPath]);

  useEffect(() => {
    if (rejectingHunk != null && rejectInputRef.current) {
      rejectInputRef.current.focus();
    }
  }, [rejectingHunk]);

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

  const rejectedRowSet = useMemo(() => {
    const set = new Set();
    for (const hIdx of rejectedHunks) {
      const range = hunkRanges[hIdx];
      if (range) {
        for (let i = range.start; i <= range.end; i++) set.add(i);
      }
    }
    return set;
  }, [hunkRanges, rejectedHunks]);

  const maxScroll = useMemo(() => {
    if (!viewportWidth) return 0;
    const availableWidth = Math.max(0, viewportWidth - BAR_WIDTH - RESIZER_WIDTH);
    const leftW = Math.round(availableWidth * splitPercent / 100);
    const rightW = availableWidth - leftW;
    // Line number column reserves 48 + 8 (padding-right); code area also has 8 padding-left.
    const codeAreaWidth = Math.max(0, Math.min(leftW, rightW) - 64);
    return Math.max(0, maxContentWidth - codeAreaWidth);
  }, [maxContentWidth, viewportWidth, splitPercent]);

  const searchMatches = useMemo(() => {
    if (!searchActive || !searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const matches = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const leftMatch = row.leftLine && row.leftLine.toLowerCase().includes(q);
      const rightMatch = row.rightLine && row.rightLine.toLowerCase().includes(q);
      if (leftMatch || rightMatch) matches.push(i);
    }
    return matches;
  }, [searchActive, searchQuery, rows]);

  const searchMatchingHunks = useMemo(() => {
    if (!searchActive || !searchQuery) return null;
    const set = new Set();
    for (const rowIdx of searchMatches) {
      const hIdx = rowToHunk.get(rowIdx);
      if (hIdx != null) set.add(hIdx);
    }
    return set;
  }, [searchActive, searchQuery, searchMatches, rowToHunk]);

  useEffect(() => {
    if (onSearchChange) onSearchChange(searchActive ? searchQuery : null);
  }, [searchActive, searchQuery, onSearchChange]);

  useEffect(() => {
    if (searchActive && searchInputRef.current) searchInputRef.current.focus();
  }, [searchActive]);

  const scrollToRow = useCallback((rowIdx) => {
    if (!scrollContainerRef.current) return;
    const top = rowIdx * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    const ev = Math.max(0, viewportHeight - headerHeight);
    const visibleTop = Math.max(0, scrollContainerRef.current.scrollTop - headerHeight);
    const visibleBottom = visibleTop + ev;
    if (top < visibleTop || bottom > visibleBottom) {
      scrollContainerRef.current.scrollTop = top - ev / 3 + headerHeight;
    }
  }, [viewportHeight, headerHeight]);

  const navigateMatch = useCallback((direction) => {
    if (searchMatches.length === 0) return;
    const nextIdx = direction === 'next'
      ? (currentMatchIdx + 1) % searchMatches.length
      : (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(nextIdx);
    scrollToRow(searchMatches[nextIdx]);
  }, [searchMatches, currentMatchIdx, scrollToRow]);

  const exitSearch = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
    setCurrentMatchIdx(0);
  }, []);

  useEffect(() => {
    if (onHunkChange) onHunkChange(currentHunk, hunkRanges.length);
  }, [currentHunk, hunkRanges.length, onHunkChange]);

  // Scroll to current hunk after render (useLayoutEffect = uses updated state, fires before paint)
  useLayoutEffect(() => {
    if (!scrollContainerRef.current || hunkStarts.length === 0) return;
    const range = hunkRanges[currentHunk];
    if (!range) return;
    const top = range.start * ROW_HEIGHT;
    const bottom = (range.end + 1) * ROW_HEIGHT;
    const hunkHeight = bottom - top;
    const ev = Math.max(0, viewportHeight - headerHeight);
    const visibleTop = Math.max(0, scrollContainerRef.current.scrollTop - headerHeight);
    const visibleBottom = visibleTop + ev;
    if (hunkHeight > ev) {
      // Hunk taller than viewport: NV-13 falls back to keeping the last line visible.
      scrollContainerRef.current.scrollTop = bottom - ev + headerHeight;
    } else if (top < visibleTop || bottom > visibleBottom) {
      // NV-13: when scroll is required, align the hunk's top to the viewport top.
      // Browser clamps scrollTop near the end of the document, which still keeps the hunk visible.
      scrollContainerRef.current.scrollTop = top + headerHeight;
    }
    setScrollLeft(0);
  }, [currentHunk, hunkRanges, viewportHeight, headerHeight]);

  const markCurrentReviewed = useCallback(() => {
    if (rejectedHunks.has(currentHunk)) return;
    setReviewedHunks(prev => {
      const next = new Set(prev);
      next.add(currentHunk);
      return next;
    });
  }, [currentHunk, rejectedHunks]);

  const [rejectInitialValue, setRejectInitialValue] = useState('');

  const beginReject = useCallback((hunkIdx) => {
    rejectCompletedRef.current = false;
    setRejectInitialValue(rejectionReasons.get(hunkIdx) || '');
    setRejectingHunk(hunkIdx);
  }, [rejectionReasons]);

  const completeRejection = useCallback((hunkIdx, reason) => {
    if (rejectCompletedRef.current) return;
    rejectCompletedRef.current = true;
    setRejectedHunks(prev => { const next = new Set(prev); next.add(hunkIdx); return next; });
    setReviewedHunks(prev => { const next = new Set(prev); next.delete(hunkIdx); return next; });
    if (reason) {
      setRejectionReasons(prev => { const next = new Map(prev); next.set(hunkIdx, reason); return next; });
    }
    setRejectingHunk(null);
  }, [setRejectedHunks, setReviewedHunks, setRejectionReasons]);

  const handleRowClick = useCallback((rowIdx) => {
    const hIdx = rowToHunk.get(rowIdx);
    if (hIdx == null) return;
    if (!rejectedHunks.has(hIdx)) {
      setReviewedHunks(prev => {
        const next = new Set(prev);
        next.add(hIdx);
        return next;
      });
    }
    setCurrentHunk(hIdx);
  }, [rowToHunk, rejectedHunks, setReviewedHunks]);

  const handleRowContextMenu = useCallback((e, rowIdx) => {
    const hIdx = rowToHunk.get(rowIdx);
    if (hIdx == null) return;
    e.preventDefault();
    setCurrentHunk(hIdx);
    setContextMenu({ x: e.clientX, y: e.clientY, hunk: hIdx });
  }, [rowToHunk]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const contextMenuActions = useMemo(() => {
    if (!contextMenu) return [];
    const h = contextMenu.hunk;
    const isReviewed = reviewedHunks.has(h);
    const isRejected = rejectedHunks.has(h);
    const actions = [];
    if (!isReviewed && !isRejected) {
      actions.push({ label: 'Mark as reviewed', action: () => {
        setReviewedHunks(prev => { const next = new Set(prev); next.add(h); return next; });
      }});
    }
    if (isReviewed) {
      actions.push({ label: 'Mark as unreviewed', action: () => {
        setReviewedHunks(prev => { const next = new Set(prev); next.delete(h); return next; });
      }});
    }
    if (!isRejected) {
      actions.push({ label: 'Reject', action: () => beginReject(h) });
    } else {
      actions.push({ label: 'Edit rejection note', action: () => beginReject(h) });
      actions.push({ label: 'Unreject', action: () => {
        setRejectedHunks(prev => { const next = new Set(prev); next.delete(h); return next; });
        setRejectionReasons(prev => { const next = new Map(prev); next.delete(h); return next; });
      }});
    }
    if (window.kdiff4?.openInEditor && rightPath && hunkRanges[h]) {
      const row = rows[hunkRanges[h].start];
      const line = row?.rightNum || row?.leftNum || 1;
      actions.push({ label: 'Open in editor', action: () => {
        window.kdiff4.openInEditor(rightPath, line, 1)
          .then(r => { if (r && !r.found) console.warn('open-in-editor:', r.error); });
      }});
    }
    return actions;
  }, [contextMenu, reviewedHunks, rejectedHunks, hunkRanges, rows, rightPath, setReviewedHunks, setRejectedHunks, setRejectionReasons, beginReject]);

  useEffect(() => {
    if (!contextMenu) return;
    // Dismiss only on outside interaction. Don't rely on stopPropagation from
    // menu items — React synthetic events and native document listeners don't
    // play well together and can drop the click before the action runs.
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

  useEffect(() => {
    setScrollTop(0);
    setScrollLeft(0);
    if (!externalReviewedHunks) setInternalReviewedHunks(new Set());
    setCurrentHunk(startAtHunk != null ? startAtHunk : startAtEnd && hunkStarts.length > 0 ? hunkStarts.length - 1 : 0);
    setCurrentMatchIdx(0);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [leftContent, rightContent]);

  useEffect(() => {
    if (hScrollRef.current && hScrollRef.current.scrollLeft !== scrollLeft) {
      hScrollRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        if (searchActive) {
          if (searchInputRef.current) { searchInputRef.current.focus(); searchInputRef.current.select(); }
        } else {
          setSearchActive(true);
        }
        return;
      }

      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (rejectingHunk != null) return;

      if (searchActive) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            navigateMatch('next');
            return;
          case 'N':
            e.preventDefault();
            navigateMatch('prev');
            return;
          case 'Escape':
            e.preventDefault();
            exitSearch();
            return;
        }
      }

      switch (e.key) {
        case 'j':
        case 'J': {
          e.preventDefault();
          markCurrentReviewed();
          if (currentHunk < hunkStarts.length - 1) {
            setCurrentHunk(currentHunk + 1);
          } else if (onNavigateNext) {
            onNavigateNext();
          }
          break;
        }
        case 'k':
        case 'K': {
          e.preventDefault();
          markCurrentReviewed();
          if (currentHunk > 0) {
            setCurrentHunk(currentHunk - 1);
          } else if (onNavigatePrev) {
            onNavigatePrev();
          }
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
        case 'r': {
          e.preventDefault();
          beginReject(currentHunk);
          break;
        }
        case 'R': {
          e.preventDefault();
          setRejectedHunks(prev => { const next = new Set(prev); next.delete(currentHunk); return next; });
          setRejectionReasons(prev => { const next = new Map(prev); next.delete(currentHunk); return next; });
          break;
        }
        case 'i': {
          e.preventDefault();
          if (window.kdiff4?.openInEditor && rightPath && hunkRanges[currentHunk]) {
            const row = rows[hunkRanges[currentHunk].start];
            const line = row?.rightNum || row?.leftNum || 1;
            window.kdiff4.openInEditor(rightPath, line, 1)
              .then(r => { if (r && !r.found) console.warn('open-in-editor:', r.error); });
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
  }, [hunkStarts, hunkRanges, currentHunk, reviewedHunks, rejectedHunks, markCurrentReviewed, totalHeight, maxScroll, onNavigateNext, onNavigatePrev, searchActive, navigateMatch, exitSearch, beginReject, setRejectionReasons, rejectingHunk]);

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
      // Trackpads emit small deltaX during predominantly-vertical scrolls and
      // strand the user mid-line. Only honor horizontal intent.
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
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Main column: scroll container (with sticky header) + hscrollbar */}
      <div ref={contentAreaRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Full-screen overlay during resizer drag to capture mouse everywhere */}
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
            {/* Scroll container with sticky header inside — guarantees header and rows share same width */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg-deep)' }}
            >
              {/* Sticky file path header */}
              <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-panel)' }}>
                <div style={{ display: 'flex', borderBottom: searchActive ? 'none' : '1px solid var(--border)' }}>
                  <div style={{ width: BAR_WIDTH + 'px', flexShrink: 0 }} />
                  <div style={headerCellStyle(leftPath === rightPath ? 'transparent' : 'var(--color-left)', leftWidth)}>
                    {leftPath === rightPath ? '' : (leftPath || '(empty)')}
                  </div>
                  <div onMouseDown={handleResizerMouseDown} style={{ width: RESIZER_WIDTH + 'px', flexShrink: 0, background: 'var(--border)', cursor: 'col-resize' }} />
                  <div style={headerCellStyle('var(--color-right)', rightWidth)}>{rightPath || '(empty)'}</div>
                </div>
                {searchActive && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 12px',
                    background: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatchIdx(0); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); exitSearch(); }
                        if (e.key === 'Enter') { e.preventDefault(); navigateMatch(e.shiftKey ? 'prev' : 'next'); e.target.blur(); }
                      }}
                      placeholder="Search..."
                      style={{
                        flex: 1,
                        maxWidth: '300px',
                        padding: '3px 8px',
                        background: 'var(--bg-deep)',
                        border: '1px solid var(--border)',
                        borderRadius: '3px',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = 'var(--color-accent)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                    />
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: searchMatches.length > 0 ? 'var(--text-secondary)' : 'var(--color-conflict)',
                    }}>
                      {searchQuery
                        ? `${searchMatches.length > 0 ? currentMatchIdx + 1 : 0}/${searchMatches.length}`
                        : ''}
                    </span>
                    <span
                      onClick={exitSearch}
                      style={{
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '16px',
                        lineHeight: 1,
                        padding: '0 2px',
                      }}
                      title="Close search (Esc)"
                    >
                      ✕
                    </span>
                  </div>
                )}
              </div>

              {/* Virtual scroll content */}
              <div style={{ height: totalHeight + 'px', position: 'relative' }}>
                {hunkRanges[currentHunk] && (
                  <div style={{
                    position: 'absolute',
                    top: hunkRanges[currentHunk].start * ROW_HEIGHT + 'px',
                    left: 0,
                    right: 0,
                    height: (hunkRanges[currentHunk].end - hunkRanges[currentHunk].start + 1) * ROW_HEIGHT + 'px',
                    border: `1px solid var(${rejectedHunks.has(currentHunk) || rejectingHunk === currentHunk ? '--color-conflict' : '--color-accent'})`,
                    borderRadius: '3px',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }} />
                )}
                {hunkRanges.map((range, hIdx) => {
                  const isEditing = rejectingHunk === hIdx;
                  const reason = rejectionReasons.get(hIdx);
                  const isRejected = rejectedHunks.has(hIdx);
                  if (!isEditing && !(isRejected && reason)) return null;
                  return (
                    <div key={`note-${hIdx}`} style={{
                      position: 'absolute',
                      top: (range.end + 1) * ROW_HEIGHT + 'px',
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      pointerEvents: 'auto',
                    }}>
                      {isEditing ? (
                        <textarea
                          ref={rejectInputRef}
                          key={`edit-${hIdx}`}
                          defaultValue={rejectInitialValue}
                          rows={2}
                          placeholder="Rejection reason (optional) — Enter to confirm, Shift+Enter for newline, Escape to skip"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              completeRejection(rejectingHunk, e.target.value.trim() || null);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              completeRejection(rejectingHunk, null);
                            }
                            e.stopPropagation();
                          }}
                          onBlur={() => {
                            completeRejection(rejectingHunk, rejectInputRef.current?.value.trim() || null);
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 8px',
                            fontSize: '13px',
                            fontFamily: 'var(--font-ui)',
                            background: 'var(--bg-panel)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--color-conflict)',
                            borderRadius: '3px',
                            outline: 'none',
                            resize: 'vertical',
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => beginReject(hIdx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 8px',
                            fontSize: '12px',
                            fontFamily: 'var(--font-ui)',
                            background: 'var(--bg-panel)',
                            color: 'var(--color-conflict)',
                            borderLeft: '3px solid var(--color-conflict)',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{reason}</span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setRejectionReasons(prev => { const next = new Map(prev); next.delete(hIdx); return next; });
                            }}
                            style={{ opacity: 0.5, cursor: 'pointer', fontSize: '11px' }}
                            title="Remove note"
                          >✕</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ position: 'absolute', top: startIdx * ROW_HEIGHT + 'px', left: 0, right: 0 }}>
                  {visibleRows.map((row, i) => {
                    const idx = startIdx + i;
                    const hIdx = rowToHunk.get(idx);
                    const isSearchDimmed = searchMatchingHunks != null && hIdx != null && !searchMatchingHunks.has(hIdx);
                    return (
                      <DiffRow
                        key={idx}
                        row={row}
                        active={activeRowSet.has(idx)}
                        reviewed={reviewedRowSet.has(idx)}
                        rejected={rejectedRowSet.has(idx)}
                        scrollLeft={scrollLeft}
                        leftWidth={leftWidth}
                        rightWidth={rightWidth}
                        onResizerMouseDown={handleResizerMouseDown}
                        onClick={() => handleRowClick(idx)}
                        onContextMenu={(e) => handleRowContextMenu(e, idx)}
                        searchQuery={searchActive ? searchQuery : null}
                        searchDimmed={isSearchDimmed}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Horizontal scrollbar */}
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

      {/* Minimap — sibling of the main column, not inside it */}
      {!isBinary && (
        <Minimap
          rows={rows}
          totalHeight={totalHeight}
          viewportHeight={viewportHeight}
          scrollTop={scrollTop}
          onScrollTo={handleMinimapScroll}
          reviewedRows={reviewedRowSet}
          rejectedRows={rejectedRowSet}
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
        {rejectedHunks.size > 0 && (
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
            {rejectedHunks.size} rejected
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
              width: `${hunkRanges.length > 0 ? (reviewedHunks.size + rejectedHunks.size) / hunkRanges.length * 100 : 0}%`,
              height: '100%',
              background: reviewedHunks.size + rejectedHunks.size >= hunkRanges.length ? 'var(--color-equal)' : 'var(--color-accent)',
              borderRadius: '2px',
              transition: 'width 0.2s',
            }} />
          </div>
          <span>
            {reviewedHunks.size + rejectedHunks.size >= hunkRanges.length ? (
              <span style={{ color: 'var(--color-equal)' }}>All changes viewed · q to close</span>
            ) : (
              <>{reviewedHunks.size + rejectedHunks.size} of {hunkRanges.length} changes viewed</>
            )}
          </span>
        </div>
      </div>
    )}
    </div>
  );
}

export default FileDiffView;
