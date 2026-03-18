import React from 'react';

export function FileNavbar({ files, currentIndex, allViewed, hunkCounts, viewed, perFileReviewedHunks, currentFilePath }) {
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
