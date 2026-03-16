import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
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

const ROW_HEIGHT = Math.ceil(13 * 1.6);
const OVERSCAN = 20;

function buildDisplayRows(leftLines, rightLines, hunks) {
  const rows = [];

  for (let h = 0; h < hunks.length; h++) {
    const hunk = hunks[h];

    if (hunk.type === 'equal') {
      for (let o = hunk.oldStart, n = hunk.newStart; o <= hunk.oldEnd; o++, n++) {
        rows.push({
          type: 'equal',
          leftLine: leftLines[o],
          rightLine: rightLines[n],
          leftNum: o + 1,
          rightNum: n + 1,
        });
      }
    } else if (hunk.type === 'delete') {
      const next = hunks[h + 1];
      if (next && next.type === 'insert') {
        const delCount = hunk.oldEnd - hunk.oldStart + 1;
        const insCount = next.newEnd - next.newStart + 1;
        const paired = Math.min(delCount, insCount);

        for (let i = 0; i < paired; i++) {
          rows.push({
            type: 'modify',
            leftLine: leftLines[hunk.oldStart + i],
            rightLine: rightLines[next.newStart + i],
            leftNum: hunk.oldStart + i + 1,
            rightNum: next.newStart + i + 1,
          });
        }
        for (let i = paired; i < delCount; i++) {
          rows.push({
            type: 'delete',
            leftLine: leftLines[hunk.oldStart + i],
            rightLine: null,
            leftNum: hunk.oldStart + i + 1,
            rightNum: null,
          });
        }
        for (let i = paired; i < insCount; i++) {
          rows.push({
            type: 'insert',
            leftLine: null,
            rightLine: rightLines[next.newStart + i],
            leftNum: null,
            rightNum: next.newStart + i + 1,
          });
        }
        h++;
      } else {
        for (let o = hunk.oldStart; o <= hunk.oldEnd; o++) {
          rows.push({
            type: 'delete',
            leftLine: leftLines[o],
            rightLine: null,
            leftNum: o + 1,
            rightNum: null,
          });
        }
      }
    } else if (hunk.type === 'insert') {
      for (let n = hunk.newStart; n <= hunk.newEnd; n++) {
        rows.push({
          type: 'insert',
          leftLine: null,
          rightLine: rightLines[n],
          leftNum: null,
          rightNum: n + 1,
        });
      }
    }
  }

  return rows;
}

function CharDiffSpans({ oldStr, newStr, side }) {
  const parts = useMemo(() => diffChars(oldStr || '', newStr || ''), [oldStr, newStr]);

  return (
    <>
      {parts.map((part, i) => {
        if (side === 'left') {
          if (part.type === 'insert') return null;
          const highlight = part.type === 'delete';
          return (
            <span
              key={i}
              style={highlight ? {
                background: 'var(--color-left)',
                color: 'var(--bg-deep)',
                borderRadius: '2px',
              } : undefined}
            >
              {expandTabs(part.value)}
            </span>
          );
        } else {
          if (part.type === 'delete') return null;
          const highlight = part.type === 'insert';
          return (
            <span
              key={i}
              style={highlight ? {
                background: 'var(--color-right)',
                color: 'var(--bg-deep)',
                borderRadius: '2px',
              } : undefined}
            >
              {expandTabs(part.value)}
            </span>
          );
        }
      })}
    </>
  );
}

function DiffRow({ row, active, scrollLeft }) {
  const lineNumStyle = {
    width: '48px',
    minWidth: '48px',
    textAlign: 'right',
    paddingRight: '8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-code)',
    lineHeight: 'var(--line-height-code)',
    color: 'var(--text-muted)',
    userSelect: 'none',
    flexShrink: 0,
  };

  const cellStyle = (type, side) => {
    let bg = 'transparent';
    if (type === 'delete' && side === 'left') bg = 'var(--color-left-bg)';
    if (type === 'insert' && side === 'right') bg = 'var(--color-right-bg)';
    return {
      flex: 1,
      display: 'flex',
      minWidth: 0,
      overflow: 'hidden',
      background: bg,
    };
  };

  const codeStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-code)',
    lineHeight: 'var(--line-height-code)',
    whiteSpace: 'pre',
    overflow: 'hidden',
    flex: 1,
    paddingLeft: '8px',
    transform: scrollLeft ? `translateX(-${scrollLeft}px)` : undefined,
  };

  const isModify = row.type === 'modify';
  const showCharDiff = isModify && areSimilarEnough(row.leftLine, row.rightLine);

  return (
    <div style={{ display: 'flex', height: ROW_HEIGHT + 'px' }}>
      {active && (
        <div style={{
          width: '3px',
          flexShrink: 0,
          background: 'var(--color-accent)',
        }} />
      )}
      <div style={cellStyle(isModify ? 'delete' : row.type, 'left')}>
        <span style={lineNumStyle}>{row.leftNum ?? ''}</span>
        <span style={codeStyle}>
          {showCharDiff
            ? <CharDiffSpans oldStr={row.leftLine} newStr={row.rightLine} side="left" />
            : expandTabs(row.leftLine)
          }
        </span>
      </div>
      <div style={{ width: '1px', background: 'var(--border)', flexShrink: 0 }} />
      <div style={cellStyle(isModify ? 'insert' : row.type, 'right')}>
        <span style={lineNumStyle}>{row.rightNum ?? ''}</span>
        <span style={codeStyle}>
          {showCharDiff
            ? <CharDiffSpans oldStr={row.leftLine} newStr={row.rightLine} side="right" />
            : expandTabs(row.rightLine)
          }
        </span>
      </div>
    </div>
  );
}

const BINARY_SENTINEL = '\x00BINARY';

export function FileDiffView({ leftPath, rightPath, leftContent, rightContent, onNavigateNext, onNavigatePrev, startAtEnd, onHunkChange }) {
  const leftBinary = leftContent === BINARY_SENTINEL;
  const rightBinary = rightContent === BINARY_SENTINEL;
  const isBinary = leftBinary || rightBinary;

  const leftLines = useMemo(() => isBinary || !leftContent ? [] : leftContent.split('\n'), [leftContent, isBinary]);
  const rightLines = useMemo(() => isBinary || !rightContent ? [] : rightContent.split('\n'), [rightContent, isBinary]);

  const hunks = useMemo(() => isBinary ? [] : computeLineChanges(leftLines, rightLines), [leftLines, rightLines, isBinary]);
  const rows = useMemo(() => isBinary ? [] : buildDisplayRows(leftLines, rightLines, hunks), [leftLines, rightLines, hunks, isBinary]);

  const totalHeight = rows.length * ROW_HEIGHT;
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [currentHunk, setCurrentHunk] = useState(0);
  const pendingKey = useRef(null);

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

  const hunkStarts = useMemo(() => {
    return hunkRanges.map(r => r.start);
  }, [hunkRanges]);

  const activeRowSet = useMemo(() => {
    if (hunkRanges.length === 0) return new Set();
    const range = hunkRanges[currentHunk];
    if (!range) return new Set();
    const set = new Set();
    for (let i = range.start; i <= range.end; i++) set.add(i);
    return set;
  }, [hunkRanges, currentHunk]);

  useEffect(() => {
    if (onHunkChange) onHunkChange(currentHunk, hunkRanges.length);
  }, [currentHunk, hunkRanges.length, onHunkChange]);

  const scrollToRow = useCallback((rowIdx) => {
    if (!containerRef.current) return;
    const top = rowIdx * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    const visibleTop = containerRef.current.scrollTop;
    const visibleBottom = visibleTop + viewportHeight;
    if (top < visibleTop) {
      containerRef.current.scrollTop = top;
    } else if (bottom > visibleBottom) {
      containerRef.current.scrollTop = bottom - viewportHeight;
    }
  }, [viewportHeight]);

  useEffect(() => {
    setScrollTop(0);
    setScrollLeft(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [leftContent, rightContent]);

  useEffect(() => {
    if (hunkStarts.length > 0 && !isBinary) {
      if (startAtEnd) {
        const lastIdx = hunkStarts.length - 1;
        setCurrentHunk(lastIdx);
        scrollToRow(hunkStarts[lastIdx], true);
      } else {
        setCurrentHunk(0);
        scrollToRow(hunkStarts[0], true);
      }
    } else {
      setCurrentHunk(0);
    }
  }, [hunkStarts, isBinary, scrollToRow, startAtEnd]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      if (e.key === 'g' && !e.shiftKey) {
        if (pendingKey.current === 'g') {
          pendingKey.current = null;
          scrollToRow(0, false);
          return;
        }
        pendingKey.current = 'g';
        setTimeout(() => { pendingKey.current = null; }, 500);
        return;
      }
      pendingKey.current = null;

      switch (e.key) {
        case 'j':
        case 'J':
        case 'ArrowDown':
        case 'ArrowRight': {
          e.preventDefault();
          if (currentHunk < hunkStarts.length - 1) {
            const next = currentHunk + 1;
            setCurrentHunk(next);
            scrollToRow(hunkStarts[next], true);
          } else if (onNavigateNext) {
            onNavigateNext();
          }
          break;
        }
        case 'k':
        case 'K':
        case 'ArrowUp':
        case 'ArrowLeft': {
          e.preventDefault();
          if (currentHunk > 0) {
            const prev = currentHunk - 1;
            setCurrentHunk(prev);
            scrollToRow(hunkStarts[prev], true);
          } else if (onNavigatePrev) {
            onNavigatePrev();
          }
          break;
        }
        case 'G': {
          e.preventDefault();
          if (containerRef.current) {
            containerRef.current.scrollTop = totalHeight;
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
  }, [hunkStarts, currentHunk, scrollToRow, totalHeight, onNavigateNext, onNavigatePrev]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setViewportHeight(el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.deltaX !== 0) {
        e.preventDefault();
        setScrollLeft(prev => {
          const panelWidth = (el.clientWidth - 49) / 2;
          const maxScroll = Math.max(0, maxContentWidth - panelWidth);
          return Math.max(0, Math.min(maxScroll, prev + e.deltaX));
        });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [maxContentWidth]);

  const handleMinimapScroll = useCallback((newScrollTop) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = newScrollTop;
    }
  }, []);

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(startIdx, endIdx);

  const headerStyle = (color) => ({
    flex: 1,
    padding: '5px 16px',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: color,
    background: 'var(--bg-panel)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={headerStyle('var(--color-left)')}>{leftPath || '(empty)'}</div>
        <div style={{ width: '1px', background: 'var(--border)' }} />
        <div style={headerStyle('var(--color-right)')}>{rightPath || '(empty)'}</div>
      </div>

      {isBinary ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-deep)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          fontSize: '14px',
        }}>
          Binary files differ
        </div>
      ) : (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--bg-deep)',
          }}
        >
          <div style={{ height: totalHeight + 'px', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: startIdx * ROW_HEIGHT + 'px',
              left: 0,
              right: 0,
            }}>
              {visibleRows.map((row, i) => (
                <DiffRow key={startIdx + i} row={row} active={activeRowSet.has(startIdx + i)} scrollLeft={scrollLeft} />
              ))}
            </div>
          </div>
        </div>

        <Minimap
          rows={rows}
          totalHeight={totalHeight}
          viewportHeight={viewportHeight}
          scrollTop={scrollTop}
          onScrollTo={handleMinimapScroll}
        />
      </div>
      )}
    </div>
  );
}

export default FileDiffView;
