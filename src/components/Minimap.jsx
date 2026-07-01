import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';

const MINIMAP_WIDTH = 40;

const typeToColor = {
  delete: 'var(--color-left)',
  insert: 'var(--color-right)',
  modify: 'var(--color-left)',
  conflict: 'var(--color-conflict)',
  equal: 'transparent',
};

// `topOffset` (the sticky file header's height) is left blank at the top so the
// change bands line up with the diff rows, which begin below that header. The
// minimap still stretches to the full column height — the offset is handled in
// the math, not by shrinking the element (which would collapse its canvas).
export function Minimap({ rows, totalHeight, viewportHeight, scrollTop, topOffset = 0, onScrollTo, reviewedRows, commentRowColors }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The rows occupy the minimap below the header band. Map document pixels into
  // that region, capped at 1:1 so a file shorter than the minimap keeps its rows
  // at real size (mirroring the diff view) instead of ballooning a few changed
  // lines into a full-height block.
  const availableHeight = Math.max(0, containerHeight - topOffset);
  const scale = availableHeight > 0 && totalHeight > 0 ? Math.min(1, availableHeight / totalHeight) : 1;

  const colorMap = useMemo(() => {
    return rows.map((row, i) => {
      // A comment marker (colored by its action) takes precedence over the
      // row's own change color.
      if (commentRowColors && commentRowColors.has(i)) return commentRowColors.get(i);
      return typeToColor[row.type] || 'transparent';
    });
  }, [rows, commentRowColors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerHeight === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = containerHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, MINIMAP_WIDTH, containerHeight);

    // ROW_HEIGHT (= totalHeight / rows.length) scaled by the fit factor: rows
    // shrink to fit a long file, but never stretch beyond their real size.
    const rowHeight = rows.length > 0 ? (totalHeight / rows.length) * scale : 1;
    const style = getComputedStyle(document.documentElement);
    const resolvedColors = new Map();
    const resolve = (cssValue) => {
      if (resolvedColors.has(cssValue)) return resolvedColors.get(cssValue);
      const varName = cssValue.match(/var\((.+)\)/)?.[1];
      const color = varName ? style.getPropertyValue(varName).trim() : null;
      resolvedColors.set(cssValue, color);
      return color;
    };

    for (let i = 0; i < colorMap.length; i++) {
      if (colorMap[i] === 'transparent') continue;
      const color = resolve(colorMap[i]);
      if (!color) continue;

      ctx.globalAlpha = reviewedRows && reviewedRows.has(i) ? 0.5 : 1;
      ctx.fillStyle = color;
      const y = topOffset + i * rowHeight;
      const h = Math.max(1, rowHeight);
      ctx.fillRect(0, y, MINIMAP_WIDTH, h);
    }
    ctx.globalAlpha = 1;
  }, [colorMap, containerHeight, rows.length, reviewedRows, totalHeight, scale, topOffset]);

  const viewportIndicatorTop = topOffset + scrollTop * scale;
  const viewportIndicatorHeight = Math.max(10, viewportHeight * scale);

  const scrollFromEvent = useCallback((clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const y = clientY - rect.top - topOffset;
    const targetScroll = availableHeight > 0
      ? (y / availableHeight) * totalHeight - viewportHeight / 2
      : 0;
    onScrollTo(Math.max(0, Math.min(Math.max(0, totalHeight - viewportHeight), targetScroll)));
  }, [availableHeight, topOffset, totalHeight, viewportHeight, onScrollTo]);

  const handleClick = useCallback((e) => scrollFromEvent(e.clientY), [scrollFromEvent]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;

    const handleMouseMove = (e) => {
      if (!dragging.current) return;
      scrollFromEvent(e.clientY);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [scrollFromEvent]);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        width: MINIMAP_WIDTH + 'px',
        flexShrink: 0,
        position: 'relative',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        cursor: 'pointer',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: MINIMAP_WIDTH + 'px',
          height: containerHeight + 'px',
          display: 'block',
        }}
      />
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          top: viewportIndicatorTop + 'px',
          left: 0,
          width: '100%',
          height: viewportIndicatorHeight + 'px',
          background: 'var(--color-accent-bg)',
          border: '1px solid var(--color-accent-border)',
          cursor: 'grab',
        }}
      />
    </div>
  );
}

export default Minimap;
