import React from 'react';

export function FileNavbar({ files, currentIndex, allViewed, hunkCounts, viewed, perFileReviewedHunks, perFileRejectedHunks, currentFilePath, onNavigateToFile }) {
  let viewedChanges = 0;
  let totalChanges = 0;
  for (let i = 0; i < files.length; i++) {
    const count = hunkCounts[i] || 0;
    totalChanges += count;
    if (viewed.has(i)) {
      viewedChanges += count;
    } else {
      const fileReviewed = perFileReviewedHunks?.[i];
      if (fileReviewed) viewedChanges += fileReviewed.size;
    }
  }
  const progress = totalChanges > 0 ? viewedChanges / totalChanges : 0;

  const rejectionBadges = [];
  if (perFileRejectedHunks) {
    for (let i = 0; i < files.length; i++) {
      const rejected = perFileRejectedHunks[i];
      if (rejected && rejected.size > 0) {
        const file = files[i];
        const name = (file.rightPath || file.leftPath || '').split('/').pop();
        rejectionBadges.push({ fileIndex: i, count: rejected.size, name });
      }
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      {currentFilePath && (
        <div style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'var(--text-secondary)',
          flexShrink: 1,
          minWidth: 0,
        }}>
          {currentFilePath}
        </div>
      )}
      {rejectionBadges.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {rejectionBadges.map(({ fileIndex, count, name }) => (
            <button
              key={fileIndex}
              onClick={() => onNavigateToFile?.(fileIndex)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: 'var(--color-conflict)',
                color: 'var(--bg-primary)',
                border: 'none',
                borderRadius: '10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {count} rejected · {name}
            </button>
          ))}
        </div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '120px',
          height: '4px',
          background: 'var(--border)',
          borderRadius: '2px',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <div style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: allViewed ? 'var(--color-equal)' : 'var(--color-accent)',
            borderRadius: '2px',
            transition: 'width 0.2s',
          }} />
        </div>
        <span style={{ flexShrink: 0 }}>
          {allViewed ? (
            <span style={{ color: 'var(--color-equal)' }}>All changes viewed · q to close</span>
          ) : (
            <>{viewedChanges} of {totalChanges} changes viewed</>
          )}
        </span>
      </div>
    </div>
  );
}

export default FileNavbar;
