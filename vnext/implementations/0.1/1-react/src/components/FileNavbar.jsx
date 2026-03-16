import React, { useRef, useEffect } from 'react';

const statusColor = (status) => {
  switch (status) {
    case 'modified': return 'var(--color-left)';
    case 'left-only': return 'var(--color-left)';
    case 'right-only': return 'var(--color-right)';
    default: return 'var(--text-muted)';
  }
};

export function FileNavbar({ files, currentIndex, viewed, onSelect, allViewed }) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentIndex]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      height: '36px',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '0 12px',
        fontFamily: 'var(--font-ui)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
          {currentIndex + 1}/{files.length}
        </span>
        {allViewed && (
          <span style={{ color: 'var(--color-equal)', fontSize: '10px' }}>
            ALL VIEWED
          </span>
        )}
      </div>
      <div style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          display: 'flex',
          gap: '2px',
          padding: '0 8px',
          overflow: 'auto',
          alignItems: 'center',
        }}
      >
        {files.map((file, i) => {
          const isCurrent = i === currentIndex;
          const isViewed = viewed.has(i);
          return (
            <button
              key={file.leftPath || file.rightPath}
              ref={isCurrent ? activeRef : null}
              onClick={() => onSelect(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: isCurrent
                  ? 'var(--text-primary)'
                  : isViewed
                    ? 'var(--text-muted)'
                    : 'var(--text-secondary)',
                background: isCurrent ? 'var(--bg-hover)' : 'transparent',
                border: isCurrent ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: '3px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background 0.1s',
              }}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isViewed ? 'var(--color-equal)' : statusColor(file.status),
                flexShrink: 0,
              }} />
              {file.name}
            </button>
          );
        })}
      </div>
      <div style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />
      <div style={{
        padding: '0 12px',
        fontFamily: 'var(--font-ui)',
        fontSize: '10px',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        {allViewed ? 'q to close' : 'j/k navigate'}
      </div>
    </div>
  );
}

export default FileNavbar;
