import React, { useMemo, useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { computeLineChanges, diffChars } from '../engine/diff.js';
import Minimap from './Minimap.jsx';

const TAB_SPACES = '    ';
function expandTabs(str) {
  return str == null ? '' : str.replaceAll('\t', TAB_SPACES);
}

function areSimilarEnough(a, b) {
  if (!a || !b) return false;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;
  let common = 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  const longerSet = new Set();
  for (let i = 0; i < longer.length; i++) longerSet.add(longer[i]);
  for (let i = 0; i < shorter.length; i++) {
    if (longerSet.has(shorter[i])) common++;
  }
  return common / maxLen > 0.4;
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

function DiffRow({ row, active, reviewed, rejected, scrollLeft, leftWidth, rightWidth, onResizerMouseDown, onClick }) {
  const fontSize = active ? '15px' : '13px';
  const dimmed = reviewed && !active;

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
    <div onClick={row.type !== 'equal' ? onClick : undefined} style={{ display: 'flex', height: ROW_HEIGHT + 'px', cursor: row.type !== 'equal' ? 'pointer' : 'default' }}>
      <div style={{ width: BAR_WIDTH + 'px', flexShrink: 0, background: barColor }} />
      <div style={{ width: leftWidth + 'px', display: 'flex', overflow: 'hidden', background: cellBg(leftType, 'left') }}>
        <span style={lineNumStyle}>{row.leftNum ?? ''}</span>
        <span style={codeStyle}>
          {showCharDiff ? <CharDiffSpans oldStr={row.leftLine} newStr={row.rightLine} side="left" dimmed={dimmed} /> : expandTabs(row.leftLine)}
        </span>
      </div>
      <div onMouseDown={onResizerMouseDown} style={{ width: RESIZER_WIDTH + 'px', flexShrink: 0, background: 'var(--border)', cursor: 'col-resize' }} />
      <div style={{ width: rightWidth + 'px', display: 'flex', overflow: 'hidden', background: cellBg(rightType, 'right') }}>
        <span style={lineNumStyle}>{row.rightNum ?? ''}</span>
        <span style={codeStyle}>
          {showCharDiff ? <CharDiffSpans oldStr={row.leftLine} newStr={row.rightLine} side="right" dimmed={dimmed} /> : expandTabs(row.rightLine)}
        </span>
      </div>
    </div>
  );
}

const BINARY_SENTINEL = '\x00BINARY';

export function FileDiffView({ leftPath, rightPath, leftContent, rightContent, onNavigateNext, onNavigatePrev, startAtEnd, onHunkChange, reviewedHunks: externalReviewedHunks, onReviewedHunksChange, rejectedHunks: externalRejectedHunks, onRejectedHunksChange }) {
  const leftBinary = leftContent === BINARY_SENTINEL;
  const rightBinary = rightContent === BINARY_SENTINEL;
  const isBinary = leftBinary || rightBinary;

  const leftLines = useMemo(() => isBinary || !leftContent ? [] : leftContent.split('\n'), [leftContent, isBinary]);
  const rightLines = useMemo(() => isBinary || !rightContent ? [] : rightContent.split('\n'), [rightContent, isBinary]);

  const hunks = useMemo(() => isBinary ? [] : computeLineChanges(leftLines, rightLines), [leftLines, rightLines, isBinary]);
  const rows = useMemo(() => isBinary ? [] : buildDisplayRows(leftLines, rightLines, hunks), [leftLines, rightLines, hunks, isBinary]);

  const scrollContainerRef = useRef(null);
  const contentAreaRef = useRef(null);
  const headerRef = useRef(null);
  const hScrollRef = useRef(null);
  const lastReviewedHunk = useRef(null);

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
  const [splitPercent, setSplitPercent] = useState(50);
  const [draggingResizer, setDraggingResizer] = useState(false);
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

  const panelWidth = useMemo(() => {
    if (!viewportWidth) return 0;
    return Math.round((viewportWidth - BAR_WIDTH - RESIZER_WIDTH) * splitPercent / 100);
  }, [viewportWidth, splitPercent]);

  const maxScroll = useMemo(() => Math.max(0, maxContentWidth - panelWidth), [maxContentWidth, panelWidth]);

  useEffect(() => {
    if (onHunkChange) onHunkChange(currentHunk, hunkRanges.length);
  }, [currentHunk, hunkRanges.length, onHunkChange]);

  // Scroll to current hunk after render (useLayoutEffect = uses updated state, fires before paint)
  useLayoutEffect(() => {
    if (!scrollContainerRef.current || hunkStarts.length === 0) return;
    const rowIdx = hunkStarts[currentHunk];
    if (rowIdx == null) return;
    const top = rowIdx * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    const ev = Math.max(0, viewportHeight - headerHeight);
    const visibleTop = Math.max(0, scrollContainerRef.current.scrollTop - headerHeight);
    const visibleBottom = visibleTop + ev;
    if (top < visibleTop) {
      scrollContainerRef.current.scrollTop = top + headerHeight;
    } else if (bottom > visibleBottom) {
      scrollContainerRef.current.scrollTop = bottom - ev + headerHeight;
    }
  }, [currentHunk, hunkStarts, viewportHeight, headerHeight]);

  const markCurrentReviewed = useCallback(() => {
    if (rejectedHunks.has(currentHunk)) return;
    lastReviewedHunk.current = currentHunk;
    setReviewedHunks(prev => {
      const next = new Set(prev);
      next.add(currentHunk);
      return next;
    });
  }, [currentHunk, rejectedHunks]);

  const handleRowClick = useCallback((rowIdx) => {
    const hIdx = rowToHunk.get(rowIdx);
    if (hIdx == null) return;
    if (hIdx === currentHunk) {
      setReviewedHunks(prev => {
        const next = new Set(prev);
        next.add(currentHunk);
        return next;
      });
    } else {
      setCurrentHunk(hIdx);
    }
  }, [rowToHunk, currentHunk, setReviewedHunks]);

  useEffect(() => {
    setScrollTop(0);
    setScrollLeft(0);
    if (!externalReviewedHunks) setInternalReviewedHunks(new Set());
    setCurrentHunk(startAtEnd && hunkStarts.length > 0 ? hunkStarts.length - 1 : 0);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [leftContent, rightContent]);

  useEffect(() => {
    if (hScrollRef.current && hScrollRef.current.scrollLeft !== scrollLeft) {
      hScrollRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

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
          if (lastReviewedHunk.current != null) {
            const target = lastReviewedHunk.current;
            setReviewedHunks(prev => {
              const next = new Set(prev);
              next.delete(target);
              return next;
            });
            setCurrentHunk(target);
            lastReviewedHunk.current = null;
          }
          break;
        }
        case 'r': {
          e.preventDefault();
          setRejectedHunks(prev => {
            const next = new Set(prev);
            next.add(currentHunk);
            return next;
          });
          setReviewedHunks(prev => {
            const next = new Set(prev);
            next.delete(currentHunk);
            return next;
          });
          break;
        }
        case 'R': {
          e.preventDefault();
          setRejectedHunks(prev => {
            const next = new Set(prev);
            next.delete(currentHunk);
            return next;
          });
          break;
        }
        case 'i': {
          e.preventDefault();
          if (window.kdiff4?.openInEditor && rightPath && hunkRanges[currentHunk]) {
            const row = rows[hunkRanges[currentHunk].start];
            const line = row?.rightNum || row?.leftNum || 1;
            window.kdiff4.openInEditor(rightPath, line, 1);
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
  }, [hunkStarts, hunkRanges, currentHunk, reviewedHunks, rejectedHunks, markCurrentReviewed, totalHeight, maxScroll, onNavigateNext, onNavigatePrev]);

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
      if (e.deltaX !== 0) {
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
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
              Binary files differ
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
              <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                <div style={{ width: BAR_WIDTH + 'px', flexShrink: 0 }} />
                <div style={headerCellStyle(leftPath === rightPath ? 'transparent' : 'var(--color-left)', leftWidth)}>
                  {leftPath === rightPath ? '' : (leftPath || '(empty)')}
                </div>
                <div onMouseDown={handleResizerMouseDown} style={{ width: RESIZER_WIDTH + 'px', flexShrink: 0, background: 'var(--border)', cursor: 'col-resize' }} />
                <div style={headerCellStyle('var(--color-right)', rightWidth)}>{rightPath || '(empty)'}</div>
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
                    border: `1px solid var(${rejectedHunks.has(currentHunk) ? '--color-conflict' : '--color-accent'})`,
                    borderRadius: '3px',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }} />
                )}
                <div style={{ position: 'absolute', top: startIdx * ROW_HEIGHT + 'px', left: 0, right: 0 }}>
                  {visibleRows.map((row, i) => {
                    const idx = startIdx + i;
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
    </div>
  );
}

export default FileDiffView;
