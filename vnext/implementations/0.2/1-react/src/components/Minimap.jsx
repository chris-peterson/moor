import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';

const MINIMAP_WIDTH = 40;

const typeToColor = {
  delete: 'var(--color-left)',
  insert: 'var(--color-right)',
  modify: 'var(--color-left)',
  conflict: 'var(--color-conflict)',
  equal: 'transparent',
};

export function Minimap({ rows, totalHeight, viewportHeight, scrollTop, onScrollTo, reviewedRows, rejectedRows }) {
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

  const scale = containerHeight > 0 && totalHeight > 0 ? containerHeight / totalHeight : 1;

  const colorMap = useMemo(() => {
    return rows.map((row, i) => {
      if (rejectedRows && rejectedRows.has(i)) return 'var(--color-conflict)';
      return typeToColor[row.type] || 'transparent';
    });
  }, [rows, rejectedRows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerHeight === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = containerHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, MINIMAP_WIDTH, containerHeight);

    const rowHeight = rows.length > 0 ? containerHeight / rows.length : 1;

    for (let i = 0; i < colorMap.length; i++) {
      if (colorMap[i] === 'transparent') continue;
      const style = getComputedStyle(document.documentElement);
      const varName = colorMap[i].match(/var\((.+)\)/)?.[1];
      if (!varName) continue;
      const color = style.getPropertyValue(varName).trim();
      if (!color) continue;

      ctx.globalAlpha = reviewedRows && reviewedRows.has(i) ? 0.5 : 1;
      ctx.fillStyle = color;
      const y = i * rowHeight;
      const h = Math.max(1, rowHeight);
      ctx.fillRect(0, y, MINIMAP_WIDTH, h);
    }
    ctx.globalAlpha = 1;
  }, [colorMap, containerHeight, rows.length, reviewedRows]);

  const viewportIndicatorTop = scrollTop * scale;
  const viewportIndicatorHeight = Math.max(10, viewportHeight * scale);

  const handleClick = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const targetScroll = (y / containerHeight) * totalHeight - viewportHeight / 2;
    onScrollTo(Math.max(0, Math.min(totalHeight - viewportHeight, targetScroll)));
  }, [containerHeight, totalHeight, viewportHeight, onScrollTo]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;

    const handleMouseMove = (e) => {
      if (!dragging.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const targetScroll = (y / containerHeight) * totalHeight - viewportHeight / 2;
      onScrollTo(Math.max(0, Math.min(totalHeight - viewportHeight, targetScroll)));
    };

    const handleMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [containerHeight, totalHeight, viewportHeight, onScrollTo]);

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
          background: 'rgba(123, 147, 219, 0.15)',
          border: '1px solid rgba(123, 147, 219, 0.3)',
          cursor: 'grab',
        }}
      />
    </div>
  );
}

export default Minimap;
